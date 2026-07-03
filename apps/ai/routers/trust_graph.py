"""
TrustChain AI router — anti-collusion detection + GraphSAGE trust scoring.

Endpoints:
  POST /trust/anti-collusion   — Isolation Forest score for a (referrer, candidate) pair
  POST /trust/graph-score      — GraphSAGE-based trust strength (stub; prod uses Neo4j + PyG)
"""

import math
import hashlib
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class AntiCollusionRequest(BaseModel):
    referrer_id: str
    candidate_id: str
    co_employment_months: int = 0
    shared_employers: int = 0
    referral_count_last_90d: int = 0
    referrer_trust_score: Optional[float] = None


class AntiCollusionResponse(BaseModel):
    score: float          # 0.0 = clean, 1.0 = highly suspicious
    flagged: bool
    reasons: list[str]


class GraphScoreRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    hop_count: int = 1
    path_strength_product: float = 1.0


class GraphScoreResponse(BaseModel):
    trust_score: float
    confidence: float


@router.post("/trust/anti-collusion", response_model=AntiCollusionResponse)
async def anti_collusion(req: AntiCollusionRequest) -> AntiCollusionResponse:
    """
    Isolation Forest proxy — prod uses sklearn IsolationForest trained on
    historical referral patterns. Dev: deterministic heuristic scoring.

    Risk factors:
    - Zero co-employment months → high risk
    - Many referrals in 90 days → velocity abuse
    - Same employer only → family/friend ring
    """
    reasons = []
    score = 0.0

    if req.co_employment_months == 0:
        score += 0.35
        reasons.append("no_co_employment_history")

    if req.referral_count_last_90d > 5:
        score += 0.25
        reasons.append("high_referral_velocity")

    if req.shared_employers == 0 and req.co_employment_months == 0:
        score += 0.20
        reasons.append("no_shared_professional_history")

    # Deterministic jitter based on IDs (simulates model variance)
    seed = hashlib.md5(f"{req.referrer_id}{req.candidate_id}".encode()).hexdigest()
    jitter = (int(seed[:4], 16) / 65535) * 0.10
    score = min(1.0, score + jitter)

    return AntiCollusionResponse(
        score=round(score, 3),
        flagged=score > 0.70,
        reasons=reasons,
    )


@router.post("/trust/graph-score", response_model=GraphScoreResponse)
async def graph_score(req: GraphScoreRequest) -> GraphScoreResponse:
    """
    GraphSAGE trust strength.
    Prod: run 2-layer GraphSAGE (PyTorch Geometric) over Neo4j adjacency.
    Dev: decay formula based on hop count.
    """
    # Trust decays exponentially with hops; path_strength_product captures edge weights
    trust = req.path_strength_product * math.exp(-0.3 * (req.hop_count - 1))
    trust = max(0.0, min(1.0, trust))
    confidence = 1.0 - 0.15 * req.hop_count  # lower confidence at more hops

    return GraphScoreResponse(
        trust_score=round(trust, 3),
        confidence=round(max(0.1, confidence), 3),
    )
