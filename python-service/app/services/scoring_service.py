import math
from typing import List, Tuple
from app.models.schemas import RailCandidate, ScoredRail, RouteAnalyzeResponse
from app.services.ml_prediction_interface import ml_layer, MLPredictionFeatureVector

WEIGHTS = {
    "BALANCED": {"cost": 0.35, "speed": 0.30, "reliability": 0.20, "risk": 0.10, "liquidity": 0.05},
    "CHEAPEST": {"cost": 0.70, "speed": 0.10, "reliability": 0.15, "risk": 0.05, "liquidity": 0.00},
    "FASTEST":  {"cost": 0.10, "speed": 0.70, "reliability": 0.15, "risk": 0.05, "liquidity": 0.00}
}

class ScoringService:
    def evaluate_rails(
        self,
        source_currency: str,
        destination_currency: str,
        amount: float,
        preference: str,
        candidates: List[RailCandidate]
    ) -> RouteAnalyzeResponse:
        pref = preference.upper() if preference else "BALANCED"
        if pref not in WEIGHTS:
            pref = "BALANCED"

        w = WEIGHTS[pref]

        # Calculate max bounds across candidates for fair normalization
        max_fee = max([c.est_fee_usd for c in candidates], default=50.0)
        max_latency = max([c.est_latency_hours for c in candidates], default=36.0)

        fee_norm_denom = max(max_fee, 25.0)
        speed_norm_denom = max(max_latency, 36.0)

        scored_rails: List[ScoredRail] = []

        for rail in candidates:
            # If not eligible, exclude from candidate selection
            if not rail.is_eligible:
                scored_rails.append(ScoredRail(
                    id=rail.id,
                    name=rail.name,
                    is_eligible=False,
                    rejection_reason=rail.rejection_reason or "Operational limit or corridor restriction",
                    est_fee_usd=rail.est_fee_usd,
                    est_latency_hours=rail.est_latency_hours,
                    reliability_score=rail.reliability_score,
                    expected_settlement_display=rail.expected_settlement_display,
                    norm_cost=0.0,
                    norm_speed=0.0,
                    norm_reliability=rail.reliability_score,
                    liquidity_penalty=10.0,
                    deterministic_score=-1.0,
                    ml_adjustment=0.0,
                    final_score=-1.0,
                    rank=99
                ))
                continue

            # Inverted normalization: Lower fee is better
            norm_cost = max(0.0, min(1.0, 1.0 - (rail.est_fee_usd / fee_norm_denom)))

            # Inverted normalization: Lower latency is better
            norm_speed = max(0.0, min(1.0, 1.0 - (rail.est_latency_hours / speed_norm_denom)))

            norm_reliability = max(0.0, min(1.0, rail.reliability_score))
            norm_risk = norm_reliability  # Higher reliability = lower risk
            
            # Liquidity adequacy (1.0 if liquidity > 2x amount)
            req_liq = max(1.0, amount * 2.0)
            norm_liquidity = max(0.0, min(1.0, rail.available_liquidity_usd / req_liq))

            liquidity_penalty = 0.15 if rail.available_liquidity_usd < amount * 1.5 else 0.0

            # Multi-objective utility calculation with all 5 factors
            deterministic_score = (
                (w["cost"] * norm_cost) +
                (w["speed"] * norm_speed) +
                (w["reliability"] * norm_reliability) +
                (w.get("risk", 0.0) * norm_risk) +
                (w.get("liquidity", 0.0) * norm_liquidity) -
                liquidity_penalty
            )
            deterministic_score = round(max(0.0, min(1.0, deterministic_score)), 4)

            # Query ML Prediction Layer for non-intrusive score adjustment
            features = MLPredictionFeatureVector(
                transaction_amount=amount,
                source_currency=source_currency,
                destination_currency=destination_currency,
                selected_corridor=f"{source_currency}-{destination_currency}",
                rail_id=rail.id,
                historical_rail_failure_rate=1.0 - rail.reliability_score,
                liquidity_available_usd=rail.available_liquidity_usd
            )
            ml_adjustment = ml_layer.predict_adjustment(features, deterministic_score)
            final_score = round(max(0.0, min(1.0, deterministic_score + ml_adjustment)), 4)

            scored_rails.append(ScoredRail(
                id=rail.id,
                name=rail.name,
                is_eligible=True,
                rejection_reason=None,
                est_fee_usd=rail.est_fee_usd,
                est_latency_hours=rail.est_latency_hours,
                reliability_score=rail.reliability_score,
                expected_settlement_display=rail.expected_settlement_display,
                norm_cost=round(norm_cost, 4),
                norm_speed=round(norm_speed, 4),
                norm_reliability=round(norm_reliability, 4),
                liquidity_penalty=round(liquidity_penalty, 4),
                deterministic_score=deterministic_score,
                ml_adjustment=round(ml_adjustment, 4),
                final_score=final_score,
                rank=1
            ))

        # Sort eligible rails by final score descending
        eligible_rails = [r for r in scored_rails if r.is_eligible]
        ineligible_rails = [r for r in scored_rails if not r.is_eligible]

        eligible_rails.sort(key=lambda x: x.final_score, reverse=True)

        for idx, r in enumerate(eligible_rails):
            r.rank = idx + 1

        for idx, r in enumerate(ineligible_rails):
            r.rank = len(eligible_rails) + idx + 1

        all_ranked = eligible_rails + ineligible_rails
        recommended = eligible_rails[0] if len(eligible_rails) > 0 else None

        explanation = ""
        if recommended:
            bullets = [
                f"Selected {recommended.name} under '{pref}' routing policy (Final Utility Score: {recommended.final_score:.2f}).",
                f"Cost: ${recommended.est_fee_usd:.2f} (Weight: {int(w['cost']*100)}%, Cost Index: {recommended.norm_cost:.2f}).",
                f"Speed: {recommended.expected_settlement_display} (Weight: {int(w['speed']*100)}%, Speed Index: {recommended.norm_speed:.2f}).",
                f"Reliability & Risk: {int(recommended.reliability_score*100)}% SLA confidence score."
            ]
            explanation = " • ".join(bullets)
        else:
            explanation = "No payment rail met liquidity, amount limit, and corridor operational constraints."

        return RouteAnalyzeResponse(
            preference=pref,
            evaluated_rails=all_ranked,
            recommended_rail=recommended,
            explanation=explanation
        )

scoring_service = ScoringService()
