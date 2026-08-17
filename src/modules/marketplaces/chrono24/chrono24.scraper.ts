import { ExternalServiceError } from "../../../common/errors/app-error.js";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";
import { Chrono24Parser } from "./chrono24.parser.js";
import type { Chrono24ParsedPage, Chrono24SearchQuery } from "./chrono24.types.js";

const scrapingBeeEndpoint = "https://app.scrapingbee.com/api/v1/";
const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const defaultTimeoutMs = 20_000;

type ScrapingBeeFetchOptions = {
  timeoutMs?: number;
  attempts?: number;
};

type ScrapingBeeAuthMode = "bearer" | "query";

const compact = (value: string): string => value.trim().replace(/\s+/g, " ");

const booleanParam = (value: boolean): string => (value ? "true" : "false");

const queryText = (query: Chrono24SearchQuery): string =>
  compact([query.q, query.brand, query.model, query.reference, query.year ? String(query.year) : undefined]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" "));

const sortParam = (sort: string | undefined): string | null => {
  if (!sort) {
    return null;
  }
  const normalized = sort.trim().toLowerCase();
  const supported: Record<string, string> = {
    price_asc: "1",
    price_desc: "2",
    newest: "11",
    relevance: "0"
  };
  return supported[normalized] ?? normalized;
};

const jsonLdScriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i;

const blockSignals = [
  "cf-challenge",
  "cf-browser-verification",
  "challenge-platform",
  "turnstile",
  "g-recaptcha",
  "hcaptcha",
  "verify you are human",
  "checking your browser",
  "unusual traffic",
  "temporarily blocked",
  "<title>access denied</title>",
  "<title>attention required"
];

const isBlockedPage = (html: string): boolean => {
  const lower = html.slice(0, 80_000).toLowerCase();
  if (jsonLdScriptPattern.test(lower)) {
    return false;
  }
  return blockSignals.some((signal) => lower.includes(signal));
};

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export class Chrono24ScrapingService {
  private readonly parser = new Chrono24Parser();

  public buildSearchUrl(query: Chrono24SearchQuery): string {
    const config = getMarketplaceConfig().chrono24;
    const url = new URL("/search/index.htm", config.baseUrl);
    const text = queryText(query);
    if (text) {
      url.searchParams.set("query", text);
    }
    url.searchParams.set("dosearch", "true");
    url.searchParams.set("searchexplain", "1");
    url.searchParams.set("pageSize", String(query.limit));
    url.searchParams.set("showpage", String(query.page));
    if (typeof query.minPrice === "number") {
      url.searchParams.set("priceFrom", String(query.minPrice));
    }
    if (typeof query.maxPrice === "number") {
      url.searchParams.set("priceTo", String(query.maxPrice));
    }
    if (query.condition) {
      url.searchParams.set("condition", query.condition);
    }
    if (query.country) {
      url.searchParams.set("countryIds", query.country.toUpperCase());
    }
    const sort = sortParam(query.sort);
    if (sort) {
      url.searchParams.set("sortorder", sort);
    }
    return url.href;
  }

  public buildProductUrl(idOrUrl: string): string {
    const config = getMarketplaceConfig().chrono24;
    try {
      return new URL(idOrUrl).href;
    } catch {
      return new URL(`/watch/${encodeURIComponent(idOrUrl)}.htm`, config.baseUrl).href;
    }
  }

  public async fetchSearchPage(
    query: Chrono24SearchQuery,
    options: ScrapingBeeFetchOptions = {}
  ): Promise<Chrono24ParsedPage> {
    const html = await this.fetchHtml(this.buildSearchUrl(query), {
      attempts: 1,
      ...options
    });
    return this.parser.parse(html, getMarketplaceConfig().chrono24.baseUrl);
  }

  public async fetchProductPage(urlOrId: string): Promise<Chrono24ParsedPage> {
    const html = await this.fetchHtml(this.buildProductUrl(urlOrId));
    return this.parser.parse(html, getMarketplaceConfig().chrono24.baseUrl);
  }

  public async fetchHtml(targetUrl: string, options: ScrapingBeeFetchOptions = {}): Promise<string> {
    const config = getMarketplaceConfig().chrono24;
    if (!config.scrapingBeeApiKey) {
      throw new ExternalServiceError("ScrapingBee API key is not configured.");
    }

    const attempts = options.attempts ?? 3;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      for (const authMode of ["bearer", "query"] as const) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
        try {
          const response = await fetch(this.scrapingBeeUrl(targetUrl, authMode), {
            method: "GET",
            signal: controller.signal,
            headers: this.scrapingBeeHeaders(authMode)
          });
          const body = await response.text();

          if (!response.ok) {
            if (response.status === 401 && authMode === "bearer") {
              lastError = new ExternalServiceError("ScrapingBee rejected Bearer authentication; retrying with api_key query authentication.");
              continue;
            }
            if (transientStatuses.has(response.status) && attempt < attempts) {
              await delay(500 * attempt);
              break;
            }
            const message =
              response.status === 401
                ? "ScrapingBee authentication failed. Check SCRAPINGBEE_API_KEY."
                : `ScrapingBee request failed with status ${response.status}.`;
            throw new ExternalServiceError(message);
          }
          if (isBlockedPage(body)) {
            throw new ExternalServiceError("Chrono24 returned a bot challenge or block page.");
          }
          if (!body.trim()) {
            throw new ExternalServiceError("Chrono24 returned an empty HTML response.");
          }
          return body;
        } catch (error) {
          if (error instanceof ExternalServiceError) {
            throw error;
          }
          lastError = error instanceof Error ? error : new Error("ScrapingBee request failed.");
          if (attempt < attempts && this.isTransientError(error)) {
            await delay(500 * attempt);
            break;
          }
          if (authMode === "query") {
            break;
          }
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    if (lastError instanceof ExternalServiceError) {
      throw lastError;
    }
    throw new ExternalServiceError(lastError?.message ?? "ScrapingBee request failed.");
  }

  private isTransientError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return error instanceof TypeError;
  }

  private scrapingBeeUrl(targetUrl: string, authMode: ScrapingBeeAuthMode): URL {
    const config = getMarketplaceConfig().chrono24;
    const url = new URL(scrapingBeeEndpoint);
    url.searchParams.set("url", targetUrl);
    url.searchParams.set("render_js", booleanParam(config.renderJs));
    url.searchParams.set("stealth_proxy", booleanParam(config.stealthProxy));
    url.searchParams.set("country_code", config.countryCode);
    url.searchParams.set("block_resources", booleanParam(config.blockResources));
    if (authMode === "query" && config.scrapingBeeApiKey) {
      url.searchParams.set("api_key", config.scrapingBeeApiKey);
    }
    return url;
  }

  private scrapingBeeHeaders(authMode: ScrapingBeeAuthMode): Record<string, string> {
    const config = getMarketplaceConfig().chrono24;
    return {
      Accept: "text/html,application/xhtml+xml",
      ...(authMode === "bearer" && config.scrapingBeeApiKey
        ? { Authorization: `Bearer ${config.scrapingBeeApiKey}` }
        : {})
    };
  }
}
