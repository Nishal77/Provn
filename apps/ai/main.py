"""
ATTESTA AI Service — FastAPI
Phase 1: Scaffold only (health endpoint).
Phase 6: Skill evaluation endpoints (CodeLlama, Llama 3.1, Mixtral for data, Claude for design).
Phase 9: Trial evaluation endpoint (WorkProof Live scoring).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from routers import health
from routers import skill_eval
from routers import trial_eval
from routers import rolefit
from routers import trust_graph


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    port: int = 5000

    # Phase 6/9 — AWS Bedrock model IDs
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    # Code eval: CodeLlama 70B / Llama 3.1 70B
    bedrock_model_id: str = "meta.llama3-70b-instruct-v1:0"
    # Writing eval: Llama 3.1 70B (separate ID for independent tuning)
    bedrock_writing_model_id: str = "meta.llama3-70b-instruct-v1:0"
    # Data eval: Mixtral 8x7B
    bedrock_data_model_id: str = "mistral.mixtral-8x7b-instruct-v0:1"
    # Design eval: Claude claude-haiku-4-5 (vision capable)
    bedrock_vision_model_id: str = "anthropic.claude-haiku-4-5-20251001-v1:0"

    # Phase 10 — Pinecone vector DB (2048-dim candidate + role vectors)
    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east1-gcp"
    pinecone_index: str = "attesta-rolefit"

    # Phase 11 — Neo4j trust graph
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "attesta_dev"

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
app.include_router(rolefit.router)
app.include_router(trust_graph.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
