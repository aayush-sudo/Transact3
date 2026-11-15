"""Standalone hourly FX forecasting utility.

Usage from the Python service root (or with ``python-service`` on PYTHONPATH):

    from app.ml.fx_forecaster import predict_rates

    forecast = predict_rates("USD", "INR")
    print(forecast["current_rate"])
    print(forecast["predicted_rates"]["+6h"]["rate"])

Twelve Data is used when TWELVEDATA_API_KEY is available. Without a key, this
module returns explicitly labeled synthetic data for development and demos.
"""

from __future__ import annotations

import copy
from concurrent.futures import ThreadPoolExecutor
from itertools import permutations
import json
import math
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

_API_URL = "https://api.twelvedata.com/time_series"
_FOREX_PAIRS_URL = "https://api.twelvedata.com/forex_pairs"
_CACHE_TTL_SECONDS = 15 * 60
_PAIR_CATALOG_TTL_SECONDS = 24 * 60 * 60
_FORECAST_STEPS = 48
_HORIZONS = (6, 12, 24, 48)
_cache: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
_cache_lock = threading.Lock()
_pair_locks: dict[tuple[str, str], threading.Lock] = {}
_pair_catalog_lock = threading.Lock()
_pair_catalog: tuple[float, list[str]] | None = None


class PairDataUnavailable(RuntimeError):
    """Raised when the provider does not have hourly observations for a pair."""


# Approximate units of each currency per USD. Used only for labeled mock data.
_MOCK_USD_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "INR": 83.5,
    "GBP": 0.79,
    "JPY": 150.0,
    "CAD": 1.36,
    "AUD": 1.52,
    "SGD": 1.34,
    "CHF": 0.88,
    "NZD": 1.64,
    "CNY": 7.2,
    "AED": 3.67,
    "HKD": 7.8,
    "KRW": 1340.0,
    "THB": 36.0,
    "MXN": 17.0,
    "ZAR": 18.0,
    "BRL": 5.8,
    "SEK": 10.5,
}


def _read_api_key() -> str | None:
    key = os.environ.get("TWELVEDATA_API_KEY", "").strip()
    if key:
        return key

    project_root = Path(__file__).resolve().parents[3]
    env_files = (
        project_root / ".env",
        project_root / "server" / ".env",
        project_root / "python-service" / ".env",
    )
    for env_file in env_files:
        try:
            lines = env_file.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for line in lines:
            candidate = line.strip()
            if not candidate or candidate.startswith("#"):
                continue
            if candidate.startswith("export "):
                candidate = candidate[7:].lstrip()
            name, separator, value = candidate.partition("=")
            if separator and name.strip() == "TWELVEDATA_API_KEY":
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                    value = value[1:-1]
                if value:
                    return value
    return None


def _validate_pair(base: str, target: str) -> tuple[str, str]:
    if not isinstance(base, str) or not isinstance(target, str):
        raise TypeError("base and target must be three-letter currency codes.")
    base_code, target_code = base.strip().upper(), target.strip().upper()
    if (
        len(base_code) != 3
        or len(target_code) != 3
        or not base_code.isascii()
        or not target_code.isascii()
        or not base_code.isalpha()
        or not target_code.isalpha()
    ):
        raise ValueError("base and target must be three-letter currency codes, e.g. USD and INR.")
    if base_code == target_code:
        raise ValueError("base and target currencies must be different.")
    return base_code, target_code


def _parse_provider_observations(payload: dict[str, Any]) -> list[tuple[datetime, float]]:
    if payload.get("status") == "error" or not isinstance(payload.get("values"), list):
        message = payload.get("message", "The API response did not contain hourly values.")
        if _is_pair_data_unavailable(str(message)):
            raise PairDataUnavailable(f"Twelve Data has no hourly data for this pair: {message}")
        raise RuntimeError(f"Twelve Data error: {message}")

    observations: dict[datetime, float] = {}
    for item in payload["values"]:
        try:
            timestamp = datetime.fromisoformat(
                str(item["datetime"]).replace("Z", "+00:00")
            )
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            else:
                timestamp = timestamp.astimezone(timezone.utc)
            rate = float(item["close"])
        except (KeyError, TypeError, ValueError):
            continue
        if math.isfinite(rate) and rate > 0:
            observations[timestamp] = rate

    ordered = sorted(observations.items())
    if len(ordered) < 24:
        raise PairDataUnavailable(
            f"Twelve Data returned only {len(ordered)} valid hourly closes; at least 24 are required."
        )
    return ordered[-200:]


def _is_pair_data_unavailable(message: str) -> bool:
    lowered = message.lower()
    return any(
        marker in lowered
        for marker in (
            "symbol not found",
            "invalid symbol",
            "unsupported symbol",
            "pair not found",
            "no data found",
            "no data available",
        )
    )


def _fetch_twelvedata(
    base: str, target: str, api_key: str
) -> list[tuple[datetime, float]]:
    for attempt in range(2):
        try:
            response = requests.get(
                _API_URL,
                params={
                    "symbol": f"{base}/{target}",
                    "interval": "1h",
                    "outputsize": "200",
                    "timezone": "UTC",
                    "apikey": api_key,
                },
                headers={"Accept": "application/json", "User-Agent": "Transact3-FX-Forecaster/1.0"},
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "unknown"
            if status in (400, 404, 422):
                raise PairDataUnavailable(
                    f"Twelve Data does not provide hourly data for {base}/{target} (HTTP {status})."
                ) from None
            if isinstance(status, int) and status >= 500 and attempt == 0:
                time.sleep(0.25)
                continue
            raise RuntimeError(f"Twelve Data request failed with HTTP {status}.") from None
        except requests.JSONDecodeError:
            raise RuntimeError("Twelve Data returned a response that was not valid JSON.") from None
        except requests.RequestException as exc:
            if attempt == 0:
                time.sleep(0.25)
                continue
            raise RuntimeError(
                f"Could not reach Twelve Data ({type(exc).__name__}; network or TLS failure)."
            ) from None
        break

    if not isinstance(payload, dict):
        raise RuntimeError("Twelve Data returned an unexpected response.")
    return _parse_provider_observations(payload)


def _fetch_oriented_pair(
    base: str, target: str, api_key: str
) -> list[tuple[datetime, float]]:
    try:
        return _fetch_twelvedata(base, target, api_key)
    except PairDataUnavailable as direct_error:
        try:
            inverse_observations = _fetch_twelvedata(target, base, api_key)
        except PairDataUnavailable:
            raise direct_error
        return [
            (timestamp, 1.0 / rate)
            for timestamp, rate in inverse_observations
            if rate > 0
        ]


def _fetch_pair_observations(
    base: str, target: str, api_key: str
) -> tuple[list[tuple[datetime, float]], str]:
    try:
        return _fetch_oriented_pair(base, target, api_key), "twelvedata"
    except PairDataUnavailable as direct_error:
        if base == "USD" or target == "USD":
            raise

        try:
            with ThreadPoolExecutor(max_workers=2) as executor:
                base_future = executor.submit(_fetch_oriented_pair, "USD", base, api_key)
                target_future = executor.submit(_fetch_oriented_pair, "USD", target, api_key)
                usd_per_base = dict(base_future.result())
                target_per_usd = dict(target_future.result())
        except RuntimeError as cross_error:
            raise RuntimeError(
                f"Direct pair {base}/{target} is unavailable, and Twelve Data could not provide "
                f"both USD cross rates: {cross_error}"
            ) from direct_error

        common_hours = sorted(usd_per_base.keys() & target_per_usd.keys())
        if len(common_hours) < 24:
            raise RuntimeError(
                f"Direct pair {base}/{target} is unavailable, and the USD cross has only "
                f"{len(common_hours)} matching hourly closes."
            ) from direct_error

        crossed = [
            (timestamp, target_per_usd[timestamp] / usd_per_base[timestamp])
            for timestamp in common_hours[-200:]
            if usd_per_base[timestamp] > 0
        ]
        if len(crossed) < 24:
            raise RuntimeError(
                f"Direct pair {base}/{target} is unavailable, and the USD cross has fewer than "
                "24 valid hourly closes."
            ) from direct_error
        return crossed, "twelvedata_cross"


def get_supported_forex_pairs() -> list[str]:
    """Return Twelve Data's forex-pair catalog, or mockable pairs without a key."""
    global _pair_catalog
    api_key = _read_api_key()
    if not api_key:
        return sorted(
            f"{base}/{target}"
            for base, target in permutations(_MOCK_USD_RATES, 2)
        )

    with _pair_catalog_lock:
        now = time.monotonic()
        if _pair_catalog is not None and now - _pair_catalog[0] < _PAIR_CATALOG_TTL_SECONDS:
            return list(_pair_catalog[1])

        try:
            response = requests.get(
                _FOREX_PAIRS_URL,
                params={"apikey": api_key},
                headers={"Accept": "application/json", "User-Agent": "Transact3-FX-Forecaster/1.0"},
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "unknown"
            raise RuntimeError(f"Twelve Data forex catalog request failed with HTTP {status}.") from None
        except requests.JSONDecodeError:
            raise RuntimeError("Twelve Data forex catalog returned invalid JSON.") from None
        except requests.RequestException as exc:
            raise RuntimeError(f"Could not reach Twelve Data forex catalog ({type(exc).__name__}).") from None

        rows = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            message = payload.get("message", "The forex catalog response was invalid.") if isinstance(payload, dict) else "The forex catalog response was invalid."
            raise RuntimeError(f"Twelve Data forex catalog error: {message}")

        pairs = sorted({
            symbol.upper()
            for row in rows
            if isinstance(row, dict)
            and isinstance((symbol := row.get("symbol")), str)
            and len(symbol.split("/")) == 2
            and all(len(code) == 3 and code.isalpha() for code in symbol.split("/"))
        })
        if not pairs:
            raise RuntimeError("Twelve Data forex catalog contained no currency pairs.")
        _pair_catalog = (time.monotonic(), pairs)
        return list(pairs)


def _market_schedule(
    observations: list[tuple[datetime, float]],
) -> tuple[int, int]:
    """Infer UTC Friday close and Sunday reopen hours from observed weekend gaps."""
    adjacent_observations = zip(observations, observations[1:])
    for (before, _), (after, _) in reversed(list(adjacent_observations)):
        if (
            after - before > timedelta(hours=24)
            and before.weekday() == 4
            and after.weekday() == 6
        ):
            return (before.hour + 1) % 24, after.hour
    return 22, 22


def _market_is_open(timestamp: datetime, close_hour: int, reopen_hour: int) -> bool:
    weekday = timestamp.weekday()
    if weekday == 5:
        return False
    if weekday == 6:
        return timestamp.hour >= reopen_hour
    if weekday == 4:
        return timestamp.hour < close_hour
    return True


def _mock_observations(
    base: str, target: str
) -> list[tuple[datetime, float]]:
    base_usd = _MOCK_USD_RATES.get(base)
    target_usd = _MOCK_USD_RATES.get(target)
    if base_usd is None or target_usd is None:
        raise ValueError(
            f"No mock baseline is available for {base}/{target}; configure TWELVEDATA_API_KEY."
        )

    anchor = target_usd / base_usd
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    cursor = now - timedelta(hours=1)
    timestamps: list[datetime] = []
    while len(timestamps) < 200:
        if _market_is_open(cursor, 22, 22):
            timestamps.append(cursor)
        cursor -= timedelta(hours=1)
    timestamps.reverse()

    observations = []
    for index, timestamp in enumerate(timestamps):
        movement = (
            0.0007 * math.sin(index / 8.0)
            + 0.00035 * math.sin(index / 23.0)
            + 0.00008 * (index / len(timestamps) - 0.5)
        )
        observations.append((timestamp, anchor * (1.0 + movement)))
    return observations


def _holt_forecast(rates: list[float]) -> tuple[list[float], float]:
    """Damped Holt linear forecast and recent one-step residual scale."""
    alpha, beta, damping = 0.25, 0.05, 0.98
    level = rates[0]
    trend = rates[1] - rates[0]
    residuals: list[float] = []

    for index, actual in enumerate(rates[1:], start=1):
        one_step = level + damping * trend
        if index >= 20:
            residuals.append(actual - one_step)
        previous_level = level
        level = alpha * actual + (1.0 - alpha) * one_step
        trend = beta * (level - previous_level) + (1.0 - beta) * damping * trend

    scale = math.sqrt(sum(error * error for error in residuals) / max(1, len(residuals)))
    forecasts = []
    damped_steps = 0.0
    damped_factor = 1.0
    for _ in range(_FORECAST_STEPS):
        damped_factor *= damping
        damped_steps += damped_factor
        forecasts.append(max(1e-12, level + trend * damped_steps))
    return forecasts, scale


def _build_result(
    base: str,
    target: str,
    observations: list[tuple[datetime, float]],
    source: str,
) -> dict[str, Any]:
    rates = [rate for _, rate in observations]
    forecasts, residual_scale = _holt_forecast(rates)
    close_hour, reopen_hour = _market_schedule(observations)
    now = datetime.now(timezone.utc)
    latest_timestamp, current_rate = observations[-1]
    predicted_rates: dict[str, dict[str, float]] = {}

    for horizon in _HORIZONS:
        target_time = now + timedelta(hours=horizon)
        forecast_steps = 0
        cursor = latest_timestamp + timedelta(hours=1)
        while cursor <= target_time and forecast_steps < _FORECAST_STEPS:
            if _market_is_open(cursor, close_hour, reopen_hour):
                forecast_steps += 1
            cursor += timedelta(hours=1)

        if forecast_steps == 0:
            predicted_rate = current_rate
        else:
            predicted_rate = forecasts[forecast_steps - 1]
        interval = 1.96 * residual_scale * math.sqrt(max(forecast_steps, 1))
        predicted_rates[f"+{horizon}h"] = {
            "rate": round(predicted_rate, 8),
            "low": round(max(1e-12, predicted_rate - interval), 8),
            "high": round(predicted_rate + interval, 8),
        }

    return {
        "base": base,
        "target": target,
        "current_rate": round(current_rate, 8),
        "observations": [
            {"date": timestamp.isoformat(), "rate": round(rate, 8)}
            for timestamp, rate in observations
        ],
        "predicted_rates": predicted_rates,
        "source": source,
        "as_of": now.isoformat(),
        "rate_as_of": latest_timestamp.isoformat(),
        "bounds_note": "Approximate bands from recent one-step forecast errors; not calibrated confidence intervals.",
    }


def predict_rates(base: str, target: str) -> dict[str, Any]:
    """Return the latest hourly rate and damped-Holt projections for +6h to +48h.

    Results are cached in memory per pair for 15 minutes. A missing API key
    selects synthetic weekday-only demo observations; API failures with a key
    configured raise RuntimeError rather than silently switching to mock rates.
    """
    base_code, target_code = _validate_pair(base, target)
    pair = (base_code, target_code)
    with _cache_lock:
        cached = _cache.get(pair)
        if cached is not None and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
            return copy.deepcopy(cached[1])
        pair_lock = _pair_locks.setdefault(pair, threading.Lock())

    with pair_lock:
        with _cache_lock:
            cached = _cache.get(pair)
            if cached is not None and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
                return copy.deepcopy(cached[1])
        api_key = _read_api_key()
        if api_key:
            observations, source = _fetch_pair_observations(base_code, target_code, api_key)
        else:
            observations = _mock_observations(base_code, target_code)
            source = "mock"

        result = _build_result(base_code, target_code, observations, source)
        with _cache_lock:
            _cache[pair] = (time.monotonic(), result)
        return copy.deepcopy(result)
