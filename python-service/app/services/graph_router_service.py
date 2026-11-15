"""
FX reference rates do not prove that payment rails or intermediate legs are
available. Route discovery stays disabled until an execution provider supplies
current, leg-by-leg quotes and corridor availability.
"""

from typing import Any, Dict, Optional


class SmartFXRouter:
    def find_optimal_route(
        self,
        source_curr: str,
        target_curr: str,
        max_latency_sec: int = 300,
    ) -> Optional[Dict[str, Any]]:
        return None

    def check_arbitrage_cycle(self) -> Optional[bool]:
        return None


smart_fx_router = SmartFXRouter()
