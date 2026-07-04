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

    # Phase 6/9 — Groq (OpenAI-compatible, Llama 3.1 70B + Mixtral)
    # Get key at https://console.groq.com
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Code + Writing eval: Llama 3.1 70B via Groq
    groq_model_code: str = "llama-3.1-70b-versatile"
    # Data eval: Mixtral 8x7B via Groq
    groq_model_data: str = "mixtral-8x7b-32768"

    # Phase 6/9 — Anthropic direct (Claude Haiku for design eval)
    # Get key at https://console.anthropic.com
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

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
