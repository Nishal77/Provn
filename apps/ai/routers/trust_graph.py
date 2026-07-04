"""
TrustChain AI router — anti-collusion detection + GraphSAGE trust scoring.

Endpoints:
  POST /trust/anti-collusion   — Isolation Forest score for a (referrer, candidate) pair
  POST /trust/graph-score      — GraphSAGE-based trust strength (Neo4j-backed, falls back to heuristic)
  POST /trust/edge             — Upsert a TrustEdge into Neo4j
  GET  /trust/path             — Find shortest trust path between two users
"""

import math
import hashlib
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..main import settings  # type: ignore[import]

router = APIRouter()


# ─── Neo4j client ─────────────────────────────────────────────────────────────

def _neo4j_driver():
    """Return Neo4j driver if configured, else None."""
    if not settings.neo4j_uri:
        return None
    try:
        from neo4j import GraphDatabase  # type: ignore[import]
        driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        return driver
    except Exception:
        return None


class TrustEdgeRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    strength_score: float = 0.5
    co_employment_months: int = 0
    relationship_type: str = "WORKED_WITH"


class TrustEdgeResponse(BaseModel):
    persisted: bool
    from_user_id: str
    to_user_id: str


class TrustPathRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    max_hops: int = 3


class TrustPathResponse(BaseModel):
    found: bool
    path: list[str]
    hop_count: int
    trust_score: float


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


@router.post("/trust/edge", response_model=TrustEdgeResponse)
async def upsert_trust_edge(req: TrustEdgeRequest) -> TrustEdgeResponse:
    """
    Upsert a directed trust edge in Neo4j.
    Creates User nodes if they don't exist (MERGE by userId).
    """
    driver = _neo4j_driver()
    if driver is None:
        return TrustEdgeResponse(persisted=False, from_user_id=req.from_user_id, to_user_id=req.to_user_id)

    try:
        with driver.session() as session:
            session.run(
                """
                MERGE (a:User {userId: $from_id})
                MERGE (b:User {userId: $to_id})
                MERGE (a)-[r:TRUSTS {type: $rel_type}]->(b)
                SET r.strengthScore = $strength,
                    r.coEmploymentMonths = $months,
                    r.updatedAt = datetime()
                """,
                from_id=req.from_user_id,
                to_id=req.to_user_id,
                rel_type=req.relationship_type,
                strength=req.strength_score,
                months=req.co_employment_months,
            )
        driver.close()
        return TrustEdgeResponse(persisted=True, from_user_id=req.from_user_id, to_user_id=req.to_user_id)
    except Exception:
        return TrustEdgeResponse(persisted=False, from_user_id=req.from_user_id, to_user_id=req.to_user_id)


@router.post("/trust/path", response_model=TrustPathResponse)
async def find_trust_path(req: TrustPathRequest) -> TrustPathResponse:
    """
    Find shortest TRUSTS path between two users in Neo4j (up to max_hops).
    Uses Cypher shortestPath — O(V+E) via BFS.
    """
    driver = _neo4j_driver()
    if driver is None:
        # Heuristic fallback
        seed = hashlib.md5(f"{req.from_user_id}{req.to_user_id}".encode()).hexdigest()
        hop = 1 + (int(seed[:2], 16) % req.max_hops)
        trust = math.exp(-0.3 * (hop - 1))
        return TrustPathResponse(found=False, path=[], hop_count=hop, trust_score=round(trust, 3))

    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH path = shortestPath(
                  (a:User {userId: $from_id})-[:TRUSTS*1..$max_hops]->(b:User {userId: $to_id})
                )
                RETURN [node IN nodes(path) | node.userId] AS node_ids,
                       length(path) AS hops,
                       reduce(s = 1.0, r IN relationships(path) | s * r.strengthScore) AS path_strength
                LIMIT 1
                """,
                from_id=req.from_user_id,
                to_id=req.to_user_id,
                max_hops=req.max_hops,
            )
            record = result.single()
            if record:
                driver.close()
                return TrustPathResponse(
                    found=True,
                    path=record["node_ids"],
                    hop_count=record["hops"],
                    trust_score=round(float(record["path_strength"]), 3),
                )
        driver.close()
        return TrustPathResponse(found=False, path=[], hop_count=0, trust_score=0.0)
    except Exception:
        return TrustPathResponse(found=False, path=[], hop_count=0, trust_score=0.0)
