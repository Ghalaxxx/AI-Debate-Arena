"""WebSocket endpoint for live debates.

The concrete connection manager is added in the WebSocket phase.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()
