
class AIRoutingModel {
  constructor() {
    // Q-Table for Reinforcement Learning
    // Maps State (Source_Destination) to Actions (Specific Routes) and their Q-Values (Scores)
    this.qTable = new Map();

    // Learning hyperparameters
    this.learningRate = 0.1; // Alpha
    this.discountFactor = 0.9; // Gamma
    this.explorationRate = 0.2; // Epsilon (20% of the time, explore new paths)
  }

  /**
   * Initialize or retrieve Q-values for a specific source->destination pair
   */
  _getQState(source, destination, availablePaths) {
    const stateKey = `${source}_${destination}`;
    if (!this.qTable.has(stateKey)) {
      const initialActions = {};
      availablePaths.forEach(path => {
        initialActions[path.id] = 0.5; // Initial neutral Q-value
      });
      this.qTable.set(stateKey, initialActions);
    }
    return { stateKey, actions: this.qTable.get(stateKey) };
  }

  /**
   * The AI predicts the best route based on past learned experiences
   */
  predictBestRoute(source, destination, availablePaths) {
    const { actions } = this._getQState(source, destination, availablePaths);

    // Epsilon-Greedy Strategy: Sometimes explore randomly to find potentially newly optimized routes
    if (Math.random() < this.explorationRate) {
      console.log(`[AI Model] Exploring a random route to discover new efficiencies...`);
      const randomIndex = Math.floor(Math.random() * availablePaths.length);
      return availablePaths[randomIndex];
    }

    // Otherwise, Exploit: Pick the route with the highest Q-Value
    console.log(`[AI Model] Exploiting learned data for the most optimized route...`);
    let bestPathId = null;
    let maxQValue = -Infinity;

    for (const [pathId, qValue] of Object.entries(actions)) {
      if (qValue > maxQValue) {
        maxQValue = qValue;
        bestPathId = pathId;
      }
    }

    return availablePaths.find(p => p.id === bestPathId);
  }

  /**
   * After a transaction completes, feed the real-world results back into the AI to update its model
   */
  learnFromExecution(source, destination, pathId, actualFee, actualLatencyMs) {
    const stateKey = `${source}_${destination}`;
    if (!this.qTable.has(stateKey)) return;

    // Calculate a reward: Lower fees and lower latency = Higher Reward
    // Normalized conceptual formula
    const feeScore = 100 / (actualFee + 1); // Avoid div by 0
    const latencyScore = 10000 / (actualLatencyMs + 1);
    const reward = (feeScore * 0.6) + (latencyScore * 0.4);

    // Update Q-Value using the Bellman Equation
    const currentQ = this.qTable.get(stateKey)[pathId];
    const newQ = currentQ + this.learningRate * (reward - currentQ); // Simplified for single-step

    this.qTable.get(stateKey)[pathId] = newQ;
    console.log(`[AI Model] Learned from execution. Updated Q-Value for ${pathId} to ${newQ.toFixed(2)}`);
  }
}

class SmartRoutingEngine {
  constructor() {
    this.aiModel = new AIRoutingModel();
  }

  findOptimalPathWithAI(source, destination, amount) {
    console.log(`\n[Smart Router] Requesting AI path prediction for ${amount} ${source} -> ${destination}`);

    // Dummy available paths (In reality, generated dynamically from the liquidity graph)
    const possiblePaths = [
      { id: 'direct_matic', path: [source, destination], expectedOutput: amount * 0.95, estFees: 5.0, estLatency: 1200 },
      { id: 'hop_usdc', path: [source, 'USDC', destination], expectedOutput: amount * 0.98, estFees: 1.5, estLatency: 4500 },
      { id: 'hop_eth', path: [source, 'ETH', destination], expectedOutput: amount * 0.91, estFees: 12.0, estLatency: 8000 }
    ];

    // 1. AI predicts the best route
    const chosenPath = this.aiModel.predictBestRoute(source, destination, possiblePaths);
    console.log(`[Smart Router] AI selected route: ${chosenPath.path.join(' -> ')}`);

    // 2. Simulate the transaction executing in the real world
    console.log(`[Smart Router] Executing transaction on the blockchain...`);

    // Simulate real-world network fluctuations (latency varies, fees vary)
    const simulatedRealFee = chosenPath.estFees * (0.8 + Math.random() * 0.4);
    const simulatedRealLatency = chosenPath.estLatency * (0.8 + Math.random() * 0.4);

    // 3. AI Learns from the real-world execution
    this.aiModel.learnFromExecution(source, destination, chosenPath.id, simulatedRealFee, simulatedRealLatency);

    return {
      status: 'executed',
      routeUsed: chosenPath.path,
      actualFee: simulatedRealFee.toFixed(2),
      actualTimeMs: Math.round(simulatedRealLatency)
    };
  }
}

//Test 
if (require.main === module) {
  console.log("=== AI SMART ROUTING ENGINE TEST RUN ===");
  const router = new SmartRoutingEngine();

  console.log("\n--- Transaction 1 ---");
  router.findOptimalPathWithAI('USD', 'MATIC', 1000);

  console.log("\n--- Transaction 2 ---");
  router.findOptimalPathWithAI('USD', 'MATIC', 1000);

  console.log("\n--- Transaction 3 ---");
  router.findOptimalPathWithAI('USD', 'MATIC', 1000);

  console.log("\n--- Final AI Knowledge State (Q-Table) ---");
  console.log(router.aiModel.qTable);
}

module.exports = SmartRoutingEngine;
