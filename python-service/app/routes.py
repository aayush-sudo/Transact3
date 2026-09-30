from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.models.schemas import (
    RouteAnalyzeRequest,
    RouteAnalyzeResponse,
    FXAnalyzeRequest,
    FXAnalyzeResponse,
    TCACalculateRequest,
    TCACalculateResponse
)
from app.services.scoring_service import scoring_service
from app.services.fx_analysis_service import fx_analysis_service
from app.services.tca_service import tca_service
from app.services.graph_router_service import smart_fx_router
from app.services.aml_service import aml_sanction_engine

from app.ml.currency_model import currency_forecaster
from app.ml.rail_model import rail_recommender
from app.ml.risk_model import transaction_risk_model

router = APIRouter()

# ====================================================================
# 1. Multi-Rail Pareto Route Optimization
# ====================================================================
@router.post("/route/analyze", response_model=RouteAnalyzeResponse, tags=["Routing"])
async def analyze_route(req: RouteAnalyzeRequest):
    return scoring_service.evaluate_rails(
        source_currency=req.source_currency,
        destination_currency=req.destination_currency,
        amount=req.amount,
        preference=req.preference,
        candidates=req.rails
    )

# ====================================================================
# 2. FX Volatility, Moving Averages & Predictive Analytics
# ====================================================================
@router.post("/fx/analyze", response_model=FXAnalyzeResponse, tags=["FX Analysis"])
async def analyze_fx(req: FXAnalyzeRequest):
    return fx_analysis_service.analyze(req)

# ====================================================================
# 3. Transaction Cost Analysis (TCA) Engine
# ====================================================================
@router.post("/tca/calculate", response_model=TCACalculateResponse, tags=["TCA Analytics"])
async def calculate_tca(req: TCACalculateRequest):
    return tca_service.calculate(req)

# ====================================================================
# 4. Multi-Hop Graph Routing (Dijkstra Shortest Path)
# ====================================================================
class GraphPathRequest(BaseModel):
    source_currency: str = Field(..., example="USD")
    destination_currency: str = Field(..., example="INR")
    max_latency_seconds: Optional[int] = Field(300, example=300)

@router.post("/routing/graph-path", tags=["Graph Routing"])
async def get_graph_path(req: GraphPathRequest):
    result = smart_fx_router.find_optimal_route(
        source_curr=req.source_currency,
        target_curr=req.destination_currency,
        max_latency_sec=req.max_latency_seconds or 300
    )
    if not result:
        return {
            "success": False,
            "message": f"No active conversion path found between {req.source_currency} and {req.destination_currency}",
            "data": None
        }
    return {
        "success": True,
        "message": "Optimal conversion graph calculated via Dijkstra's algorithm",
        "data": result
    }

@router.get("/routing/arbitrage-check", tags=["Graph Routing"])
async def check_arbitrage():
    has_negative_cycle = smart_fx_router.check_arbitrage_cycle()
    return {
        "success": True,
        "has_arbitrage_opportunity": has_negative_cycle,
        "algorithm": "BELLMAN_FORD_NEGATIVE_CYCLE_DETECTION"
    }

# ====================================================================
# 5. Fuzzy RegTech AML & Sanction Screening
# ====================================================================
class ScreenNameRequest(BaseModel):
    name: str = Field(..., example="Wladimir Petrow")
    threshold_reject: Optional[float] = Field(0.85, example=0.85)
    threshold_review: Optional[float] = Field(0.65, example=0.65)

@router.post("/compliance/screen", tags=["Compliance & AML"])
async def screen_entity(req: ScreenNameRequest):
    result = aml_sanction_engine.screen_name(
        input_name=req.name,
        threshold_reject=req.threshold_reject or 0.85,
        threshold_review=req.threshold_review or 0.65
    )
    return {
        "success": True,
        "data": {
            "query_name": result.query_name,
            "matched_target": result.matched_target,
            "risk_score": result.risk_score,
            "decision": result.decision,
            "metrics": result.metrics,
            "algorithms": ["JARO_WINKLER", "LEVENSHTEIN", "SOUNDEX"]
        }
    }

# ====================================================================
# 6. Machine Learning Endpoints (3 Core Models)
# ====================================================================

class MLPredictCurrencyRequest(BaseModel):
    slug: str = Field(..., example="USD/EUR")
    current_rate: float = Field(..., example=0.92)
    amount: Optional[float] = Field(10000.0, example=10000.0)
    recent_prices: Optional[List[float]] = None

@router.post("/ml/predict-currency", tags=["Machine Learning"])
async def predict_currency(req: MLPredictCurrencyRequest):
    """
    Model 1: Predicts currency exchange rate trajectory and execution timing
    using HistGradientBoostingRegressor trained on historical OHLC data.
    """
    result = currency_forecaster.predict_timing_advice(
        slug=req.slug,
        current_rate=req.current_rate,
        recent_prices=req.recent_prices,
        amount=req.amount or 10000.0
    )
    return {"success": True, "data": result}

class MLPredictRailRequest(BaseModel):
    amount_usd: float = Field(..., example=5000.0)
    corridor_slug: Optional[str] = Field("USD/EUR", example="USD/EUR")
    preference: Optional[str] = Field("BALANCED", example="FASTEST")
    is_weekend: Optional[bool] = None
    time_of_day_utc: Optional[int] = None
    fx_volatility_pct: Optional[float] = 0.5
    liquidity_ratio: Optional[float] = 0.85

@router.post("/ml/predict-rail", tags=["Machine Learning"])
async def predict_rail(req: MLPredictRailRequest):
    """
    Model 2: Predicts optimal payment rail and probability distribution
    using RandomForestClassifier.
    """
    result = rail_recommender.predict_rail(
        amount_usd=req.amount_usd,
        corridor_slug=req.corridor_slug or "USD/EUR",
        preference=req.preference or "BALANCED",
        is_weekend=req.is_weekend,
        time_of_day_utc=req.time_of_day_utc,
        fx_volatility_pct=req.fx_volatility_pct or 0.5,
        liquidity_ratio=req.liquidity_ratio or 0.85
    )
    return {"success": True, "data": result}

class MLPredictRiskRequest(BaseModel):
    amount_usd: float = Field(..., example=9850.0)
    recipient_name: Optional[str] = Field("", example="Acme Corp")
    source_country: Optional[str] = Field("US", example="US")
    destination_country: Optional[str] = Field("DE", example="DE")
    velocity_24h_count: Optional[int] = Field(1, example=1)
    sanction_match_score: Optional[float] = Field(0.0, example=0.0)

@router.post("/ml/predict-risk", tags=["Machine Learning"])
async def predict_risk(req: MLPredictRiskRequest):
    """
    Model 3: Evaluates transaction risk score, anomaly detection, and AML flags
    using IsolationForest and regulatory compliance logic.
    """
    result = transaction_risk_model.predict_risk(
        amount_usd=req.amount_usd,
        recipient_name=req.recipient_name or "",
        source_country=req.source_country or "US",
        destination_country=req.destination_country or "DE",
        velocity_24h_count=req.velocity_24h_count or 1,
        sanction_match_score=req.sanction_match_score or 0.0
    )
    return {"success": True, "data": result}

class MLAdvisoryRequest(BaseModel):
    source_currency: str = Field(..., example="USD")
    destination_currency: str = Field(..., example="EUR")
    amount: float = Field(..., example=10000.0)
    preference: Optional[str] = Field("BALANCED", example="FASTEST")
    recipient_name: Optional[str] = Field("", example="John Doe")
    recipient_country: Optional[str] = Field("DE", example="DE")
    current_rate: Optional[float] = Field(None, example=0.92)
    recent_prices: Optional[List[float]] = None

@router.post("/ml/advisory", tags=["Machine Learning"])
async def unified_ml_advisory(req: MLAdvisoryRequest):
    """
    Unified Meta-Advisory Engine:
    Combines Model 1 (Currency Forecast), Model 2 (Rail Recommendation),
    Model 3 (Risk & Compliance), and Multi-Hop routing into one cohesive advisory package.
    """
    slug = f"{req.source_currency.upper()}/{req.destination_currency.upper()}"
    
    # 1. Sanction screening
    sanction_match = 0.0
    if req.recipient_name:
        aml_res = aml_sanction_engine.screen_name(req.recipient_name)
        sanction_match = aml_res.risk_score

    # 2. Risk Model
    risk_output = transaction_risk_model.predict_risk(
        amount_usd=req.amount,
        recipient_name=req.recipient_name or "",
        source_country="US",
        destination_country=req.recipient_country or "DE",
        velocity_24h_count=1,
        sanction_match_score=sanction_match
    )

    # 3. Currency Model
    rate = req.current_rate or 1.0
    currency_output = currency_forecaster.predict_timing_advice(
        slug=slug,
        current_rate=rate,
        recent_prices=req.recent_prices,
        amount=req.amount
    )

    # 4. Rail Model
    rail_output = rail_recommender.predict_rail(
        amount_usd=req.amount,
        corridor_slug=slug,
        preference=req.preference or "BALANCED"
    )

    # 5. Multi-Hop Graph Route
    graph_route = smart_fx_router.find_optimal_route(
        source_curr=req.source_currency.upper(),
        target_curr=req.destination_currency.upper(),
        max_latency_sec=300
    )

    return {
        "success": True,
        "advisory": {
            "currency_timing": currency_output,
            "rail_recommendation": rail_output,
            "compliance_risk": risk_output,
            "graph_routing": graph_route,
            "platform_role": "ADVISORY_META_ENGINE_NON_CUSTODIAL"
        }
    }
