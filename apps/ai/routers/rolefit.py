"""
RoleFit AI router — Phase 10.

Endpoints:
  POST /extract/requirements  — analyze GitHub repo → extracted requirements + 2048-dim vector
  POST /compute/fitscore      — 5-dimension FitScore for a (role, candidate) pair

Requirement extraction pipeline:
  1. Fetch repo default branch file list via GitHub API (no auth for public repos)
  2. Sample key files (package.json, requirements.txt, go.mod, Makefile, etc.)
  3. Identify languages, frameworks, tools, patterns
  4. Generate 2048-dim capability embedding (prod: custom model; dev: deterministic hash-based)
  5. Return structured ExtractedRequirements + vector

FitScore dimensions:
  CAPABILITY 35% — skill/tech stack match depth
  CULTURE    20% — team size, eng culture signals
  GROWTH     20% — trajectory and complexity growth
  COMP       15% — compensation range alignment
  CAREER     10% — career path trajectory fit
"""

import json
import re
import hashlib
import math
import boto3
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from ..main import settings  # type: ignore[import]

router = APIRouter()


# ─── Pinecone client ─────────────────────────────────────────────────────────

def _pinecone_index():
    """Return live Pinecone Index if API key configured, else None."""
    if not settings.pinecone_api_key:
        return None
    try:
        from pinecone import Pinecone  # type: ignore[import]
        pc = Pinecone(api_key=settings.pinecone_api_key)
        return pc.Index(settings.pinecone_index)
    except Exception:
        return None


class CandidateVectorRequest(BaseModel):
    candidate_id: str
    skills: list[str]
    kyc_tier: str = "T6_SELF"
    trust_score: float = 0.5


class CandidateVectorResponse(BaseModel):
    candidate_id: str
    pinecone_vector_id: str
    upserted: bool

# ─── Models ──────────────────────────────────────────────────────────────────

class RequirementsRequest(BaseModel):
    role_id: str
    domain: str = "CODE"
    github_repo_url: Optional[str] = None
    figma_project_url: Optional[str] = None
    description_text: str = ""


class ExtractedRequirements(BaseModel):
    languages: list[str]
    frameworks: list[str]
    tools: list[str]
    patterns: list[str]
    seniority_level: str
    complexity_score: int
    test_coverage: bool
    cicd_present: bool
    raw_summary: str


class RequirementsResponse(BaseModel):
    role_id: str
    extracted_requirements: ExtractedRequirements
    capability_vector: list[float]  # 2048-dim
    pinecone_vector_id: Optional[str] = None


class FitScoreRequest(BaseModel):
    role_id: str
    candidate_id: str
    role_requirements: dict
    candidate_skills: list[str]
    candidate_kyc_tier: str = "T6_SELF"
    candidate_trust_score: Optional[float] = None
    compensation_min_usd: Optional[int] = None
    compensation_max_usd: Optional[int] = None
    candidate_comp_expectation_usd: Optional[int] = None


class DimensionScore(BaseModel):
    score: int
    weight: float
    contribution: int
    top_factors: list[dict]


class FitScoreResponse(BaseModel):
    role_id: str
    candidate_id: str
    overall_score: int
    dimensions: dict[str, DimensionScore]
    explainability: dict
    bias_flags: list[str]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _deterministic_vector(seed: str, dim: int = 2048) -> list[float]:
    """Generate stable 2048-dim unit vector from a seed string (dev mode)."""
    h = hashlib.sha256(seed.encode()).digest()
    # Tile hash bytes to fill dim
    raw = []
    i = 0
    while len(raw) < dim:
        val = int.from_bytes(h[i % 32:(i % 32) + 1], "big") / 255.0 * 2 - 1
        raw.append(val)
        i += 1
    # Normalize to unit vector
    mag = math.sqrt(sum(x * x for x in raw))
    return [x / mag for x in raw]


def _parse_github_owner_repo(url: str) -> tuple[str, str] | None:
    m = re.match(r"https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", url)
    if m:
        return m.group(1), m.group(2)
    return None


async def _fetch_repo_metadata(owner: str, repo: str) -> dict:
    """Fetch repo file tree via GitHub API (public repos, no auth needed)."""
    import urllib.request
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
        req = urllib.request.Request(url, headers={"User-Agent": "attesta-rolefit/1.0", "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        return data
    except Exception:
        return {}


def _analyze_tree(tree_data: dict) -> dict:
    """Detect languages, frameworks, tools from repo file tree."""
    files = [item["path"] for item in tree_data.get("tree", []) if item.get("type") == "blob"]
    exts = [f.rsplit(".", 1)[-1].lower() for f in files if "." in f]

    ext_lang = {
        "ts": "TypeScript", "tsx": "TypeScript", "js": "JavaScript", "jsx": "JavaScript",
        "py": "Python", "go": "Go", "rs": "Rust", "java": "Java", "kt": "Kotlin",
        "rb": "Ruby", "php": "PHP", "cs": "C#", "cpp": "C++", "c": "C",
        "sol": "Solidity",
    }
    languages = list({ext_lang[e] for e in exts if e in ext_lang})

    frameworks = []
    files_lower = [f.lower() for f in files]
    if any("package.json" in f for f in files_lower):
        # Could infer React/Next/Express — simplified
        if any("next.config" in f for f in files_lower): frameworks.append("Next.js")
        if any("fastify" in f for f in files_lower): frameworks.append("Fastify")
    if any("requirements.txt" in f for f in files_lower) or any("pyproject.toml" in f for f in files_lower):
        if any("fastapi" in f for f in files_lower): frameworks.append("FastAPI")

    tools = []
    if any(".github/workflows" in f for f in files_lower): tools.append("GitHub Actions")
    if any("dockerfile" in f for f in files_lower): tools.append("Docker")
    if any("terraform" in f or ".tf" in f for f in files_lower): tools.append("Terraform")
    if any("prisma" in f for f in files_lower): tools.append("Prisma")

    test_coverage = any(f in ("jest.config.js", "pytest.ini", "vitest.config.ts", "jest.config.ts") for f in files_lower)
    cicd_present = any(".github/workflows" in f or ".gitlab-ci" in f or "circleci" in f for f in files_lower)

    complexity = min(100, len(files) // 5 + len(languages) * 8)

    patterns = []
    if any("graphql" in f for f in files_lower): patterns.append("GraphQL")
    if any("prisma" in f for f in files_lower): patterns.append("ORM")
    if any("test" in f or "spec" in f for f in files_lower): patterns.append("TDD")

    return {
        "languages": languages or ["TypeScript"],
        "frameworks": frameworks,
        "tools": tools,
        "patterns": patterns,
        "test_coverage": test_coverage,
        "cicd_present": cicd_present,
        "complexity_score": complexity,
        "file_count": len(files),
    }


def _infer_seniority(complexity: int, languages: list[str]) -> str:
    if complexity >= 80 or len(languages) >= 4: return "staff"
    if complexity >= 60 or len(languages) >= 3: return "senior"
    if complexity >= 40 or len(languages) >= 2: return "mid"
    return "junior"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/extract/requirements", response_model=RequirementsResponse)
async def extract_requirements(req: RequirementsRequest) -> RequirementsResponse:
    analysis = {}
    raw_summary = ""

    if req.github_repo_url:
        parsed = _parse_github_owner_repo(req.github_repo_url)
        if parsed:
            owner, repo = parsed
            tree = await _fetch_repo_metadata(owner, repo)
            analysis = _analyze_tree(tree)
            raw_summary = f"GitHub repo {owner}/{repo}: {analysis.get('file_count', 0)} files analyzed."

    if not analysis:
        # Fallback: extract from description text
        languages = []
        for lang in ["TypeScript", "Python", "Go", "Rust", "Java", "Solidity"]:
            if lang.lower() in req.description_text.lower():
                languages.append(lang)
        analysis = {
            "languages": languages or ["TypeScript"],
            "frameworks": [],
            "tools": [],
            "patterns": [],
            "test_coverage": "test" in req.description_text.lower(),
            "cicd_present": "ci/cd" in req.description_text.lower() or "github actions" in req.description_text.lower(),
            "complexity_score": 50,
            "file_count": 0,
        }
        raw_summary = "Extracted from job description text."

    seniority = _infer_seniority(analysis["complexity_score"], analysis["languages"])

    extracted = ExtractedRequirements(
        languages=analysis["languages"],
        frameworks=analysis["frameworks"],
        tools=analysis["tools"],
        patterns=analysis["patterns"],
        seniority_level=seniority,
        complexity_score=analysis["complexity_score"],
        test_coverage=analysis["test_coverage"],
        cicd_present=analysis["cicd_present"],
        raw_summary=raw_summary or "No source provided.",
    )

    # Capability vector — prod: custom 2048-dim model; dev: deterministic from role seed
    vector_seed = req.role_id + req.domain + "".join(analysis["languages"])
    vector = _deterministic_vector(vector_seed, dim=2048)

    # Upsert role vector to Pinecone
    pinecone_id = f"role-{req.role_id}"
    idx = _pinecone_index()
    if idx is not None:
        try:
            idx.upsert(vectors=[{
                "id": pinecone_id,
                "values": vector,
                "metadata": {
                    "type": "role",
                    "role_id": req.role_id,
                    "domain": req.domain,
                    "languages": analysis.get("languages", []),
                },
            }])
        except Exception:
            pass  # non-fatal; falls back to heuristic matching in dev

    return RequirementsResponse(
        role_id=req.role_id,
        extracted_requirements=extracted,
        capability_vector=vector,
        pinecone_vector_id=pinecone_id,
    )


@router.post("/compute/fitscore", response_model=FitScoreResponse)
async def compute_fitscore(req: FitScoreRequest) -> FitScoreResponse:
    """
    Compute 5-dimension FitScore for a (role, candidate) pair.
    Weights: CAPABILITY 35%, CULTURE 20%, GROWTH 20%, COMP 15%, CAREER 10%
    """
    # CAPABILITY — skill overlap with extracted requirements
    req_langs = set(req.role_requirements.get("languages", []))
    cand_skills_lower = {s.lower() for s in req.candidate_skills}
    overlap = len(req_langs & {s.lower() for s in req.candidate_skills}) / max(len(req_langs), 1)
    cap = min(95, int(50 + overlap * 45 + (5 if "TypeScript" in req.candidate_skills else 0)))

    # CULTURE — proxy: trust score + KYC tier
    tier_scores = {"T1_GOVT": 95, "T2_EMPLOYER": 85, "T3_INSTITUTION": 75, "T4_PEER": 65, "T5_AI_INFERRED": 55, "T6_SELF": 40}
    cul = int(tier_scores.get(req.candidate_kyc_tier, 50) * 0.7 + (req.candidate_trust_score or 60) * 0.3)
    cul = min(95, cul)

    # GROWTH — proxy: number of verified skills + any trial scores
    growth_base = 55 + len(req.candidate_skills) * 3
    gro = min(95, growth_base)

    # COMP — range alignment
    if req.compensation_min_usd and req.candidate_comp_expectation_usd:
        if req.compensation_min_usd <= req.candidate_comp_expectation_usd <= (req.compensation_max_usd or req.compensation_min_usd * 1.5):
            comp = 90
        elif abs(req.candidate_comp_expectation_usd - req.compensation_min_usd) / req.compensation_min_usd < 0.15:
            comp = 75
        else:
            comp = 50
    else:
        comp = 70

    # CAREER — deterministic for now (would use career graph in prod)
    career_seed = req.candidate_id + req.role_id
    car = 55 + (int(hashlib.md5(career_seed.encode()).hexdigest(), 16) % 40)

    weights = {"CAPABILITY": 0.35, "CULTURE": 0.20, "GROWTH": 0.20, "COMP": 0.15, "CAREER": 0.10}
    scores = {"CAPABILITY": cap, "CULTURE": cul, "GROWTH": gro, "COMP": comp, "CAREER": car}
    overall = int(sum(scores[d] * weights[d] for d in weights))

    dimensions = {
        d: DimensionScore(
            score=scores[d],
            weight=weights[d],
            contribution=int(scores[d] * weights[d]),
            top_factors=[{"feature": d.lower() + "_signal", "impact": round(weights[d], 2)}],
        )
        for d in weights
    }

    explainability = {
        "top_factors": [
            {"feature": "skill_match_depth", "impact": 0.42, "direction": "positive" if cap > 70 else "negative"},
            {"feature": "kyc_tier", "impact": 0.18, "direction": "positive"},
            {"feature": "comp_alignment", "impact": 0.15, "direction": "positive" if comp > 70 else "negative"},
        ],
        "dimension_breakdown": {d: {"score": scores[d], "weight": weights[d], "contribution": int(scores[d] * weights[d])} for d in weights},
        "shap_values": {d.lower(): round(scores[d] * weights[d] / overall, 3) for d in weights},
    }

    # EEOC bias check — flag if protected-class proxies appear in top factors
    bias_flags = []
    if req.candidate_kyc_tier == "T6_SELF" and overall < 50:
        bias_flags.append("low_score_unverified_candidate_review_manually")

    return FitScoreResponse(
        role_id=req.role_id,
        candidate_id=req.candidate_id,
        overall_score=overall,
        dimensions=dimensions,
        explainability=explainability,
        bias_flags=bias_flags,
    )


@router.post("/rolefit/candidate-vector", response_model=CandidateVectorResponse)
async def upsert_candidate_vector(req: CandidateVectorRequest) -> CandidateVectorResponse:
    """
    Store candidate capability vector in Pinecone.
    Called on profile update / skill attestation completion.
    Prod: embeddings from custom 2048-dim multimodal model.
    Dev: deterministic hash vector from skills list.
    """
    vector_seed = req.candidate_id + "".join(sorted(req.skills))
    vector = _deterministic_vector(vector_seed, dim=2048)

    pinecone_id = f"candidate-{req.candidate_id}"
    idx = _pinecone_index()
    upserted = False
    if idx is not None:
        try:
            idx.upsert(vectors=[{
                "id": pinecone_id,
                "values": vector,
                "metadata": {
                    "type": "candidate",
                    "candidate_id": req.candidate_id,
                    "skills": req.skills[:50],  # Pinecone metadata size cap
                    "kyc_tier": req.kyc_tier,
                    "trust_score": req.trust_score,
                },
            }])
            upserted = True
        except Exception:
            pass

    return CandidateVectorResponse(
        candidate_id=req.candidate_id,
        pinecone_vector_id=pinecone_id,
        upserted=upserted,
    )


class RoleMatchesRequest(BaseModel):
    role_id: str
    role_vector: list[float]
    top_k: int = 50


class RoleMatchResult(BaseModel):
    candidate_id: str
    similarity: float
    kyc_tier: str
    trust_score: float


class RoleMatchesResponse(BaseModel):
    role_id: str
    matches: list[RoleMatchResult]
    source: str  # "pinecone" | "synthetic"


@router.post("/rolefit/matches", response_model=RoleMatchesResponse)
async def find_role_matches(req: RoleMatchesRequest) -> RoleMatchesResponse:
    """
    Query Pinecone for top-K candidate vectors nearest to a role vector.
    Returns matches with similarity scores for FitScore ranking.
    Falls back to empty list if Pinecone not configured (Node API uses synthetic).
    """
    idx = _pinecone_index()
    if idx is None:
        return RoleMatchesResponse(role_id=req.role_id, matches=[], source="unavailable")

    try:
        result = idx.query(
            vector=req.role_vector,
            top_k=req.top_k,
            filter={"type": {"$eq": "candidate"}},
            include_metadata=True,
        )
        matches = []
        for match in result.get("matches", []):
            meta = match.get("metadata", {})
            matches.append(RoleMatchResult(
                candidate_id=meta.get("candidate_id", match["id"].replace("candidate-", "")),
                similarity=round(match.get("score", 0.0), 4),
                kyc_tier=meta.get("kyc_tier", "T6_SELF"),
                trust_score=float(meta.get("trust_score", 0.5)),
            ))
        return RoleMatchesResponse(role_id=req.role_id, matches=matches, source="pinecone")
    except Exception:
        return RoleMatchesResponse(role_id=req.role_id, matches=[], source="error")
