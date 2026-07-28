import type { MarketplaceListing, MarketplaceProvider } from "../ebay/ebay-provider.js";

export class Chrono24Provider implements MarketplaceProvider {
  public readonly code = "CHRONO24" as const;

  public searchListings(_query: string): Promise<MarketplaceListing[]> {
    return Promise.resolve([]);
  }

  public checkConnectivity(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
