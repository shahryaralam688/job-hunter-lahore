import hashlib
import time
from typing import Any, Dict, Optional

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import SUPABASE_ANON_KEY, SUPABASE_URL

_bearer_scheme = HTTPBearer(auto_error=False)
_TOKEN_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 30.0


def is_supabase_auth_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY)


def _token_cache_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def verify_supabase_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or not is_supabase_auth_configured():
        return None

    now = time.monotonic()
    key = _token_cache_key(token)
    cached = _TOKEN_CACHE.get(key)
    if cached and cached[0] > now:
        return cached[1]

    url = f"{SUPABASE_URL}/auth/v1/user"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url, headers=headers)
        if res.status_code != 200:
            _TOKEN_CACHE.pop(key, None)
            return None
        user_data = res.json()
        if not isinstance(user_data, dict) or not user_data.get("id"):
            return None
        _TOKEN_CACHE[key] = (now + _CACHE_TTL_SECONDS, user_data)
        if len(_TOKEN_CACHE) > 512:
            expired = [k for k, (exp, _) in _TOKEN_CACHE.items() if exp <= now]
            for k in expired:
                _TOKEN_CACHE.pop(k, None)
        return user_data
    except Exception:
        return None


async def require_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[Dict[str, Any]]:
    if not is_supabase_auth_configured():
        # Local dev fallback when Supabase env vars are not configured
        return None

    token = credentials.credentials if credentials else None
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
        )

    user = await verify_supabase_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again.",
        )
    return user
