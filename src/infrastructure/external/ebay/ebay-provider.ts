export type MarketplaceListing = {
  externalId: string;
  title: string;
  price: number;
  currency: string;
  sourceUrl: string;
};

export interface MarketplaceProvider {
  code: "EBAY" | "CHRONO24" | "GRAILZEE";
  searchListings(query: string): Promise<MarketplaceListing[]>;
  checkConnectivity(): Promise<boolean>;
}

export class EbayProvider implements MarketplaceProvider {
  public readonly code = "EBAY" as const;

  public searchListings(_query: string): Promise<MarketplaceListing[]> {
    return Promise.resolve([]);
  }

  public checkConnectivity(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
