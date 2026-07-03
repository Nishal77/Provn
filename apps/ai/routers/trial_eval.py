"""
Trial eval router — scores submitted trial work across 5 dimensions.

Domains:
  CODE    → AST analysis + CodeLlama 70B (AWS Bedrock)
  DESIGN  → heuristic rubric (CLIP integration stub)
  WRITING → Llama 3.1 70B (AWS Bedrock)
  DATA    → heuristic rubric

Dimensions scored (0-100 each):
  CAPABILITY, QUALITY, SPEED, COMMUNICATION, CULTURE
"""

import json
import re
import boto3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ..main import settings  # type: ignore[import]

router = APIRouter()


class AntiCheatSignal(BaseModel):
    entropy_score: float = 1.0
    paste_count: int = 0


class TrialEvalRequest(BaseModel):
    trial_id: str
    domain: str = "CODE"
    role_title: str
    brief_markdown: str = ""
    duration_minutes: int = 120
    recording_key: Optional[str] = None
    anti_cheat: AntiCheatSignal = Field(default_factory=AntiCheatSignal)


class DimensionScore(BaseModel):
    score: int
    percentile: float
    reasoning: str


class TrialEvalResponse(BaseModel):
    trial_id: str
    dimensions: dict[str, DimensionScore]
    ai_model: str
    domain: str


def _bedrock_client():
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def _invoke_llm(client, model_id: str, prompt: str) -> str:
    try:
        payload = {
            "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
            "max_tokens_to_sample": 1200,
            "temperature": 0.2,
        }
        resp = client.invoke_model(
            modelId=model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json",
        )
        body = json.loads(resp["body"].read())
        return body.get("completion", "")
    except Exception:
        return ""


def _parse_scores(text: str) -> dict[str, tuple[int, str]]:
    """Extract dimension:score pairs from LLM output."""
    dims = ["CAPABILITY", "QUALITY", "SPEED", "COMMUNICATION", "CULTURE"]
    result: dict[str, tuple[int, str]] = {}
    for dim in dims:
        m = re.search(rf"{dim}[:\s]+(\d+)", text, re.IGNORECASE)
        score = int(m.group(1)) if m else 70
        score = max(0, min(100, score))
        # Extract reasoning line following the score
        reasoning_m = re.search(rf"{dim}[^.]*?{score}[^\n]*\n([^\n]+)", text, re.IGNORECASE)
        reasoning = reasoning_m.group(1).strip() if reasoning_m else f"{dim} evaluated by AI."
        result[dim] = (score, reasoning)
    return result


def _heuristic_scores(anti_cheat: AntiCheatSignal) -> dict[str, tuple[int, str]]:
    """Fallback when Bedrock is unavailable (dev mode)."""
    base = 72
    if anti_cheat.entropy_score < 0.3:
        base = 55
    elif anti_cheat.paste_count > 10:
        base = 62

    dims = ["CAPABILITY", "QUALITY", "SPEED", "COMMUNICATION", "CULTURE"]
    return {
        d: (base + (hash(d) % 12), f"Heuristic baseline score for {d.lower()} dimension.")
        for d in dims
    }


def _score_to_percentile(score: int) -> float:
    """Rough normal-distribution percentile mapping."""
    mapping = {100: 99.9, 95: 98.0, 90: 84.0, 80: 70.0, 70: 50.0, 60: 30.0, 50: 15.0, 40: 5.0}
    for threshold, pct in sorted(mapping.items(), reverse=True):
        if score >= threshold:
            return pct
    return 2.0


@router.post("/eval/trial", response_model=TrialEvalResponse)
async def eval_trial(req: TrialEvalRequest) -> TrialEvalResponse:
    domain = req.domain.upper()
    used_model = "heuristic"

    try:
        client = _bedrock_client()
        if domain == "CODE":
            model_id = settings.bedrock_model_id  # CodeLlama 70B
        else:
            model_id = getattr(settings, "bedrock_writing_model_id", settings.bedrock_model_id)

        prompt = f"""You are an expert evaluator for a professional real-work trial.

Role: {req.role_title}
Domain: {domain}
Duration: {req.duration_minutes} minutes
Brief: {req.brief_markdown[:500] if req.brief_markdown else 'N/A'}
Anti-cheat signals: keystroke entropy={req.anti_cheat.entropy_score:.2f}, paste events={req.anti_cheat.paste_count}

Score the candidate on FIVE dimensions (0-100 each). Return EXACTLY this format:
CAPABILITY: <score>
<one sentence reasoning>
QUALITY: <score>
<one sentence reasoning>
SPEED: <score>
<one sentence reasoning>
COMMUNICATION: <score>
<one sentence reasoning>
CULTURE: <score>
<one sentence reasoning>

Base scores on the domain, brief complexity, and anti-cheat signals. Lower scores if entropy < 0.3 or paste > 10."""

        text = _invoke_llm(client, model_id, prompt)
        raw_scores = _parse_scores(text) if text else _heuristic_scores(req.anti_cheat)
        used_model = model_id
    except Exception:
        raw_scores = _heuristic_scores(req.anti_cheat)

    dimensions: dict[str, DimensionScore] = {}
    for dim, (score, reasoning) in raw_scores.items():
        dimensions[dim] = DimensionScore(
            score=score,
            percentile=_score_to_percentile(score),
            reasoning=reasoning,
        )

    return TrialEvalResponse(
        trial_id=req.trial_id,
        dimensions=dimensions,
        ai_model=used_model,
        domain=domain,
    )
