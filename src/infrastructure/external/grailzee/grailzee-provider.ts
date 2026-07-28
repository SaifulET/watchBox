import type { MarketplaceListing, MarketplaceProvider } from "../ebay/ebay-provider.js";

export class GrailzeeProvider implements MarketplaceProvider {
  public readonly code = "GRAILZEE" as const;

  public searchListings(_query: string): Promise<MarketplaceListing[]> {
    return Promise.resolve([]);
  }

  public checkConnectivity(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
