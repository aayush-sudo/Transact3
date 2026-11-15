import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import requests
from app.ml import fx_forecaster


class HourlyFXCrossRateTests(unittest.TestCase):
    def setUp(self):
        fx_forecaster._cache.clear()
        self.timestamps = [
            datetime(2026, 11, 10, tzinfo=timezone.utc) + timedelta(hours=index)
            for index in range(48)
        ]

    def tearDown(self):
        fx_forecaster._cache.clear()

    def test_unsupported_direct_pair_uses_aligned_usd_hourly_series(self):
        def fetch(base, target, _api_key):
            if (base, target) in (("ABC", "DEF"), ("DEF", "ABC")):
                raise fx_forecaster.PairDataUnavailable("pair not found")
            rate = 2.0 if target == "ABC" else 6.0
            return [(timestamp, rate) for timestamp in self.timestamps]

        with (
            patch.object(fx_forecaster, "_read_api_key", return_value="test-key"),
            patch.object(fx_forecaster, "_fetch_twelvedata", side_effect=fetch),
        ):
            result = fx_forecaster.predict_rates("ABC", "DEF")

        self.assertEqual(result["source"], "twelvedata_cross")
        self.assertEqual(result["current_rate"], 3.0)
        self.assertEqual(set(result["predicted_rates"]), {"+6h", "+12h", "+24h", "+48h"})
        self.assertEqual(len(result["observations"]), 48)

    def test_inverse_provider_symbol_is_reversed_to_requested_orientation(self):
        def fetch(base, target, _api_key):
            if (base, target) == ("ABC", "DEF"):
                raise fx_forecaster.PairDataUnavailable("pair not found")
            return [(timestamp, 2.0) for timestamp in self.timestamps]

        with patch.object(fx_forecaster, "_fetch_twelvedata", side_effect=fetch):
            observations = fx_forecaster._fetch_oriented_pair("ABC", "DEF", "test-key")

        self.assertEqual(observations[-1][1], 0.5)

    def test_provider_quota_or_network_errors_do_not_trigger_cross_rate_fallback(self):
        with patch.object(
            fx_forecaster,
            "_fetch_twelvedata",
            side_effect=RuntimeError("Twelve Data request failed with HTTP 429."),
        ) as fetch:
            with self.assertRaisesRegex(RuntimeError, "HTTP 429"):
                fx_forecaster._fetch_pair_observations("ABC", "DEF", "test-key")

        fetch.assert_called_once_with("ABC", "DEF", "test-key")

    def test_temporary_provider_503_is_retried_once(self):
        unavailable = Mock()
        unavailable.raise_for_status.side_effect = requests.HTTPError(
            response=Mock(status_code=503)
        )
        recovered = Mock()
        recovered.json.return_value = {
            "values": [
                {"datetime": timestamp.isoformat(), "close": "1.25"}
                for timestamp in self.timestamps
            ]
        }

        with (
            patch.object(fx_forecaster.requests, "get", side_effect=[unavailable, recovered]) as get,
            patch.object(fx_forecaster.time, "sleep"),
        ):
            observations = fx_forecaster._fetch_twelvedata("ABC", "DEF", "test-key")

        self.assertEqual(len(observations), 48)
        self.assertEqual(get.call_count, 2)


if __name__ == "__main__":
    unittest.main()
