import asyncio
from typing import Any, List, Optional

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, GEMINI_MODEL


def get_fallback_models() -> List[str]:
    candidates = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-2.5-flash-lite"]
    seen = set()
    ordered = []
    for m in candidates:
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)
    return ordered


async def generate_with_fallback(
    contents: str,
    system_instruction: str,
    response_schema: Any = None,
    temperature: float = 0.2,
    timeout_seconds: float = 20.0,
) -> Optional[str]:
    """Call Gemini with short timeout, quick backoff, and automatic model fallback on 503/429."""
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        return None

    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
    )

    cfg_kwargs = {
        "system_instruction": system_instruction,
        "response_mime_type": "application/json",
        "temperature": temperature,
    }
    if response_schema is not None:
        cfg_kwargs["response_schema"] = response_schema
    cfg = types.GenerateContentConfig(**cfg_kwargs)

    last_err: Optional[Exception] = None
    for model_name in get_fallback_models():
        for attempt in range(2):
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=model_name,
                        contents=contents,
                        config=cfg,
                    ),
                    timeout=timeout_seconds + 2.0,
                )
                if resp and resp.text:
                    return resp.text
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                last_err = exc
                err_str = str(exc)
                # Fast backoff on transient 503/429/timeout before switching model
                if attempt == 0 and any(code in err_str for code in ("503", "429", "UNAVAILABLE", "timeout", "Timeout")):
                    await asyncio.sleep(1.2)
                    continue
                break

    if last_err:
        raise last_err
    return None
