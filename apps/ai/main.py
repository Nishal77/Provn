"""
ATTESTA AI Service — FastAPI
Phase 1: Scaffold only (health endpoint).
Phase 6: Skill evaluation endpoints (CodeLlama, CLIP, Llama 3.1).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from routers import health


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    port: int = 5000

    class Config:
        env_file = ".env"


settings = Settings()

app = FastAPI(
    title="ATTESTA AI Service",
    version="0.1.0",
    description="AI evaluation service for skill attestations and trust scoring",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
