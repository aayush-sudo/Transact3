import math
from typing import List
from app.models.schemas import FXAnalyzeRequest, FXAnalyzeResponse

class FXAnalysisService:
    def analyze(self, req: FXAnalyzeRequest) -> FXAnalyzeResponse:
        current = req.current_rate
        series = list(req.rate_history)
        if not series or series[-1] != current:
            series.append(current)

        is_sufficient = len(series) >= 3

        # Window for moving average (up to 5 recent observations)
        window = series[-min(len(series), 5):]
        sma = sum(window) / len(window)

        # Exponential Moving Average with smoothing alpha
        alpha = 2.0 / (len(window) + 1)
        ema = window[0]
        for val in window[1:]:
            ema = (val * alpha) + (ema * (1.0 - alpha))

        # Relative volatility standard deviation
        variance = sum([(x - sma) ** 2 for x in window]) / len(window)
        std_dev = math.sqrt(variance)
        volatility_pct = (std_dev / current) * 100.0 if current > 0 else 0.0

        if volatility_pct > 1.2:
            vol_class = "High"
        elif volatility_pct > 0.4:
            vol_class = "Moderate"
        else:
            vol_class = "Low"

        classification = "NEUTRAL"
        recommendation = "Current FX conditions appear stable and neutral across short-term moving averages."

        if not is_sufficient:
            classification = "NEUTRAL"
            recommendation = "Limited historical observations available. Proceed with standard execution guidance."
        elif current >= ema * 1.002:
            classification = "EXECUTE_NOW"
            recommendation = (
                f"Current rate ({current:.4f}) is favorable relative to the 24h EMA ({ema:.4f}). "
                "Current FX conditions appear favorable. Executing now locks attractive conversion terms."
            )
        elif current <= ema * 0.995 and vol_class == "High":
            classification = "CONSIDER_DEFER"
            recommendation = (
                f"Current rate ({current:.4f}) is trading below recent EMA ({ema:.4f}) amidst elevated volatility. "
                "Analytical guidance suggests considering deferral if payment settlement is non-critical."
            )
        else:
            classification = "NEUTRAL"
            recommendation = (
                f"Current rate ({current:.4f}) is closely tracking the 24h SMA ({sma:.4f}) and EMA ({ema:.4f}) "
                f"under {vol_class.lower()} volatility conditions."
            )

        return FXAnalyzeResponse(
            base_currency=req.base_currency,
            target_currency=req.target_currency,
            current_rate=round(current, 4),
            sma_24h=round(sma, 4),
            ema_24h=round(ema, 4),
            volatility_pct=round(volatility_pct, 3),
            volatility_classification=vol_class,
            classification=classification,
            recommendation=recommendation,
            is_sufficient_history=is_sufficient
        )

fx_analysis_service = FXAnalysisService()
