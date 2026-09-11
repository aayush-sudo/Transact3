from fastapi import APIRouter
from app.models.schemas import TCACalculateRequest, TCACalculateResponse
from app.services.tca_service import tca_service

router = APIRouter(prefix="/tca", tags=["TCA Analytics"])

@router.post("/calculate", response_model=TCACalculateResponse)
async def calculate_tca(req: TCACalculateRequest):
    return tca_service.calculate(req)
