from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.services.graph_router_service import smart_fx_router

router = APIRouter(prefix="/routing", tags=["Graph Routing"])

class GraphPathRequest(BaseModel):
    source_currency: str = Field(..., example="USD")
    destination_currency: str = Field(..., example="INR")
    max_latency_seconds: Optional[int] = Field(300, example=300)

@router.post("/graph-path")
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

@router.get("/arbitrage-check")
async def check_arbitrage():
    has_negative_cycle = smart_fx_router.check_arbitrage_cycle()
    return {
        "success": True,
        "has_arbitrage_opportunity": has_negative_cycle,
        "algorithm": "BELLMAN_FORD_NEGATIVE_CYCLE_DETECTION"
    }
