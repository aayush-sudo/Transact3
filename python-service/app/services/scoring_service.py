import math
from typing import List, Tuple
from app.models.schemas import RailCandidate, ScoredRail, RouteAnalyzeResponse
from app.services.ml_prediction_interface import ml_layer, MLPredictionFeatureVector

WEIGHTS = {
    "BALANCED": {"cost": 0.40, "speed": 0.40, "reliability": 0.20},
    "CHEAPEST": {"cost": 0.75, "speed": 0.10, "reliability": 0.15},
    "FASTEST":  {"cost": 0.15, "speed": 0.70, "reliability": 0.15}
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

        # Baseline denominators to avoid zero-division
        fee_norm_denom = max(max_fee, 25.0)
        speed_norm_denom = max(max_latency, 36.0)

        scored_rails: List[ScoredRail] = []

        for rail in candidates:
            # If not eligible, assign rejection penalty
            if not rail.is_eligible:
                scored_rails.append(ScoredRail(
                    id=rail.id,
                    name=rail.name,
                    is_eligible=False,
                    rejection_reason=rail.rejection_reason or "Not eligible",
                    est_fee_usd=rail.est_fee_usd,
                    est_latency_hours=rail.est_latency_hours,
                    reliability_score=rail.reliability_score,
                    expected_settlement_display=rail.expected_settlement_display,
                    norm_cost=1.0,
                    norm_speed=1.0,
                    norm_reliability=rail.reliability_score,
                    liquidity_penalty=10.0,
                    deterministic_score=-1.0,
                    ml_adjustment=0.0,
                    final_score=-1.0,
                    rank=99
                ))
                continue

            # Inverted normalization: Lower fee is better (1.0 = lowest fee, 0.0 = highest fee)
            norm_cost = max(0.0, min(1.0, 1.0 - (rail.est_fee_usd / fee_norm_denom)))

            # Inverted normalization: Lower latency is better (1.0 = fastest/instant, 0.0 = slowest)
            norm_speed = max(0.0, min(1.0, 1.0 - (rail.est_latency_hours / speed_norm_denom)))

            norm_reliability = rail.reliability_score

            # Liquidity utilization penalty
            liquidity_penalty = 0.0
            if rail.available_liquidity_usd < amount * 1.5:
                liquidity_penalty = 0.15

            # Multi-objective utility calculation
            deterministic_score = (
                (w["cost"] * norm_cost) +
                (w["speed"] * norm_speed) +
                (w["reliability"] * norm_reliability) -
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

        # Sort eligible rails by final score descending, followed by ineligible rails
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
            explanation = (
                f"Selected {recommended.name} as the best route under the '{pref}' policy "
                f"(Score: {recommended.final_score:.2f}, Fee: ${recommended.est_fee_usd:.2f}, "
                f"Settlement: {recommended.expected_settlement_display or f'{recommended.est_latency_hours}h'}). "
                f"Optimal multi-objective alignment for cost weight ({int(w['cost']*100)}%) "
                f"and speed weight ({int(w['speed']*100)}%)."
            )
        else:
            explanation = "No payment rail met liquidity, amount limit, and corridor operational constraints."

        return RouteAnalyzeResponse(
            preference=pref,
            evaluated_rails=all_ranked,
            recommended_rail=recommended,
            explanation=explanation
        )

scoring_service = ScoringService()
