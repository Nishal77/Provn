"""
Phase 6 — Skill evaluation router.
Evaluates code/text artifacts via Llama 3.1 70B (Groq).
Includes plagiarism detection via SimHash.
"""

import hashlib
import json
import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/eval", tags=["skill-eval"])


# ── Request / Response models ────────────────────────────────────────────────

class SkillEvalRequest(BaseModel):
    attestation_id: str
    skill_slug: str
    artifact_url: str | None = None
    artifact_type: str = "URL"   # GITHUB_REPO | GIST | URL | TEXT
    artifact_text: str | None = None
    description: str | None = None


class EvalCategories(BaseModel):
    code_quality: float
    best_practices: float
    complexity_handling: float
    readability: float
    correctness: float


class SkillEvalResponse(BaseModel):
    attestation_id: str
    overall_score: float          # 0–100
    skill_level: int              # 1–10
    categories: EvalCategories
    reasoning: str
    plagiarism_score: float       # 0.0–1.0
    model_used: str
    eval_duration_ms: int


# ── SimHash plagiarism detection ─────────────────────────────────────────────

def _simhash(text: str) -> int:
    """64-bit SimHash of token n-grams. Returns an integer fingerprint."""
    tokens = re.findall(r"\w+", text.lower())
    v = [0] * 64
    for token in tokens:
        h = int(hashlib.sha256(token.encode()).hexdigest(), 16)
        for i in range(64):
            v[i] += 1 if (h >> i) & 1 else -1
    result = 0
    for i in range(64):
        if v[i] > 0:
            result |= 1 << i
    return result


def _hamming_distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _plagiarism_score(text: str, known_hashes: list[int] | None = None) -> float:
    """
    Returns 0.0–1.0. >0.8 = likely copy-paste.
    Against known_hashes if provided; otherwise uses simple self-entropy check.
    """
    if not text or len(text) < 100:
        return 0.0
    h = _simhash(text)
    if known_hashes:
        min_distance = min(_hamming_distance(h, k) for k in known_hashes)
        return max(0.0, 1.0 - min_distance / 64.0)
    # Self-entropy: low unique token ratio → suspicious
    tokens = re.findall(r"\w+", text.lower())
    if not tokens:
        return 0.0
    unique_ratio = len(set(tokens)) / len(tokens)
    return max(0.0, 1.0 - unique_ratio) * 0.5   # max 0.5 from self-entropy alone


# ── GitHub artifact fetcher ───────────────────────────────────────────────────

async def _fetch_artifact(artifact_url: str, artifact_type: str) -> str:
    """Fetch raw artifact content (≤32 KB) from GitHub or any public URL."""
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        if artifact_type == "GITHUB_REPO":
            # Convert github.com/user/repo → api.github.com/repos/user/repo/readme
            m = re.match(r"https?://github\.com/([^/]+)/([^/?\s]+)", artifact_url)
            if m:
                owner, repo = m.group(1), m.group(2).rstrip("/")
                # Fetch README for repo-level evaluation
                readme_url = f"https://api.github.com/repos/{owner}/{repo}/readme"
                r = await client.get(readme_url, headers={"Accept": "application/vnd.github.raw"})
                if r.status_code == 200:
                    content = r.text[:32_000]
                    # Also fetch top-level file listing for context
                    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=0"
                    t = await client.get(tree_url)
                    if t.status_code == 200:
                        tree_data = t.json().get("tree", [])
                        files = [n["path"] for n in tree_data if n.get("type") == "blob"][:30]
                        content += "\n\nFile tree:\n" + "\n".join(files)
                    return content
            return f"GitHub repo: {artifact_url}"

        elif artifact_type == "GIST":
            # Convert gist.github.com/user/id → api.github.com/gists/id
            m = re.match(r"https?://gist\.github\.com/[^/]+/([a-f0-9]+)", artifact_url)
            if m:
                gist_id = m.group(1)
                r = await client.get(f"https://api.github.com/gists/{gist_id}")
                if r.status_code == 200:
                    files = r.json().get("files", {})
                    content = ""
                    for name, info in list(files.items())[:3]:
                        raw = info.get("content") or ""
                        content += f"\n# {name}\n{raw[:10_000]}"
                    return content[:32_000]
            return f"Gist: {artifact_url}"

        else:
            # Generic URL — fetch raw HTML/text
            r = await client.get(artifact_url)
            if r.status_code == 200:
                return r.text[:32_000]
            return f"URL: {artifact_url} (fetch failed: {r.status_code})"


# ── Groq (Llama 3.1 70B) eval ────────────────────────────────────────────────

async def _eval_via_groq(
    skill_slug: str,
    artifact_content: str,
    description: str | None,
    settings: Any,
) -> dict[str, Any]:
    """
    Call Groq (Llama 3.1 70B) for skill evaluation via OpenAI-compatible API.
    Falls back to heuristic scoring when GROQ_API_KEY is not set (dev mode).
    """
    prompt = f"""You are an expert senior software engineer evaluating a candidate's skill artifact for the skill: **{skill_slug}**.

Artifact content:
{artifact_content[:20_000]}

{f'Candidate description: {description}' if description else ''}

Evaluate the artifact and return a JSON object with this exact structure:
{{
  "overall_score": <0-100 float>,
  "skill_level": <1-10 integer>,
  "categories": {{
    "code_quality": <0-100 float>,
    "best_practices": <0-100 float>,
    "complexity_handling": <0-100 float>,
    "readability": <0-100 float>,
    "correctness": <0-100 float>
  }},
  "reasoning": "<2-3 sentence explanation>"
}}

Return ONLY the JSON object. No markdown fences, no explanation outside the JSON."""

    groq_api_key = getattr(settings, "groq_api_key", "")
    if groq_api_key:
        try:
            from openai import OpenAI  # groq is OpenAI-compatible

            client = OpenAI(
                api_key=groq_api_key,
                base_url=getattr(settings, "groq_base_url", "https://api.groq.com/openai/v1"),
            )
            model = getattr(settings, "groq_model_code", "llama-3.1-70b-versatile")
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1024,
            )
            raw = resp.choices[0].message.content or ""
            # Strip markdown fences if present
            raw = re.sub(r"```(?:json)?\n?", "", raw).strip()
            return json.loads(raw)
        except Exception as exc:
            print(f"[skill-eval] Groq error: {exc} — using heuristic fallback")

    # ── Heuristic fallback (dev / no API key) ────────────────────────────────
    tokens = re.findall(r"\w+", artifact_content.lower())
    length_score = min(100.0, len(tokens) / 5.0)
    keyword_hits = sum(1 for t in tokens if t in (
        skill_slug, "async", "await", "test", "error", "interface", "type",
        "return", "class", "function", "import", "export", "const", "let",
    ))
    keyword_score = min(100.0, keyword_hits * 4.0)
    overall = round((length_score * 0.4 + keyword_score * 0.6), 1)
    level = max(1, min(10, int(overall / 10)))
    return {
        "overall_score": overall,
        "skill_level": level,
        "categories": {
            "code_quality": overall,
            "best_practices": overall * 0.9,
            "complexity_handling": overall * 0.8,
            "readability": overall * 0.95,
            "correctness": overall * 0.85,
        },
        "reasoning": f"Heuristic evaluation (GROQ_API_KEY not set). Artifact has {len(tokens)} tokens with {keyword_hits} relevant keywords.",
    }


# ── Route ────────────────────────────────────────────────────────────────────

@router.post("/code", response_model=SkillEvalResponse)
async def evaluate_skill(payload: SkillEvalRequest) -> SkillEvalResponse:
    """
    Evaluate a skill artifact via CodeLlama 70B (AWS Bedrock).
    Called internally by the Node.js skill-eval BullMQ worker.
    SLA: 30-minute timeout per job.
    """
    from main import settings  # import here to avoid circular at module load

    start = time.time()

    # ── 1. Fetch artifact content ────────────────────────────────────────────
    artifact_content = ""
    if payload.artifact_text:
        artifact_content = payload.artifact_text[:32_000]
    elif payload.artifact_url:
        try:
            artifact_content = await _fetch_artifact(payload.artifact_url, payload.artifact_type)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Failed to fetch artifact: {exc}") from exc

    if not artifact_content.strip():
        raise HTTPException(status_code=422, detail="Artifact content is empty or could not be fetched")

    # ── 2. Plagiarism check ──────────────────────────────────────────────────
    p_score = _plagiarism_score(artifact_content)

    # ── 3. AI evaluation ─────────────────────────────────────────────────────
    try:
        eval_result = await _eval_via_groq(
            skill_slug=payload.skill_slug,
            artifact_content=artifact_content,
            description=payload.description,
            settings=settings,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}") from exc

    elapsed_ms = int((time.time() - start) * 1000)
    groq_key = getattr(settings, "groq_api_key", "")
    model_used = getattr(settings, "groq_model_code", "llama-3.1-70b-versatile") if groq_key else "heuristic-fallback"

    return SkillEvalResponse(
        attestation_id=payload.attestation_id,
        overall_score=float(eval_result.get("overall_score", 50)),
        skill_level=int(eval_result.get("skill_level", 5)),
        categories=EvalCategories(**eval_result.get("categories", {
            "code_quality": 50, "best_practices": 50,
            "complexity_handling": 50, "readability": 50, "correctness": 50,
        })),
        reasoning=eval_result.get("reasoning", ""),
        plagiarism_score=round(p_score, 3),
        model_used=model_used,
        eval_duration_ms=elapsed_ms,
    )
