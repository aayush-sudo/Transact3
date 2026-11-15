/**
 * FX reference rates alone cannot establish that a payment route or its legs
 * are available. Return an explicit unavailable result until a provider can
 * supply executable, leg-by-leg quotes.
 */
class GraphRouterService {
  async findOptimalRoute(sourceCurrency, destinationCurrency) {
    const source = String(sourceCurrency || '').trim().toUpperCase();
    const destination = String(destinationCurrency || '').trim().toUpperCase();

    return {
      status: 'EXECUTABLE_ROUTE_UNAVAILABLE',
      source_currency: source,
      destination_currency: destination,
      path: [],
      hops: [],
      is_multi_hop: false,
      executable: false,
      reason: 'No connected payment provider confirms executable direct or multi-hop quotes for this corridor.'
    };
  }
}

module.exports = new GraphRouterService();
