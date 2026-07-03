"""
ATTESTA AI Service — FastAPI
Phase 1: Scaffold only (health endpoint).
Phase 6: Skill evaluation endpoints (CodeLlama, CLIP, Llama 3.1).
Phase 9: Trial evaluation endpoint (WorkProof Live scoring).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from routers import health
from routers import skill_eval
from routers import trial_eval


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    port: int = 5000

    # Phase 6/9 — AWS Bedrock
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    bedrock_model_id: str = "meta.llama3-70b-instruct-v1:0"
    bedrock_writing_model_id: str = "meta.llama3-70b-instruct-v1:0"

    # Internal service auth (shared secret with Node API)
    internal_api_secret: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

app = FastAPI(
    title="ATTESTA AI Service",
    version="0.3.0",
    description="AI evaluation service for skill attestations, trust scoring, and WorkProof Live trials",
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
app.include_router(skill_eval.router)
app.include_router(trial_eval.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
