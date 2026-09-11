from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from app.config import settings
from app.routes import routing, fx, analytics, graph_routing, compliance

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Transact3 Quantitative Intelligence Service for multi-objective scoring, FX analytics, TCA, graph routing, and AML compliance"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routing.router)
app.include_router(fx.router)
app.include_router(analytics.router)
app.include_router(graph_routing.router)
app.include_router(compliance.router)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
