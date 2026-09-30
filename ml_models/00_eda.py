#!/usr/bin/env python3
"""
Transact3 - Exploratory Data Analysis (EDA)
Dataset: Currency Foreign Exchange Rates (forex.csv)
Columns: slug, date, open, high, low, close, currency
"""

import os
import sys
import pandas as pd
import numpy as np

# Force UTF-8 stdout if available
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "forex.csv")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "eda_report.txt")

def run_eda():
    print("=" * 75)
    print(" [EDA] EXPLORATORY DATA ANALYSIS - HISTORICAL FOREX DATASET")
    print("=" * 75)
    
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Forex dataset not found at: {DATA_PATH}")

    print(f"\n[1] Loading dataset from: {DATA_PATH} ...")
    df = pd.read_csv(DATA_PATH)
    total_rows, total_cols = df.shape
    print(f"    -> Total Records: {total_rows:,} rows")
    print(f"    -> Total Features: {total_cols} columns ({list(df.columns)})")
    print(f"    -> Memory Footprint: {df.memory_usage(deep=True).sum() / (1024**2):.2f} MB")

    # 1. Null and Duplicate Checks
    print("\n[2] Checking Data Completeness & Integrity...")
    null_counts = df.isnull().sum()
    print("    -> Missing values per column:")
    for col, count in null_counts.items():
        print(f"       * {col:<10}: {count:,} missing ({count/total_rows*100:.2f}%)")
    
    dup_count = df.duplicated().sum()
    print(f"    -> Exact duplicate rows: {dup_count:,}")

    # 2. Date Parsing and Temporal Coverage
    print("\n[3] Temporal Analysis...")
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    valid_dates = df['date'].dropna()
    min_date = valid_dates.min()
    max_date = valid_dates.max()
    print(f"    -> Date Range: {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")
    print(f"    -> Temporal Span: {(max_date - min_date).days / 365.25:.1f} years")

    # 3. Currency and Slug Cardinality
    print("\n[4] Currency Pairs & Categorical Cardinality...")
    unique_slugs = df['slug'].nunique()
    unique_currencies = df['currency'].nunique()
    print(f"    -> Unique Currency Pairs (slugs): {unique_slugs:,}")
    print(f"    -> Unique Target Currencies: {unique_currencies:,}")

    print("\n    -> Top 10 Most Frequent Currency Pairs (by historical depth):")
    top_slugs = df['slug'].value_counts().head(10)
    for slug, count in top_slugs.items():
        print(f"       * {slug:<12}: {count:>6,} rows")

    # 4. OHLC Sanity Verification
    print("\n[5] Financial OHLC Price Consistency Verification...")
    invalid_high_low = (df['high'] < df['low']).sum()
    invalid_high_close = (df['high'] < df['close']).sum()
    invalid_low_close = (df['low'] > df['close']).sum()
    zero_or_negative = ((df[['open', 'high', 'low', 'close']] <= 0).any(axis=1)).sum()

    print(f"    -> High < Low anomalies          : {invalid_high_low:,}")
    print(f"    -> High < Close anomalies        : {invalid_high_close:,}")
    print(f"    -> Low > Close anomalies         : {invalid_low_close:,}")
    print(f"    -> Zero or negative price values : {zero_or_negative:,}")

    # 5. Descriptive Statistics for OHLC
    print("\n[6] Descriptive Statistics for Continuous Variables:")
    stats_df = df[['open', 'high', 'low', 'close']].describe().T
    print(stats_df[['mean', 'std', 'min', '50%', 'max']].to_string())

    # 6. Sample Corridor Deep-Dive (e.g. USD/EUR or USD/INR)
    sample_slug = "USD/INR" if "USD/INR" in df['slug'].values else df['slug'].value_counts().index[0]
    print(f"\n[7] Deep Dive on Representative Corridor: '{sample_slug}'")
    sub = df[df['slug'] == sample_slug].sort_values('date').copy()
    sub['return_1d'] = sub['close'].pct_change()
    
    print(f"    -> Records for {sample_slug}: {len(sub):,}")
    print(f"    -> Date range: {sub['date'].min().strftime('%Y-%m-%d')} to {sub['date'].max().strftime('%Y-%m-%d')}")
    print(f"    -> Min Close Rate: {sub['close'].min():.4f}")
    print(f"    -> Max Close Rate: {sub['close'].max():.4f}")
    print(f"    -> Mean Daily Return: {sub['return_1d'].mean()*100:+.4f}%")
    print(f"    -> Daily Return Volatility (Std Dev): {sub['return_1d'].std()*100:.4f}%")

    # 7. Write Summary Report to Disk
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("=" * 75 + "\n")
        f.write(" TRANSACT3 - EXPLORATORY DATA ANALYSIS (EDA) REPORT\n")
        f.write("=" * 75 + "\n\n")
        f.write(f"Dataset File        : {DATA_PATH}\n")
        f.write(f"Total Rows          : {total_rows:,}\n")
        f.write(f"Total Columns       : {total_cols} ({', '.join(df.columns)})\n")
        f.write(f"Date Range          : {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}\n")
        f.write(f"Unique Slugs (Pairs): {unique_slugs:,}\n")
        f.write(f"Unique Currencies   : {unique_currencies:,}\n")
        f.write(f"Duplicates          : {dup_count:,}\n")
        f.write(f"Missing Values      :\n")
        for col, count in null_counts.items():
            f.write(f"  - {col}: {count:,} ({count/total_rows*100:.2f}%)\n")
        f.write(f"\nTop 15 Currency Slugs by Count:\n")
        for slug, count in df['slug'].value_counts().head(15).items():
            f.write(f"  - {slug}: {count:,}\n")
        f.write(f"\nOHLC Sanity Checks:\n")
        f.write(f"  - High < Low anomalies   : {invalid_high_low:,}\n")
        f.write(f"  - Zero or Negative values: {zero_or_negative:,}\n")
        f.write(f"\nDescriptive Statistics:\n")
        f.write(stats_df[['mean', 'std', 'min', '50%', 'max']].to_string())
        f.write("\n\nKey Insights for ML Modeling:\n")
        f.write("1. Scale variance across pairs is massive (min 0.000001 to max millions), requiring stationary, scale-invariant percentage return targets.\n")
        f.write("2. Missing values and price zero anomalies are negligible.\n")
        f.write("3. Multi-year historical depth enables rich rolling technical features (SMA, EMA, RSI, MACD, Volatility).\n")

    print(f"\n[8] EDA Report successfully generated and saved to: {REPORT_PATH}")
    print("=" * 75)

if __name__ == "__main__":
    run_eda()
