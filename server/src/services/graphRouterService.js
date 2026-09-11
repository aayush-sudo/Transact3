/**
 * Smart Multi-Hop Graph FX Router using Dijkstra's Algorithm
 * Negative-Log edge weights: W(u, v) = -ln((1 - Fee) * Rate)
 */

const axios = require('axios');
const FASTAPI_URL = process.env.FASTAPI_SERVICE_URL || 'http://localhost:8000';

const BASE_CORRIDORS = [
  { from: 'USD', to: 'EUR', rate: 0.92, fee: 0.0015, latency: 2 },
  { from: 'EUR', to: 'USD', rate: 1.087, fee: 0.0015, latency: 2 },
  { from: 'USD', to: 'GBP', rate: 0.79, fee: 0.0015, latency: 2 },
  { from: 'GBP', to: 'USD', rate: 1.265, fee: 0.0015, latency: 2 },
  { from: 'USD', to: 'INR', rate: 87.20, fee: 0.0015, latency: 2 },
  { from: 'INR', to: 'USD', rate: 0.01146, fee: 0.0015, latency: 2 },
  { from: 'USD', to: 'AED', rate: 3.6725, fee: 0.0012, latency: 1 },
  { from: 'AED', to: 'USD', rate: 0.2723, fee: 0.0012, latency: 1 },
  { from: 'USD', to: 'SGD', rate: 1.345, fee: 0.0015, latency: 2 },
  { from: 'SGD', to: 'USD', rate: 0.7435, fee: 0.0015, latency: 2 },
  { from: 'USD', to: 'AUD', rate: 1.515, fee: 0.0015, latency: 2 },
  { from: 'AUD', to: 'USD', rate: 0.66, fee: 0.0015, latency: 2 },
  { from: 'USD', to: 'CAD', rate: 1.36, fee: 0.0015, latency: 2 },
  { from: 'CAD', to: 'USD', rate: 0.735, fee: 0.0015, latency: 2 },
  { from: 'USD', to: 'JPY', rate: 152.4, fee: 0.0015, latency: 2 },
  { from: 'JPY', to: 'USD', rate: 0.00656, fee: 0.0015, latency: 2 },
  { from: 'EUR', to: 'INR', rate: 94.80, fee: 0.0012, latency: 2 },
  { from: 'INR', to: 'EUR', rate: 0.01055, fee: 0.0012, latency: 2 },
  { from: 'GBP', to: 'INR', rate: 110.35, fee: 0.0012, latency: 2 },
  { from: 'INR', to: 'GBP', rate: 0.00906, fee: 0.0012, latency: 2 },
  { from: 'AED', to: 'INR', rate: 23.74, fee: 0.0010, latency: 1 },
  { from: 'INR', to: 'AED', rate: 0.0421, fee: 0.0010, latency: 1 }
];

class GraphRouterService {
  constructor() {
    this.edges = new Map();
    this.nodes = new Set();
    this.buildGraph();
  }

  buildGraph() {
    this.edges.clear();
    this.nodes.clear();

    for (const c of BASE_CORRIDORS) {
      this.addRail(c.from, c.to, c.rate, c.fee, c.latency);
    }
  }

  addRail(from, to, rate, fee, latency) {
    const u = from.toUpperCase();
    const v = to.toUpperCase();
    this.nodes.add(u);
    this.nodes.add(v);

    if (!this.edges.has(u)) {
      this.edges.set(u, []);
    }

    const effectiveYield = (1.0 - fee) * rate;
    const weight = effectiveYield > 0 ? -Math.log(effectiveYield) : Infinity;

    this.edges.get(u).push({ to: v, rate, fee, weight, latency });
  }

  // Pure JavaScript Dijkstra on negative-log weights
  findShortestPathLocally(source, target) {
    const uSrc = source.toUpperCase();
    const vTgt = target.toUpperCase();

    if (uSrc === vTgt) {
      return {
        path: [uSrc],
        effective_rate: 1.0,
        net_fee_percentage: 0.0,
        net_fee_bps: 0.0,
        estimated_latency_seconds: 0,
        is_multi_hop: false,
        hop_count: 0,
        hops: [],
        algorithm: 'DIJKSTRA_NEGATIVE_LOG_YIELD'
      };
    }

    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();

    for (const node of this.nodes) {
      distances.set(node, Infinity);
      previous.set(node, null);
      unvisited.add(node);
    }

    distances.set(uSrc, 0);

    while (unvisited.size > 0) {
      let closestNode = null;
      let minDistance = Infinity;

      for (const node of unvisited) {
        const dist = distances.get(node);
        if (dist < minDistance) {
          minDistance = dist;
          closestNode = node;
        }
      }

      if (!closestNode || minDistance === Infinity) break;
      if (closestNode === vTgt) break;

      unvisited.delete(closestNode);

      const neighbors = this.edges.get(closestNode) || [];
      for (const edge of neighbors) {
        if (!unvisited.has(edge.to)) continue;

        const alt = distances.get(closestNode) + edge.weight;
        if (alt < distances.get(edge.to)) {
          distances.set(edge.to, alt);
          previous.set(edge.to, { from: closestNode, edge });
        }
      }
    }

    // Reconstruct path
    const path = [];
    const hops = [];
    let curr = vTgt;
    let totalFeeFactor = 1.0;
    let effectiveRate = 1.0;
    let totalLatency = 0;

    while (curr && curr !== uSrc) {
      path.unshift(curr);
      const prevData = previous.get(curr);
      if (!prevData) return null; // No path

      const edge = prevData.edge;
      hops.unshift({
        from: prevData.from,
        to: curr,
        rate: edge.rate,
        fee_bps: Math.round(edge.fee * 10000 * 10) / 10,
        latency_sec: edge.latency
      });

      effectiveRate *= edge.rate;
      totalFeeFactor *= (1.0 - edge.fee);
      totalLatency += edge.latency;

      curr = prevData.from;
    }

    if (!curr) return null;
    path.unshift(uSrc);

    return {
      path,
      effective_rate: Math.round(effectiveRate * 1000000) / 1000000,
      net_fee_percentage: Math.round((1.0 - totalFeeFactor) * 10000) / 100,
      net_fee_bps: Math.round((1.0 - totalFeeFactor) * 10000 * 10) / 10,
      estimated_latency_seconds: totalLatency,
      is_multi_hop: path.length > 2,
      hop_count: path.length - 1,
      hops,
      algorithm: 'DIJKSTRA_NEGATIVE_LOG_YIELD'
    };
  }

  async findOptimalRoute(sourceCurrency, destinationCurrency, maxLatencySec = 300) {
    try {
      const response = await axios.post(
        `${FASTAPI_URL}/routing/graph-path`,
        { source_currency: sourceCurrency, destination_currency: destinationCurrency, max_latency_seconds: maxLatencySec },
        { timeout: 800 }
      );
      if (response.data && response.data.success) {
        return response.data.data;
      }
    } catch (e) {
      // Fallback seamlessly to native JS Dijkstra implementation
    }

    return this.findShortestPathLocally(sourceCurrency, destinationCurrency);
  }
}

module.exports = new GraphRouterService();
