export type SearchQuery = {
  text?: string;
  filters?: Record<string, string | number | boolean>;
  page: number;
  limit: number;
};

export interface SearchProvider {
  searchListings(query: SearchQuery): Promise<{ listingIds: string[]; total: number }>;
}

export class LocalSearchProvider implements SearchProvider {
  public searchListings(_query: SearchQuery): Promise<{ listingIds: string[]; total: number }> {
    return Promise.resolve({ listingIds: [], total: 0 });
  }
}
