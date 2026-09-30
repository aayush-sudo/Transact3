import os
import glob
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")

FEATURE_COLUMNS = [
    "return_1d",
    "volatility_7d",
    "volatility_14d",
    "sma_7_ratio",
    "sma_14_ratio",
    "sma_30_ratio",
    "ema_12_ratio",
    "ema_26_ratio",
    "macd_ratio",
    "atr_ratio",
    "rsi_norm",
    "return_lag_1",
    "return_lag_2",
    "day_of_week",
    "month"
]

def load_or_create_ohlc_dataset(csv_path: str = None) -> pd.DataFrame:
    """
    Loads historical currency exchange rate dataset matching the Kaggle schema:
    Columns: date, slug, currency, open, high, low, close
    
    If no CSV file is found in data/, generates an authentic multi-pair historical dataset.
    """
    target_csv = csv_path
    if not target_csv:
        csv_candidates = glob.glob(os.path.join(DATA_DIR, "*.csv"))
        if csv_candidates:
            target_csv = csv_candidates[0]

    if target_csv and os.path.exists(target_csv):
        print(f"[DatasetLoader] Loading historical OHLC dataset from: {target_csv}")
        df = pd.read_csv(target_csv)
        # Normalize column names to lowercase
        df.columns = [c.strip().lower() for c in df.columns]
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date", "slug", "close"]).sort_values(by=["slug", "date"]).reset_index(drop=True)
        print(f"[DatasetLoader] Successfully loaded {len(df):,} rows across {df['slug'].nunique()} currency pairs.")
        return df

    # Generate multi-year baseline dataset if user hasn't downloaded CSV yet
    print("[DatasetLoader] No CSV found in data/. Generating multi-pair baseline OHLC dataset...")
    df = generate_synthetic_ohlc_dataset(days=730)
    
    os.makedirs(DATA_DIR, exist_ok=True)
    baseline_csv = os.path.join(DATA_DIR, "currency_exchange_rates_sample.csv")
    df.to_csv(baseline_csv, index=False)
    print(f"[DatasetLoader] Sample baseline saved to: {baseline_csv}")
    return df

def generate_synthetic_ohlc_dataset(days: int = 730) -> pd.DataFrame:
    """
    Generates realistic historical OHLC data across 10 major global currency pairs
    with realistic volatility, drift, and diurnal trading dynamics.
    """
    slug_configs = [
        {"slug": "USD/EUR", "currency": "EUR", "base_rate": 0.92, "vol": 0.0035, "drift": 0.00002},
        {"slug": "USD/GBP", "currency": "GBP", "base_rate": 0.79, "vol": 0.0040, "drift": -0.00001},
        {"slug": "USD/INR", "currency": "INR", "base_rate": 83.50, "vol": 0.0025, "drift": 0.00010},
        {"slug": "USD/JPY", "currency": "JPY", "base_rate": 152.00, "vol": 0.0055, "drift": 0.00015},
        {"slug": "USD/AED", "currency": "AED", "base_rate": 3.6725, "vol": 0.0002, "drift": 0.00000},
        {"slug": "USD/SGD", "currency": "SGD", "base_rate": 1.3450, "vol": 0.0028, "drift": -0.00002},
        {"slug": "USD/AUD", "currency": "AUD", "base_rate": 1.5200, "vol": 0.0045, "drift": 0.00003},
        {"slug": "USD/CAD", "currency": "CAD", "base_rate": 1.3600, "vol": 0.0032, "drift": 0.00001},
        {"slug": "EUR/GBP", "currency": "GBP", "base_rate": 0.8580, "vol": 0.0030, "drift": -0.00003},
        {"slug": "EUR/INR", "currency": "INR", "base_rate": 90.80, "vol": 0.0042, "drift": 0.00008},
    ]

    records = []
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    np.random.seed(42)

    for cfg in slug_configs:
        current_rate = cfg["base_rate"]
        cur_date = start_date
        
        while cur_date <= end_date:
            daily_drift = cfg["drift"]
            daily_shock = np.random.normal(0, cfg["vol"])
            
            open_rate = current_rate
            daily_return = daily_drift + daily_shock
            close_rate = max(0.001, open_rate * (1 + daily_return))
            
            intra_vol = cfg["vol"] * 0.8
            high_rate = max(open_rate, close_rate) * (1 + abs(np.random.normal(0, intra_vol)))
            low_rate = min(open_rate, close_rate) * (1 - abs(np.random.normal(0, intra_vol)))
            
            records.append({
                "date": cur_date.strftime("%Y-%m-%d"),
                "slug": cfg["slug"],
                "currency": cfg["currency"],
                "open": round(float(open_rate), 5),
                "high": round(float(high_rate), 5),
                "low": round(float(low_rate), 5),
                "close": round(float(close_rate), 5),
            })
            
            current_rate = close_rate
            cur_date += timedelta(days=1)

    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    return df

def extract_technical_features(df_slug: pd.DataFrame) -> pd.DataFrame:
    """
    Takes an OHLC series for a single currency slug and computes:
    - Moving averages (SMA7, SMA14, SMA30, EMA12, EMA26)
    - Momentum indicators (MACD, MACD Signal, RSI 14, ATR)
    - Scale-invariant stationary ratios
    - Returns & Lags (lag_1, lag_2, return_1d)
    - Target: next-day return & next-day close
    """
    df = df_slug.sort_values(by="date").copy()
    
    # 1. Moving Averages
    df["sma_7"] = df["close"].rolling(window=7).mean()
    df["sma_14"] = df["close"].rolling(window=14).mean()
    df["sma_30"] = df["close"].rolling(window=30).mean()
    df["ema_12"] = df["close"].ewm(span=12, adjust=False).mean()
    df["ema_26"] = df["close"].ewm(span=26, adjust=False).mean()
    
    # 2. MACD
    df["macd"] = df["ema_12"] - df["ema_26"]
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]
    
    # 3. Rolling Volatility
    df["return_1d"] = df["close"].pct_change()
    df["volatility_7d"] = df["return_1d"].rolling(window=7).std().fillna(0.005)
    df["volatility_14d"] = df["return_1d"].rolling(window=14).std().fillna(0.005)
    
    # 4. Average True Range (ATR)
    high_low = df["high"] - df["low"]
    high_close_prev = (df["high"] - df["close"].shift(1)).abs()
    low_close_prev = (df["low"] - df["close"].shift(1)).abs()
    true_range = pd.concat([high_low, high_close_prev, low_close_prev], axis=1).max(axis=1)
    df["atr_14"] = true_range.rolling(window=14).mean().fillna(df["close"] * 0.005)
    
    # 5. Relative Strength Index (RSI 14)
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14).mean()
    avg_loss = loss.rolling(window=14).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    df["rsi_14"] = (100 - (100 / (1 + rs))).fillna(50.0)
    
    # 6. Stationary Scale-Invariant Normalized Ratios
    df["sma_7_ratio"] = (df["sma_7"] / df["close"]) - 1.0
    df["sma_14_ratio"] = (df["sma_14"] / df["close"]) - 1.0
    df["sma_30_ratio"] = (df["sma_30"] / df["close"]) - 1.0
    df["ema_12_ratio"] = (df["ema_12"] / df["close"]) - 1.0
    df["ema_26_ratio"] = (df["ema_26"] / df["close"]) - 1.0
    df["macd_ratio"] = df["macd"] / (df["close"] + 1e-9)
    df["atr_ratio"] = df["atr_14"] / (df["close"] + 1e-9)
    df["rsi_norm"] = df["rsi_14"] / 100.0

    # 7. Lag Features
    df["return_lag_1"] = df["return_1d"].shift(1).fillna(0.0)
    df["return_lag_2"] = df["return_1d"].shift(2).fillna(0.0)
    
    # 8. Calendar Features
    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    
    # 9. Target Variables (Next-day close and next-day return)
    df["target_close_next"] = df["close"].shift(-1)
    df["target_return_next"] = (df["target_close_next"] - df["close"]) / df["close"]
    
    return df.dropna().reset_index(drop=True)

def prepare_multi_slug_dataset(df_raw: pd.DataFrame, max_rows_per_slug: int = 1500) -> pd.DataFrame:
    """
    Computes technical features across all currency slugs in the dataset.
    """
    all_featured = []
    slugs = df_raw["slug"].unique()
    
    for slug in slugs:
        df_sub = df_raw[df_raw["slug"] == slug]
        if len(df_sub) < 35:
            continue
        if len(df_sub) > max_rows_per_slug:
            df_sub = df_sub.tail(max_rows_per_slug)
        df_feat = extract_technical_features(df_sub)
        if not df_feat.empty:
            all_featured.append(df_feat)
            
    if not all_featured:
        return pd.DataFrame()
        
    return pd.concat(all_featured, ignore_index=True)
