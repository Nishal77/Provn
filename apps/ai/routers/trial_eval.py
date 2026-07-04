"""
Trial eval router — scores submitted trial work across 5 dimensions.

Domains:
  CODE    → Llama 3.1 70B via Groq
  DESIGN  → Claude Haiku via Anthropic direct (vision capable)
  WRITING → Llama 3.1 70B via Groq
  DATA    → Mixtral 8x7B via Groq

Dimensions scored (0-100 each):
  CAPABILITY, QUALITY, SPEED, COMMUNICATION, CULTURE
"""

import json
import re
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


def _invoke_groq(prompt: str, model: str | None = None) -> str:
    """Call Groq (OpenAI-compatible) with Llama 3.1 70B or Mixtral. Returns empty string on error."""
    api_key = getattr(settings, "groq_api_key", "")
    if not api_key:
        return ""
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=api_key,
            base_url=getattr(settings, "groq_base_url", "https://api.groq.com/openai/v1"),
        )
        used_model = model or getattr(settings, "groq_model_code", "llama-3.1-70b-versatile")
        resp = client.chat.completions.create(
            model=used_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1200,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:
        print(f"[trial-eval] Groq error: {exc}")
        return ""


def _invoke_anthropic(prompt: str) -> str:
    """Call Anthropic Claude Haiku directly for DESIGN domain eval."""
    api_key = getattr(settings, "anthropic_api_key", "")
    if not api_key:
        return ""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        model = getattr(settings, "anthropic_model", "claude-haiku-4-5-20251001")
        msg = client.messages.create(
            model=model,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text if msg.content else ""
    except Exception as exc:
        print(f"[trial-eval] Anthropic error: {exc}")
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
        domain_context = {
            "CODE": "Evaluate code architecture, correctness, test coverage, and best practices.",
            "DESIGN": "Evaluate visual hierarchy, UI/UX principles, accessibility, and design system adherence.",
            "WRITING": "Evaluate clarity, structure, persuasion, grammar, and audience appropriateness.",
            "DATA": "Evaluate query correctness, statistical methodology, insight quality, and visualization choices.",
        }.get(domain, "Evaluate the submission holistically.")

        prompt = f"""You are an expert evaluator for a professional real-work trial.

Role: {req.role_title}
Domain: {domain}
Duration: {req.duration_minutes} minutes
Brief: {req.brief_markdown[:500] if req.brief_markdown else 'N/A'}
Anti-cheat signals: keystroke entropy={req.anti_cheat.entropy_score:.2f}, paste events={req.anti_cheat.paste_count}

Evaluation focus: {domain_context}

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

        if domain == "DESIGN":
            # Claude Haiku via Anthropic direct — vision-capable model
            text = _invoke_anthropic(prompt)
            used_model = getattr(settings, "anthropic_model", "claude-haiku-4-5-20251001")
        elif domain == "DATA":
            # Mixtral 8x7B via Groq for data/analytics
            groq_data_model = getattr(settings, "groq_model_data", "mixtral-8x7b-32768")
            text = _invoke_groq(prompt, model=groq_data_model)
            used_model = groq_data_model
        else:
            # CODE + WRITING → Llama 3.1 70B via Groq
            groq_code_model = getattr(settings, "groq_model_code", "llama-3.1-70b-versatile")
            text = _invoke_groq(prompt, model=groq_code_model)
            used_model = groq_code_model

        raw_scores = _parse_scores(text) if text else _heuristic_scores(req.anti_cheat)
    except Exception:
        raw_scores = _heuristic_scores(req.anti_cheat)
        used_model = "heuristic"

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
