import os

class Settings:
    APP_NAME: str = "Transact3 Intelligence Service"
    APP_VERSION: str = "2.0.0"
    PORT: int = int(os.getenv("FASTAPI_PORT", "8000"))
    HOST: str = os.getenv("FASTAPI_HOST", "0.0.0.0")

settings = Settings()
