from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class RailCandidate(BaseModel):
    id: str
    name: str
    base_fee_usd: float
    variable_fee_bps: float
    est_fee_usd: float
    est_latency_hours: float
    expected_settlement_display: Optional[str] = None
    reliability_score: float = 0.99
    available_liquidity_usd: float = 1000000.0
    is_eligible: bool = True
    rejection_reason: Optional[str] = None

class RouteAnalyzeRequest(BaseModel):
    source_currency: str = "USD"
    destination_currency: str = "EUR"
    amount: float = 10000.0
    preference: str = "BALANCED" # BALANCED, CHEAPEST, FASTEST
    rails: List[RailCandidate]

class ScoredRail(BaseModel):
    id: str
    name: str
    is_eligible: bool
    rejection_reason: Optional[str] = None
    est_fee_usd: float
    est_latency_hours: float
    reliability_score: float
    expected_settlement_display: Optional[str] = None
    norm_cost: float
    norm_speed: float
    norm_reliability: float
    liquidity_penalty: float
    deterministic_score: float
    ml_adjustment: float = 0.0
    final_score: float
    rank: int

class RouteAnalyzeResponse(BaseModel):
    preference: str
    evaluated_rails: List[ScoredRail]
    recommended_rail: Optional[ScoredRail] = None
    explanation: str

class FXAnalyzeRequest(BaseModel):
    base_currency: str = "USD"
    target_currency: str = "EUR"
    current_rate: float
    rate_history: List[float] = Field(default_factory=list)

class FXAnalyzeResponse(BaseModel):
    base_currency: str
    target_currency: str
    current_rate: float
    sma_24h: float
    ema_24h: float
    volatility_pct: float
    volatility_classification: str
    classification: str # EXECUTE_NOW, NEUTRAL, CONSIDER_DEFER
    recommendation: str
    is_sufficient_history: bool

class TCACalculateRequest(BaseModel):
    source_amount_usd: float
    selected_rail_fee_usd: float
    selected_latency_hours: float
    swift_baseline_fee_usd: Optional[float] = None
    swift_baseline_latency_hours: float = 36.0
    fx_spread_bps: float = 30.0
    fx_cost_usd: float = 0.0

class TCACalculateResponse(BaseModel):
    source_amount_usd: float
    actual_rail_fee_usd: float
    fx_cost_usd: float
    total_actual_cost_usd: float
    swift_baseline_cost_usd: float
    cost_saved_usd: float
    cost_saved_bps: float
    actual_latency_hours: float
    swift_latency_hours: float
    time_saved_hours: float
    rail_share_pct: float
    fx_share_pct: float
