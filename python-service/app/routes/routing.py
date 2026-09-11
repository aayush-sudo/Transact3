from fastapi import APIRouter
from app.models.schemas import RouteAnalyzeRequest, RouteAnalyzeResponse
from app.services.scoring_service import scoring_service

router = APIRouter(prefix="/route", tags=["Routing"])

@router.post("/analyze", response_model=RouteAnalyzeResponse)
async def analyze_route(req: RouteAnalyzeRequest):
    return scoring_service.evaluate_rails(
        source_currency=req.source_currency,
        destination_currency=req.destination_currency,
        amount=req.amount,
        preference=req.preference,
        candidates=req.rails
    )
