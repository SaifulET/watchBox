export type Chrono24Source = "chrono24";

export type Chrono24Location = {
  raw: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Chrono24Product = {
  id: string;
  source: Chrono24Source;
  title: string;
  brand: string;
  model: string;
  reference: string;
  price: number;
  currency: string;
  condition: string;
  year: number | null;
  image: string;
  url: string;
  availability: string;
  location: Chrono24Location | null;
  caseMaterial: string | null;
  movement: string | null;
  description: string | null;
  sellerName: string | null;
  structuredData: Record<string, unknown>;
  capturedAt: string;
};

export type Chrono24SearchQuery = {
  q?: string | undefined;
  brand?: string | undefined;
  model?: string | undefined;
  reference?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  condition?: string | undefined;
  year?: number | undefined;
  country?: string | undefined;
  sort?: string | undefined;
  refresh?: boolean | undefined;
  page: number;
  limit: number;
};

export type Chrono24AnalyticsQuery = {
  brand?: string | undefined;
  model?: string | undefined;
  reference?: string | undefined;
};

export type Chrono24LocationSearchInput = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  q?: string | undefined;
  brand?: string | undefined;
  model?: string | undefined;
  reference?: string | undefined;
};

export type Chrono24PostSearchInput = Chrono24SearchQuery & {
  latitude?: number | undefined;
  longitude?: number | undefined;
  radiusKm?: number | undefined;
  imageUrl?: string | undefined;
  modelVersion?: string | undefined;
  productId?: string | undefined;
  includeItemDetails: boolean;
  includeMarketDetails: boolean;
};

export type Chrono24SearchResult = {
  query: Chrono24SearchQuery;
  total: number | null;
  count: number;
  page: number;
  limit: number;
  aggregateOffer: Chrono24AggregateOffer | null;
  items: Chrono24Product[];
  cached: boolean;
  warnings: string[];
};

export type Chrono24AggregateOffer = {
  lowPrice: number | null;
  highPrice: number | null;
  offerCount: number | null;
  priceCurrency: string | null;
  offers: Array<Record<string, unknown>>;
};

export type Chrono24ParsedPage = {
  product: Chrono24Product | null;
  products: Chrono24Product[];
  aggregateOffer: Chrono24AggregateOffer | null;
  jsonLd: Array<Record<string, unknown>>;
  warnings: string[];
};

export type Chrono24Analytics = {
  lowestAskingPrice: number;
  highestAskingPrice: number;
  averageAskingPrice: number;
  medianAskingPrice: number;
  listingVolume: number;
  priceChange30d: number | null;
  priceChange90d: number | null;
  priceChange1y: number | null;
  volatility: number | null;
  liquidityScore: number | null;
};

export type Chrono24MarketInsights = {
  lowestPricedProduct: Chrono24Product | null;
  highestPricedProduct: Chrono24Product | null;
  mostSearched: Array<{ query: string; count: number; lastSearchedAt: string | null }>;
  trendingProducts: Chrono24Product[];
  biggestDrops: Array<{ product: Chrono24Product; changePercentage: number }>;
  topGainers: Array<{ product: Chrono24Product; changePercentage: number }>;
  trendingBrands: Array<{ brand: string; listingVolume: number; averageAskingPrice: number }>;
  trendingModels: Array<{ brand: string; model: string; listingVolume: number; averageAskingPrice: number }>;
};

export type Chrono24JobType =
  | "chrono24.listings.refresh"
  | "chrono24.snapshots.create"
  | "chrono24.analytics.recalculate"
  | "chrono24.market-insights.recalculate";
