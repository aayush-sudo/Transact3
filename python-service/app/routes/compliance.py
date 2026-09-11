from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.services.aml_service import aml_sanction_engine

router = APIRouter(prefix="/compliance", tags=["Compliance & AML"])

class ScreenNameRequest(BaseModel):
    name: str = Field(..., example="Wladimir Petrow")
    threshold_reject: Optional[float] = Field(0.85, example=0.85)
    threshold_review: Optional[float] = Field(0.65, example=0.65)

@router.post("/screen")
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
