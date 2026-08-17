import { createHash } from "node:crypto";
import type {
  Chrono24AggregateOffer,
  Chrono24Location,
  Chrono24ParsedPage,
  Chrono24Product
} from "./chrono24.types.js";

type JsonRecord = Record<string, unknown>;

const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const chrono24ProductHrefPattern = /href=["']([^"']*--id\d+\.htm[^"']*)["']/gi;

const htmlEntityMap: Record<string, string> = {
  amp: "&",
  quot: "\"",
  apos: "'",
  lt: "<",
  gt: ">"
};

const decodeHtml = (value: string): string =>
  value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<!--|-->/g, "")
    .replace(/&(#\d+|#x[a-f0-9]+|amp|quot|apos|lt|gt);/gi, (_match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      }
      if (lower.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
      }
      return htmlEntityMap[lower] ?? "";
    })
    .trim();

const stripTags = (value: string): string => decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

const stringValue = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const numberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const priceFromText = (value: string): { price: number; currency: string } | null => {
  const match = value.match(/(?:\b(USD|EUR|GBP)\b\s*([$€£])?|([$€£])\s*)([0-9][0-9,.\s]{2,})/i);
  if (!match) {
    return null;
  }
  const price = numberValue(match[4]);
  if (price === null || price <= 0) {
    return null;
  }
  return {
    price,
    currency: normalizeCurrency(match[1] ?? match[2] ?? match[3] ?? "USD")
  };
};

const integerValue = (value: unknown): number | null => {
  const number = numberValue(value);
  return Number.isInteger(number) ? number : null;
};

const firstString = (records: JsonRecord[], keys: string[]): string | null => {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      const direct = stringValue(value);
      if (direct) {
        return direct;
      }
      const nested = asRecord(value);
      if (nested) {
        const nestedValue = stringValue(nested.name) ?? stringValue(nested.url);
        if (nestedValue) {
          return nestedValue;
        }
      }
    }
  }
  return null;
};

const firstNumber = (records: JsonRecord[], keys: string[]): number | null => {
  for (const record of records) {
    for (const key of keys) {
      const value = numberValue(record[key]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
};

const absoluteUrl = (baseUrl: string, value: string | null): string => {
  if (!value) {
    return "";
  }
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
};

const imageFromValue = (baseUrl: string, value: unknown): string => {
  const candidates = asArray(value)
    .map((candidate) => {
      if (typeof candidate === "string") {
        return candidate;
      }
      const record = asRecord(candidate);
      return record ? stringValue(record.url) ?? stringValue(record.contentUrl) : null;
    })
    .filter((candidate): candidate is string => Boolean(candidate));
  return absoluteUrl(baseUrl, candidates[0] ?? null);
};

const normalizeCurrency = (value: string | null): string => {
  const normalized = (value ?? "USD").trim().toUpperCase();
  const symbols: Record<string, string> = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP"
  };
  return symbols[normalized] ?? normalized;
};

const typeNames = (value: unknown): string[] =>
  asArray(value)
    .map((entry) => stringValue(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => entry.toLowerCase());

const isType = (record: JsonRecord, expected: string): boolean =>
  typeNames(record["@type"]).includes(expected.toLowerCase());

const flattenJsonLd = (value: unknown): JsonRecord[] => {
  const record = asRecord(value);
  if (!record) {
    if (Array.isArray(value)) {
      return value.flatMap(flattenJsonLd);
    }
    return [];
  }

  const graph = Array.isArray(record["@graph"]) ? record["@graph"].flatMap(flattenJsonLd) : [];
  return [record, ...graph];
};

const parseJson = (candidate: string): unknown => {
  const parsed = JSON.parse(candidate) as unknown;
  if (typeof parsed === "string") {
    return JSON.parse(parsed) as unknown;
  }
  return parsed;
};

const balancedJsonCandidates = (value: string): string[] => {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return candidates;
};

const parseJsonLdScript = (content: string): unknown[] => {
  const cleaned = decodeHtml(content);
  if (!cleaned) {
    return [];
  }
  const candidates = [
    cleaned,
    cleaned.replace(/,\s*([}\]])/g, "$1"),
    ...balancedJsonCandidates(cleaned).map((candidate) => candidate.replace(/,\s*([}\]])/g, "$1"))
  ];
  const parsed: unknown[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    try {
      parsed.push(parseJson(candidate));
    } catch {
      // Try the next salvage candidate.
    }
  }
  return parsed;
};

const extractJsonLd = (html: string): { records: JsonRecord[]; warnings: string[] } => {
  const records: JsonRecord[] = [];
  const warnings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    const parsed = parseJsonLdScript(match[1] ?? "");
    if (parsed.length === 0) {
      warnings.push("Skipped an invalid JSON-LD script block.");
      continue;
    }
    records.push(...parsed.flatMap(flattenJsonLd));
  }
  return { records, warnings };
};

const aggregateOfferFromRecord = (record: JsonRecord): Chrono24AggregateOffer => {
  const offers = asArray(record.offers)
    .map(asRecord)
    .filter((offer): offer is JsonRecord => Boolean(offer));
  return {
    lowPrice: numberValue(record.lowPrice),
    highPrice: numberValue(record.highPrice),
    offerCount: integerValue(record.offerCount),
    priceCurrency: stringValue(record.priceCurrency),
    offers
  };
};

const findAggregateOffer = (records: JsonRecord[]): Chrono24AggregateOffer | null => {
  for (const record of records) {
    if (isType(record, "AggregateOffer")) {
      return aggregateOfferFromRecord(record);
    }
    const offers = asRecord(record.offers);
    if (offers && isType(offers, "AggregateOffer")) {
      return aggregateOfferFromRecord(offers);
    }
  }
  return null;
};

const productRecords = (records: JsonRecord[]): JsonRecord[] =>
  records.filter((record) => isType(record, "Product") || isType(record, "Watch") || Boolean(record.offers));

const offerRecords = (record: JsonRecord): JsonRecord[] =>
  asArray(record.offers)
    .map(asRecord)
    .filter((offer): offer is JsonRecord => Boolean(offer))
    .flatMap((offer) => isType(offer, "AggregateOffer") ? asArray(offer.offers).map(asRecord).filter(Boolean) as JsonRecord[] : [offer]);

const locationFromRecord = (record: JsonRecord): Chrono24Location | null => {
  const seller = asRecord(record.seller) ?? asRecord(record.offeredBy);
  const address = asRecord(record.availableAtOrFrom) ?? asRecord(seller?.address) ?? asRecord(record.address);
  const geo = asRecord(record.geo) ?? asRecord(address?.geo);
  const raw = firstString([record, seller ?? {}, address ?? {}], ["location", "areaServed", "address", "addressCountry"]);
  const latitude = numberValue(geo?.latitude);
  const longitude = numberValue(geo?.longitude);
  const country = stringValue(address?.addressCountry) ?? stringValue(seller?.addressCountry) ?? null;
  const region = stringValue(address?.addressRegion) ?? null;
  const city = stringValue(address?.addressLocality) ?? null;
  if (!raw && !country && !region && !city && latitude === null && longitude === null) {
    return null;
  }
  return {
    raw,
    country,
    region,
    city,
    latitude,
    longitude
  };
};

const brandName = (record: JsonRecord): string | null => {
  const brand = record.brand;
  if (typeof brand === "string") {
    return brand.trim() || null;
  }
  const brandRecord = asRecord(brand);
  return brandRecord ? stringValue(brandRecord.name) : null;
};

const stableListingId = (url: string, title: string): string => {
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();
  const path = parsed?.pathname ?? url;
  const numeric = path.match(/--id(\d{5,})(?:\.htm|\/)?$/)?.[1] ?? path.match(/(?:\/|--)(\d{5,})(?:\.htm|\/)?$/)?.[1];
  if (numeric) {
    return numeric;
  }
  return createHash("sha256").update(`${url}|${title}`).digest("base64url").slice(0, 24);
};

const titleLooksGeneric = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "more information" || normalized === "view details" || normalized === "details";
};

const slugPartsFromUrl = (url: string): { brand: string; slug: string; title: string } => {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const parts = path.split("/").filter(Boolean);
  const brand = parts[0] ?? "";
  const slug = (parts[1] ?? parts[0] ?? "").replace(/--id\d+\.htm.*/i, "");
  const title = stripTags(slug.replace(/[-_]+/g, " "));
  return {
    brand,
    slug,
    title
  };
};

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((word) => word ? `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}` : "")
    .join(" ")
    .trim();

const titleFromHtmlContext = (context: string, url: string): string => {
  const attribute =
    context.match(/(?:title|aria-label)=["']([^"']{4,240})["']/i)?.[1] ??
    context.match(/<h[1-6][^>]*>([\s\S]{4,300}?)<\/h[1-6]>/i)?.[1];
  const stripped = attribute ? stripTags(attribute) : "";
  if (stripped && !titleLooksGeneric(stripped)) {
    return stripped;
  }
  return slugPartsFromUrl(url).title || "Chrono24 listing";
};

const referenceFromText = (value: string): string => {
  const reference =
    value.match(/\b(?:ref(?:erence)?\.?\s*)?([0-9]{4,6}[A-Z0-9-]{0,8})\b/i)?.[1] ??
    value.match(/\b([A-Z]?\d{3,6}[A-Z]{1,4}(?:-\d{3,4})?)\b/i)?.[1];
  return reference?.toUpperCase() ?? "";
};

const inferredFieldsFromFallback = (title: string, url: string): { brand: string; model: string; reference: string } => {
  const slug = slugPartsFromUrl(url);
  const brand = titleCase(slug.brand);
  const combined = `${title} ${slug.title}`;
  const reference = referenceFromText(combined);
  const model = titleCase(
    slug.title
      .replace(new RegExp(`\\b${slug.brand}\\b`, "i"), "")
      .replace(reference, "")
      .replace(/\b(?:watch|new|used|steel|stainless|automatic|mm|black|blue|green|dial|bracelet)\b/gi, " ")
      .replace(/\b\d{2,4}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  return {
    brand,
    model,
    reference
  };
};

const imageFromHtmlContext = (context: string, baseUrl: string): string => {
  const image =
    context.match(/(?:src|data-src|data-original)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i)?.[1] ??
    context.match(/srcset=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"',\s]*)?)/i)?.[1];
  return absoluteUrl(baseUrl, image ?? null);
};

const productsFromHtmlCards = (html: string, baseUrl: string): Chrono24Product[] => {
  const products: Chrono24Product[] = [];
  let match: RegExpExecArray | null;
  while ((match = chrono24ProductHrefPattern.exec(html)) !== null) {
    const href = match[1] ?? "";
    const url = absoluteUrl(baseUrl, href);
    const start = Math.max(0, match.index - 1600);
    const end = Math.min(html.length, match.index + 3200);
    const context = html.slice(start, end);
    const title = titleFromHtmlContext(context, url);
    const price = priceFromText(stripTags(context));
    const inferred = inferredFieldsFromFallback(title, url);
    products.push({
      id: stableListingId(url, title),
      source: "chrono24",
      title,
      brand: inferred.brand,
      model: inferred.model,
      reference: inferred.reference,
      price: price?.price ?? 0,
      currency: price?.currency ?? "USD",
      condition: "",
      year: null,
      image: imageFromHtmlContext(context, baseUrl),
      url,
      availability: "",
      location: null,
      caseMaterial: null,
      movement: null,
      description: null,
      sellerName: null,
      structuredData: {
        extraction: "html-card-fallback"
      },
      capturedAt: new Date().toISOString()
    });
  }
  return products;
};

const productFromRecord = (record: JsonRecord, baseUrl: string): Chrono24Product | null => {
  const offers = offerRecords(record);
  const primaryOffer = offers[0] ?? asRecord(record.offers) ?? {};
  const records = [record, primaryOffer];
  const url = absoluteUrl(baseUrl, firstString(records, ["url", "itemOffered"]));
  const title = firstString(records, ["name", "title", "headline"]);
  if (!title || !url) {
    return null;
  }
  const price = firstNumber(records, ["price", "lowPrice"]) ?? 0;
  const currency = normalizeCurrency(firstString(records, ["priceCurrency"]));
  const brand = brandName(record) ?? firstString(records, ["manufacturer"]) ?? "";
  const model = firstString(records, ["model", "alternateName"]) ?? "";
  const reference = firstString(records, ["mpn", "sku", "productID", "reference", "referenceNumber"]) ?? "";
  const year = integerValue(record.productionDate) ?? integerValue(record.releaseDate) ?? integerValue(record.year);
  const image = imageFromValue(baseUrl, record.image ?? primaryOffer.image);
  const availability = firstString(records, ["availability", "itemCondition"]) ?? "";

  return {
    id: stableListingId(url, title),
    source: "chrono24",
    title,
    brand,
    model,
    reference,
    price,
    currency,
    condition: firstString(records, ["itemCondition", "condition"]) ?? "",
    year,
    image,
    url,
    availability,
    location: locationFromRecord({ ...record, ...primaryOffer }),
    caseMaterial: firstString(records, ["material", "caseMaterial"]) ?? null,
    movement: firstString(records, ["movement", "watchMovement"]) ?? null,
    description: firstString(records, ["description"]) ?? null,
    sellerName: firstString(records, ["seller", "offeredBy"]) ?? null,
    structuredData: record,
    capturedAt: new Date().toISOString()
  };
};

const productsFromAggregate = (
  aggregateOffer: Chrono24AggregateOffer,
  records: JsonRecord[],
  baseUrl: string
): Chrono24Product[] => {
  const product = productRecords(records)[0] ?? {};
  const title = stringValue(product.name) ?? "Chrono24 listing";
  return aggregateOffer.offers
    .map((offer) => productFromRecord({ ...product, offers: offer, name: stringValue(offer.name) ?? title }, baseUrl))
    .filter((item): item is Chrono24Product => Boolean(item));
};

const productsFromItemList = (records: JsonRecord[], baseUrl: string): Chrono24Product[] =>
  records
    .filter((record) => isType(record, "ItemList"))
    .flatMap((record) => asArray(record.itemListElement))
    .map((item) => {
      const itemRecord = asRecord(item);
      const nested = asRecord(itemRecord?.item);
      return nested ?? itemRecord;
    })
    .filter((item): item is JsonRecord => Boolean(item))
    .map((record) => productFromRecord(record, baseUrl))
    .filter((item): item is Chrono24Product => Boolean(item));

export class Chrono24Parser {
  public parse(html: string, baseUrl: string): Chrono24ParsedPage {
    const { records, warnings } = extractJsonLd(html);
    const aggregateOffer = findAggregateOffer(records);
    const directProducts = productRecords(records)
      .map((record) => productFromRecord(record, baseUrl))
      .filter((item): item is Chrono24Product => Boolean(item));
    const aggregateProducts = aggregateOffer ? productsFromAggregate(aggregateOffer, records, baseUrl) : [];
    const itemListProducts = productsFromItemList(records, baseUrl);
    const htmlProducts = productsFromHtmlCards(html, baseUrl);
    const products = this.deduplicate([...directProducts, ...aggregateProducts, ...itemListProducts, ...htmlProducts]);

    if (records.length === 0) {
      warnings.push("No JSON-LD structured data was found in the Chrono24 HTML.");
    }
    if (products.length > 0 && directProducts.length + aggregateProducts.length + itemListProducts.length === 0) {
      warnings.push("Used Chrono24 HTML listing-card fallback because structured product data was unavailable.");
    }
    if (products.length === 0 && aggregateOffer?.offers.length) {
      warnings.push("AggregateOffer was found, but no individual offers could be normalized.");
    }

    return {
      product: products[0] ?? null,
      products,
      aggregateOffer,
      jsonLd: records,
      warnings
    };
  }

  private deduplicate(products: Chrono24Product[]): Chrono24Product[] {
    const seen = new Set<string>();
    const output: Chrono24Product[] = [];
    for (const product of products) {
      const key = product.url || product.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(product);
    }
    return output;
  }
}
