"""
Smart Multi-Hop FX & Settlement Graph Router using Dijkstra's & Bellman-Ford Algorithms.
Converts conversion yield optimization into a shortest path problem using negative log edge weights:
W(u, v) = -ln((1 - Fee_uv) * Rate_uv)
"""

import math
from typing import Dict, List, Any, Optional
import networkx as nx

# Benchmark cross-currency mid-market rates and conversion fees
BENCHMARK_RATES = {
    ('USD', 'EUR'): 0.92,
    ('EUR', 'USD'): 1.087,
    ('USD', 'GBP'): 0.79,
    ('GBP', 'USD'): 1.265,
    ('USD', 'INR'): 87.20,
    ('INR', 'USD'): 0.01146,
    ('USD', 'AED'): 3.6725,
    ('AED', 'USD'): 0.2723,
    ('USD', 'SGD'): 1.345,
    ('SGD', 'USD'): 0.7435,
    ('USD', 'AUD'): 1.515,
    ('AUD', 'USD'): 0.66,
    ('USD', 'CAD'): 1.36,
    ('CAD', 'USD'): 0.735,
    ('USD', 'JPY'): 152.4,
    ('JPY', 'USD'): 0.00656,
    
    # Regional liquid corridors
    ('EUR', 'GBP'): 0.858,
    ('GBP', 'EUR'): 1.165,
    ('EUR', 'INR'): 94.80,
    ('INR', 'EUR'): 0.01055,
    ('GBP', 'INR'): 110.35,
    ('INR', 'GBP'): 0.00906,
    ('SGD', 'INR'): 64.85,
    ('INR', 'SGD'): 0.01542,
    ('AED', 'INR'): 23.74,
    ('INR', 'AED'): 0.0421,
    ('AUD', 'JPY'): 100.6,
    ('JPY', 'AUD'): 0.00994,
}

class SmartFXRouter:
    def __init__(self):
        self.graph = nx.DiGraph()
        self._build_default_graph()

    def _build_default_graph(self):
        """Constructs the base multi-rail liquidity graph across 9 global currencies."""
        self.graph.clear()
        
        # Add primary conversion corridors
        for (u, v), rate in BENCHMARK_RATES.items():
            fee = 0.0015  # 15 bps base conversion fee
            latency = 2   # 2 seconds typical clearing hop
            self.add_conversion_rail(u, v, rate, fee, latency)

    def add_conversion_rail(self, source: str, target: str, rate: float, fee_percentage: float, latency_sec: int):
        """
        Adds a directed conversion rail.
        Weight = -ln((1 - fee) * rate) to turn rate multiplication into weight addition.
        """
        effective_yield = (1.0 - fee_percentage) * rate
        weight = -math.log(effective_yield) if effective_yield > 0 else float('inf')
        
        self.graph.add_edge(
            source.upper(),
            target.upper(),
            rate=rate,
            fee=fee_percentage,
            weight=weight,
            latency=latency_sec
        )

    def update_live_rates(self, live_rates: Dict[str, float], base: str = 'USD'):
        """Dynamically updates graph edges with real-time API rates."""
        base = base.upper()
        for curr, rate in live_rates.items():
            curr = curr.upper()
            if curr != base and rate > 0:
                self.add_conversion_rail(base, curr, rate, 0.0012, 1)
                self.add_conversion_rail(curr, base, 1.0 / rate, 0.0015, 2)

    def find_optimal_route(self, source_curr: str, target_curr: str, max_latency_sec: int = 300) -> Optional[Dict[str, Any]]:
        """
        Calculates the mathematically optimal single or multi-hop path using Dijkstra's algorithm.
        """
        u_src = source_curr.upper()
        v_tgt = target_curr.upper()

        if u_src == v_tgt:
            return {
                "path": [u_src],
                "effective_rate": 1.0,
                "net_fee_percentage": 0.0,
                "estimated_latency_seconds": 0,
                "is_multi_hop": False,
                "hop_count": 0,
                "hops": []
            }

        try:
            # Dijkstra path search on negative-log weights
            path = nx.dijkstra_path(self.graph, u_src, v_tgt, weight='weight')
            
            total_fee_factor = 1.0
            effective_rate = 1.0
            total_latency = 0
            hops = []

            for i in range(len(path) - 1):
                from_c, to_c = path[i], path[i+1]
                edge = self.graph[from_c][to_c]
                effective_rate *= edge['rate']
                total_fee_factor *= (1.0 - edge['fee'])
                total_latency += edge['latency']
                
                hops.append({
                    "from": from_c,
                    "to": to_c,
                    "rate": edge['rate'],
                    "fee_bps": round(edge['fee'] * 10000, 1),
                    "latency_sec": edge['latency']
                })

            net_fee = round((1.0 - total_fee_factor) * 100, 4)
            is_multi = len(path) > 2

            return {
                "path": path,
                "effective_rate": round(effective_rate, 6),
                "net_fee_percentage": net_fee,
                "net_fee_bps": round((1.0 - total_fee_factor) * 10000, 1),
                "estimated_latency_seconds": total_latency,
                "is_multi_hop": is_multi,
                "hop_count": len(path) - 1,
                "hops": hops,
                "algorithm": "DIJKSTRA_NEGATIVE_LOG_YIELD"
            }
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def check_arbitrage_cycle(self) -> bool:
        """Runs Bellman-Ford negative cycle detection across currency rails."""
        try:
            return nx.negative_edge_cycle(self.graph, weight='weight')
        except Exception:
            return False

# Global Singleton
smart_fx_router = SmartFXRouter()
