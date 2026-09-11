from fastapi import APIRouter
from app.models.schemas import FXAnalyzeRequest, FXAnalyzeResponse
from app.services.fx_analysis_service import fx_analysis_service

router = APIRouter(prefix="/fx", tags=["FX Analysis"])

@router.post("/analyze", response_model=FXAnalyzeResponse)
async def analyze_fx(req: FXAnalyzeRequest):
    return fx_analysis_service.analyze(req)
