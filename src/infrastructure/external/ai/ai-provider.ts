import { ConflictError, ExternalServiceError } from "../../../common/errors/app-error.js";
import { getAiConfig } from "../../../config/ai.config.js";

export type ImageAnalysis = {
  containsWatch: boolean;
  generatedTitle?: string;
  probableBrand?: string;
  probableModel?: string;
  probableReferenceNumber?: string;
  visualAttributes: Record<string, string>;
  embedding: number[];
  modelVersion: string;
};

export type ImageAnalysisRequest = {
  imageUrl: string;
  imageDataUrl?: string;
  modelVersion?: string;
  includeEmbedding?: boolean;
};

export type SearchQueryNormalizationRequest = {
  query: string;
  modelVersion?: string;
};

export type SearchQueryNormalization = {
  optimizedQuery: string;
  confidence: number;
  detectedBrand?: string;
  detectedModel?: string;
  reasoning?: string;
  modelVersion: string;
};

export type ProductDetailGuessInput = {
  id: string;
  title: string;
  source: string;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  price?: number;
  currency?: string;
  condition?: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
};

export type ProductDetailSimilarGuess = {
  title: string;
  price: number;
  currency: string;
  condition: string;
  image: string;
  sourceUrl: string;
};

export type ProductDetailGuess = {
  id: string;
  brand: string;
  model: string;
  referenceNumber: string;
  currentPrice: number;
  marketAveragePrice: number;
  currentPriceChangePercentage: number;
  currentPriceDirection: "increase" | "decrease" | "same";
  marketStatus: "stable" | "unstable";
  productionYear: number;
  condition: string;
  movement: string;
  scope: string;
  rating: number;
  salesAmount: number;
  lowestPrice: number;
  highestPrice: number;
  priceTrendData: Array<{ label: string; averagePrice: number; listingCount: number }>;
  liquidityScope: "low" | "medium" | "high";
  listingVolumeAmount: number;
  listingVolumePercentage: number;
  volatility: "low" | "medium" | "high";
  description: string;
  image: string;
  sourceUrl: string;
  similarProducts: ProductDetailSimilarGuess[];
};

export type ProductDetailGuessRequest = {
  query: string;
  products: ProductDetailGuessInput[];
  modelVersion?: string;
};

export interface AiProvider {
  analyzeImage(payload: ImageAnalysisRequest): Promise<ImageAnalysis>;
  normalizeSearchQuery(payload: SearchQueryNormalizationRequest): Promise<SearchQueryNormalization>;
  inferProductDetails(payload: ProductDetailGuessRequest): Promise<ProductDetailGuess[]>;
}

export class LocalAiProvider implements AiProvider {
  public analyzeImage(payload: ImageAnalysisRequest): Promise<ImageAnalysis> {
    const seed = [...payload.imageUrl].reduce((total, char) => total + char.charCodeAt(0), 0);
    const embedding =
      payload.includeEmbedding === false
        ? []
        : Array.from({ length: 64 }, (_value, index) => {
            const raw = Math.sin(seed + index) * 10_000;
            return Number((raw - Math.floor(raw)).toFixed(6));
          });

    return Promise.resolve({
      containsWatch: true,
      generatedTitle: "Rolex Submariner 126610LN",
      probableBrand: "Rolex",
      probableModel: "Submariner",
      probableReferenceNumber: "126610LN",
      visualAttributes: { case: "round", dial: "black", bezel: "ceramic" },
      embedding,
      modelVersion: payload.modelVersion ?? "local-v1"
    });
  }

  public normalizeSearchQuery(payload: SearchQueryNormalizationRequest): Promise<SearchQueryNormalization> {
    const query = payload.query.trim().replace(/\s+/g, " ");
    return Promise.resolve({
      optimizedQuery: query.toLowerCase().includes("watch") ? query : `${query} watch`,
      confidence: 0.5,
      modelVersion: payload.modelVersion ?? "local-v1"
    });
  }

  public inferProductDetails(payload: ProductDetailGuessRequest): Promise<ProductDetailGuess[]> {
    return Promise.resolve(payload.products.map(localProductGuess));
  }
}

type OpenAiTextOutput = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  type?: string;
  content?: OpenAiTextOutput[];
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: OpenAiOutputItem[];
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  error?: {
    message?: string;
  };
};

type EmbeddingPayload = {
  data?: Array<{
    embedding?: number[];
  }>;
};

const imageAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "containsWatch",
    "generatedTitle",
    "probableBrand",
    "probableModel",
    "probableReferenceNumber",
    "visualAttributes"
  ],
  properties: {
    containsWatch: { type: "boolean" },
    generatedTitle: { type: ["string", "null"] },
    probableBrand: { type: ["string", "null"] },
    probableModel: { type: ["string", "null"] },
    probableReferenceNumber: { type: ["string", "null"] },
    visualAttributes: {
      type: "object",
      additionalProperties: false,
      required: [
        "caseShape",
        "dialColor",
        "bezel",
        "bracelet",
        "material",
        "markers",
        "condition",
        "other"
      ],
      properties: {
        caseShape: { type: ["string", "null"] },
        dialColor: { type: ["string", "null"] },
        bezel: { type: ["string", "null"] },
        bracelet: { type: ["string", "null"] },
        material: { type: ["string", "null"] },
        markers: { type: ["string", "null"] },
        condition: { type: ["string", "null"] },
        other: { type: ["string", "null"] }
      }
    }
  }
};

const searchQueryNormalizationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["optimizedQuery", "confidence", "detectedBrand", "detectedModel", "reasoning"],
  properties: {
    optimizedQuery: { type: "string" },
    confidence: { type: "number" },
    detectedBrand: { type: ["string", "null"] },
    detectedModel: { type: ["string", "null"] },
    reasoning: { type: ["string", "null"] }
  }
};

const productDetailGuessSchema = {
  type: "object",
  additionalProperties: false,
  required: ["products"],
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "brand",
          "model",
          "referenceNumber",
          "currentPrice",
          "marketAveragePrice",
          "currentPriceChangePercentage",
          "currentPriceDirection",
          "marketStatus",
          "productionYear",
          "condition",
          "movement",
          "scope",
          "rating",
          "salesAmount",
          "lowestPrice",
          "highestPrice",
          "priceTrendData",
          "liquidityScope",
          "listingVolumeAmount",
          "listingVolumePercentage",
          "volatility",
          "description",
          "image",
          "sourceUrl",
          "similarProducts"
        ],
        properties: {
          id: { type: "string" },
          brand: { type: "string" },
          model: { type: "string" },
          referenceNumber: { type: "string" },
          currentPrice: { type: "number" },
          marketAveragePrice: { type: "number" },
          currentPriceChangePercentage: { type: "number" },
          currentPriceDirection: { type: "string", enum: ["increase", "decrease", "same"] },
          marketStatus: { type: "string", enum: ["stable", "unstable"] },
          productionYear: { type: "number" },
          condition: { type: "string" },
          movement: { type: "string" },
          scope: { type: "string" },
          rating: { type: "number" },
          salesAmount: { type: "number" },
          lowestPrice: { type: "number" },
          highestPrice: { type: "number" },
          priceTrendData: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "averagePrice", "listingCount"],
              properties: {
                label: { type: "string" },
                averagePrice: { type: "number" },
                listingCount: { type: "number" }
              }
            }
          },
          liquidityScope: { type: "string", enum: ["low", "medium", "high"] },
          listingVolumeAmount: { type: "number" },
          listingVolumePercentage: { type: "number" },
          volatility: { type: "string", enum: ["low", "medium", "high"] },
          description: { type: "string" },
          image: { type: "string" },
          sourceUrl: { type: "string" },
          similarProducts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "price", "currency", "condition", "image", "sourceUrl"],
              properties: {
                title: { type: "string" },
                price: { type: "number" },
                currency: { type: "string" },
                condition: { type: "string" },
                image: { type: "string" },
                sourceUrl: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
};

type OpenAiErrorPayload = {
  error?: {
    message?: string;
  };
};

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const textFromOpenAiResponse = (payload: OpenAiResponsePayload): string | undefined => {
  if (payload.output_text) {
    return payload.output_text.trim();
  }
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === "output_text" || content.type === "text" || !content.type) && stringValue(content.text)) {
        return content.text?.trim();
      }
    }
  }
  return undefined;
};

const openAiMissingTextMessage = (payload: OpenAiResponsePayload, fallback: string): string => {
  if (payload.error?.message) {
    return `${fallback}: ${payload.error.message}`;
  }
  if (payload.status === "incomplete") {
    return `${fallback}: response incomplete${payload.incomplete_details?.reason ? ` (${payload.incomplete_details.reason})` : ""}.`;
  }
  const outputTypes = (payload.output ?? []).map((item) => item.type).filter(Boolean);
  return outputTypes.length > 0 ? `${fallback}: output types were ${outputTypes.join(", ")}.` : fallback;
};

const normalizeAnalysis = (value: unknown, modelVersion: string): ImageAnalysis => {
  if (typeof value !== "object" || value === null) {
    throw new ExternalServiceError("AI image analysis response was not an object.");
  }
  const input = value as Record<string, unknown>;
  const analysis: ImageAnalysis = {
    containsWatch: Boolean(input.containsWatch),
    visualAttributes:
      typeof input.visualAttributes === "object" &&
      input.visualAttributes !== null &&
      !Array.isArray(input.visualAttributes)
        ? Object.fromEntries(
            Object.entries(input.visualAttributes).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string"
            )
          )
        : {},
    embedding: Array.isArray(input.embedding)
      ? input.embedding.filter((item): item is number => typeof item === "number")
      : [],
    modelVersion
  };

  if (typeof input.probableBrand === "string") {
    analysis.probableBrand = input.probableBrand;
  }
  if (typeof input.generatedTitle === "string" && input.generatedTitle.trim()) {
    analysis.generatedTitle = input.generatedTitle.trim();
  }
  if (typeof input.probableModel === "string") {
    analysis.probableModel = input.probableModel;
  }
  if (typeof input.probableReferenceNumber === "string") {
    analysis.probableReferenceNumber = input.probableReferenceNumber;
  }

  return analysis;
};

const normalizeSearchQueryResponse = (value: unknown, modelVersion: string): SearchQueryNormalization => {
  if (typeof value !== "object" || value === null) {
    throw new ExternalServiceError("AI search query response was not an object.");
  }
  const input = value as Record<string, unknown>;
  const optimizedQuery =
    typeof input.optimizedQuery === "string" && input.optimizedQuery.trim()
      ? input.optimizedQuery.trim()
      : undefined;
  if (!optimizedQuery) {
    throw new ExternalServiceError("AI search query response did not include an optimized query.");
  }

  const result: SearchQueryNormalization = {
    optimizedQuery,
    confidence:
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? Math.max(0, Math.min(1, input.confidence))
        : 0,
    modelVersion
  };
  if (typeof input.detectedBrand === "string" && input.detectedBrand.trim()) {
    result.detectedBrand = input.detectedBrand.trim();
  }
  if (typeof input.detectedModel === "string" && input.detectedModel.trim()) {
    result.detectedModel = input.detectedModel.trim();
  }
  if (typeof input.reasoning === "string" && input.reasoning.trim()) {
    result.reasoning = input.reasoning.trim();
  }
  return result;
};

const numberOrFallback = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const stringOrFallback = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const directionOrFallback = (value: unknown): ProductDetailGuess["currentPriceDirection"] =>
  value === "increase" || value === "decrease" || value === "same" ? value : "same";

const marketStatusOrFallback = (value: unknown): ProductDetailGuess["marketStatus"] =>
  value === "unstable" ? "unstable" : "stable";

const levelOrFallback = (value: unknown): "low" | "medium" | "high" =>
  value === "low" || value === "high" ? value : "medium";

const wordsFromTitle = (title: string): string[] =>
  title
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

const fallbackBrand = (product: ProductDetailGuessInput): string => {
  if (product.brand) {
    return product.brand;
  }
  const words = wordsFromTitle(product.title);
  return words[0] ?? "Estimated";
};

const fallbackModel = (product: ProductDetailGuessInput): string => {
  if (product.model) {
    return product.model;
  }
  const words = wordsFromTitle(product.title);
  return words.slice(1, 4).join(" ") || product.title;
};

const fallbackReferenceNumber = (product: ProductDetailGuessInput): string => {
  if (product.referenceNumber) {
    return product.referenceNumber;
  }
  const referenceLike = wordsFromTitle(product.title).find((word) => /[A-Z0-9-]{4,}/i.test(word) && /\d/.test(word));
  return referenceLike ?? "estimated-reference";
};

const fallbackImage = (product: ProductDetailGuessInput): string => product.image ?? "not_available";

const fallbackSourceUrl = (product: ProductDetailGuessInput): string =>
  product.sourceUrl ?? (product.source === "local" ? `/api/v1/listings/${product.id.replace(/^local:/, "")}` : "not_available");

const similarProductGuesses = (
  product: ProductDetailGuessInput,
  currentPrice: number,
  currency: string,
  condition: string
): ProductDetailSimilarGuess[] => {
  const brand = fallbackBrand(product);
  const model = fallbackModel(product);
  const baseTitle = product.title || `${brand} ${model}`;
  const multipliers = [0.92, 0.97, 1.03, 1.08, 1.15];
  const suffixes = ["Comparable listing", "Similar condition", "Market alternative", "Recent comparable", "Nearby market price"];
  return multipliers.map((multiplier, index) => ({
    title: `${baseTitle} - ${suffixes[index]}`,
    price: Number((currentPrice * multiplier).toFixed(2)),
    currency,
    condition,
    image: fallbackImage(product),
    sourceUrl: fallbackSourceUrl(product)
  }));
};

const localProductGuess = (product: ProductDetailGuessInput): ProductDetailGuess => {
  const currentPrice = product.price ?? 0;
  const marketAveragePrice = currentPrice;
  const currency = product.currency ?? "USD";
  const condition = product.condition ?? "Pre-Owned";
  return {
    id: product.id,
    brand: fallbackBrand(product),
    model: fallbackModel(product),
    referenceNumber: fallbackReferenceNumber(product),
    currentPrice,
    marketAveragePrice,
    currentPriceChangePercentage: 0,
    currentPriceDirection: "same",
    marketStatus: "stable",
    productionYear: new Date().getUTCFullYear(),
    condition,
    movement: "automatic",
    scope: "watch only",
    rating: 0,
    salesAmount: 0,
    lowestPrice: currentPrice,
    highestPrice: currentPrice,
    priceTrendData: [{ label: "estimated", averagePrice: currentPrice, listingCount: 1 }],
    liquidityScope: "medium",
    listingVolumeAmount: 1,
    listingVolumePercentage: 100,
    volatility: "medium",
    description: product.description ?? product.title,
    image: fallbackImage(product),
    sourceUrl: fallbackSourceUrl(product),
    similarProducts: similarProductGuesses(product, currentPrice, currency, condition)
  };
};

const normalizeProductGuesses = (
  value: unknown,
  requestedProducts: ProductDetailGuessInput[]
): ProductDetailGuess[] => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return requestedProducts.map(localProductGuess);
  }
  const products = Array.isArray((value as Record<string, unknown>).products)
    ? ((value as Record<string, unknown>).products as unknown[])
    : [];
  const fallbackById = new Map(requestedProducts.map((product) => [product.id, localProductGuess(product)]));
  return requestedProducts.map((requestedProduct, index) => {
    const input = products.find((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return false;
      }
      return (item as Record<string, unknown>).id === requestedProduct.id;
    }) ?? products[index];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return fallbackById.get(requestedProduct.id) ?? localProductGuess(requestedProduct);
    }
    const record = input as Record<string, unknown>;
    const fallback = fallbackById.get(requestedProduct.id) ?? localProductGuess(requestedProduct);
    const priceTrendInput = Array.isArray(record.priceTrendData) ? record.priceTrendData : [];
    const priceTrendData = priceTrendInput.flatMap((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return [];
      }
      const trend = item as Record<string, unknown>;
      return [
        {
          label: stringOrFallback(trend.label, "estimated"),
          averagePrice: numberOrFallback(trend.averagePrice, fallback.currentPrice),
          listingCount: numberOrFallback(trend.listingCount, 1)
        }
      ];
    });
    const similarInput = Array.isArray(record.similarProducts) ? record.similarProducts : [];
    const similarProducts = similarInput.flatMap((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return [];
      }
      const similar = item as Record<string, unknown>;
      return [
        {
          title: stringOrFallback(similar.title, fallback.description),
          price: numberOrFallback(similar.price, fallback.currentPrice),
          currency: stringOrFallback(similar.currency, requestedProduct.currency ?? "USD"),
          condition: stringOrFallback(similar.condition, fallback.condition),
          image: stringOrFallback(similar.image, fallback.image),
          sourceUrl: stringOrFallback(similar.sourceUrl, fallback.sourceUrl)
        }
      ];
    });
    return {
      id: requestedProduct.id,
      brand: stringOrFallback(record.brand, fallback.brand),
      model: stringOrFallback(record.model, fallback.model),
      referenceNumber: stringOrFallback(record.referenceNumber, fallback.referenceNumber),
      currentPrice: numberOrFallback(record.currentPrice, fallback.currentPrice),
      marketAveragePrice: numberOrFallback(record.marketAveragePrice, fallback.marketAveragePrice),
      currentPriceChangePercentage: numberOrFallback(record.currentPriceChangePercentage, fallback.currentPriceChangePercentage),
      currentPriceDirection: directionOrFallback(record.currentPriceDirection),
      marketStatus: marketStatusOrFallback(record.marketStatus),
      productionYear: Math.round(numberOrFallback(record.productionYear, fallback.productionYear)),
      condition: stringOrFallback(record.condition, fallback.condition),
      movement: stringOrFallback(record.movement, fallback.movement),
      scope: stringOrFallback(record.scope, fallback.scope),
      rating: numberOrFallback(record.rating, fallback.rating),
      salesAmount: Math.max(0, Math.round(numberOrFallback(record.salesAmount, fallback.salesAmount))),
      lowestPrice: numberOrFallback(record.lowestPrice, fallback.lowestPrice),
      highestPrice: numberOrFallback(record.highestPrice, fallback.highestPrice),
      priceTrendData: priceTrendData.length > 0 ? priceTrendData : fallback.priceTrendData,
      liquidityScope: levelOrFallback(record.liquidityScope),
      listingVolumeAmount: Math.max(0, Math.round(numberOrFallback(record.listingVolumeAmount, fallback.listingVolumeAmount))),
      listingVolumePercentage: Math.max(0, Math.min(100, numberOrFallback(record.listingVolumePercentage, fallback.listingVolumePercentage))),
      volatility: levelOrFallback(record.volatility),
      description: stringOrFallback(record.description, fallback.description),
      image: stringOrFallback(record.image, fallback.image),
      sourceUrl: stringOrFallback(record.sourceUrl, fallback.sourceUrl),
      similarProducts: similarProducts.length > 0 ? similarProducts.slice(0, 5) : fallback.similarProducts
    };
  });
};

const analysisEmbeddingInput = (analysis: ImageAnalysis): string =>
  JSON.stringify({
    containsWatch: analysis.containsWatch,
    probableBrand: analysis.probableBrand ?? null,
    probableModel: analysis.probableModel ?? null,
    probableReferenceNumber: analysis.probableReferenceNumber ?? null,
    generatedTitle: analysis.generatedTitle ?? null,
    visualAttributes: analysis.visualAttributes
  });

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const openAiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as OpenAiErrorPayload;
    return payload.error?.message ? `${fallback}: ${payload.error.message}` : fallback;
  } catch {
    return fallback;
  }
};

export class HttpAiProvider implements AiProvider {
  public async analyzeImage(payload: ImageAnalysisRequest): Promise<ImageAnalysis> {
    const config = getAiConfig();
    if (!config.serviceUrl || !config.serviceToken) {
      throw new ConflictError("AI service URL and token are required.");
    }

    const serviceUrl = trimTrailingSlash(config.serviceUrl);
    if (serviceUrl.includes("api.openai.com")) {
      return this.analyzeWithOpenAi(serviceUrl, config.serviceToken, payload);
    }

    const response = await fetch(`${serviceUrl}/analyze-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new ExternalServiceError(`AI service failed with status ${response.status}.`);
    }

    return normalizeAnalysis(await response.json(), payload.modelVersion ?? "http-v1");
  }

  public async normalizeSearchQuery(
    payload: SearchQueryNormalizationRequest
  ): Promise<SearchQueryNormalization> {
    const config = getAiConfig();
    if (!config.serviceUrl || !config.serviceToken) {
      throw new ConflictError("AI service URL and token are required.");
    }

    const serviceUrl = trimTrailingSlash(config.serviceUrl);
    if (serviceUrl.includes("api.openai.com")) {
      return this.normalizeSearchQueryWithOpenAi(serviceUrl, config.serviceToken, payload);
    }

    const response = await fetch(`${serviceUrl}/normalize-search-query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new ExternalServiceError(`AI search query normalization failed with status ${response.status}.`);
    }

    return normalizeSearchQueryResponse(await response.json(), payload.modelVersion ?? "http-v1");
  }

  public async inferProductDetails(payload: ProductDetailGuessRequest): Promise<ProductDetailGuess[]> {
    const config = getAiConfig();
    if (!config.serviceUrl || !config.serviceToken) {
      return payload.products.map(localProductGuess);
    }

    const serviceUrl = trimTrailingSlash(config.serviceUrl);
    if (serviceUrl.includes("api.openai.com")) {
      return this.inferProductDetailsWithOpenAi(serviceUrl, config.serviceToken, payload);
    }

    return payload.products.map(localProductGuess);
  }

  private async analyzeWithOpenAi(
    serviceUrl: string,
    serviceToken: string,
    payload: ImageAnalysisRequest
  ): Promise<ImageAnalysis> {
    const config = getAiConfig();
    const imageUrl = payload.imageDataUrl ?? payload.imageUrl;
    const response = await fetch(`${serviceUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: payload.modelVersion ?? config.model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Analyze this watch image. Return only structured fields for whether it contains a watch, a concise marketplace search title, probable brand, model, reference number, and concise visual attributes. The generatedTitle should be suitable to paste into eBay search, preferring brand, model, size/variant, and reference number when visible or strongly implied."
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "low"
              }
            ]
          }
        ],
        max_output_tokens: 400,
        text: {
          format: {
            type: "json_schema",
            name: "watch_image_analysis",
            schema: imageAnalysisSchema,
            strict: true
          }
        }
      })
    });

    if (!response.ok) {
      throw new ExternalServiceError(
        await openAiErrorMessage(response, `OpenAI image analysis failed with status ${response.status}`)
      );
    }

    const responsePayload = (await response.json()) as OpenAiResponsePayload;
    const responseText = textFromOpenAiResponse(responsePayload);
    if (!responseText) {
      throw new ExternalServiceError(
        openAiMissingTextMessage(responsePayload, "OpenAI image analysis response did not include text output")
      );
    }

    let parsedAnalysis: unknown;
    try {
      parsedAnalysis = JSON.parse(responseText);
    } catch {
      throw new ExternalServiceError("OpenAI image analysis response was not valid JSON.");
    }

    const analysis = normalizeAnalysis(parsedAnalysis, payload.modelVersion ?? config.model);
    if (payload.includeEmbedding !== false) {
      analysis.embedding = await this.createEmbedding(serviceUrl, serviceToken, analysisEmbeddingInput(analysis));
    }
    return analysis;
  }

  private async normalizeSearchQueryWithOpenAi(
    serviceUrl: string,
    serviceToken: string,
    payload: SearchQueryNormalizationRequest
  ): Promise<SearchQueryNormalization> {
    const config = getAiConfig();
    const response = await fetch(`${serviceUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: payload.modelVersion ?? config.model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Rewrite this user watch-search text into a concise eBay Browse API query. Correct typos, expand incomplete luxury watch brand/model names, add watch context when useful, and do not invent reference numbers or facts that are not implied. Return only the structured JSON fields."
              },
              {
                type: "input_text",
                text: `User query: ${payload.query}`
              }
            ]
          }
        ],
        max_output_tokens: 200,
        text: {
          format: {
            type: "json_schema",
            name: "watch_search_query",
            schema: searchQueryNormalizationSchema,
            strict: true
          }
        }
      })
    });

    if (!response.ok) {
      throw new ExternalServiceError(
        await openAiErrorMessage(response, `OpenAI search query normalization failed with status ${response.status}`)
      );
    }

    const responsePayload = (await response.json()) as OpenAiResponsePayload;
    const responseText = textFromOpenAiResponse(responsePayload);
    if (!responseText) {
      throw new ExternalServiceError(
        openAiMissingTextMessage(responsePayload, "OpenAI search query response did not include text output")
      );
    }

    let parsedNormalization: unknown;
    try {
      parsedNormalization = JSON.parse(responseText);
    } catch {
      throw new ExternalServiceError("OpenAI search query response was not valid JSON.");
    }

    return normalizeSearchQueryResponse(parsedNormalization, payload.modelVersion ?? config.model);
  }

  private async inferProductDetailsWithOpenAi(
    serviceUrl: string,
    serviceToken: string,
    payload: ProductDetailGuessRequest
  ): Promise<ProductDetailGuess[]> {
    const config = getAiConfig();
    const response = await fetch(`${serviceUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: payload.modelVersion ?? config.model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Infer missing luxury watch marketplace product details. Prefer provided values. When missing, make plausible estimates from title, condition, price, and marketplace context. Return no null values or empty strings. Include exactly five similarProducts for each product. Keep descriptions concise and buyer-facing. Use numeric estimates for price, rating, sales, volume, and trend fields."
              },
              {
                type: "input_text",
                text: JSON.stringify({
                  query: payload.query,
                  products: payload.products
                })
              }
            ]
          }
        ],
        max_output_tokens: 2200,
        text: {
          format: {
            type: "json_schema",
            name: "watch_product_detail_guesses",
            schema: productDetailGuessSchema,
            strict: true
          }
        }
      })
    });

    if (!response.ok) {
      return payload.products.map(localProductGuess);
    }

    const responsePayload = (await response.json()) as OpenAiResponsePayload;
    const responseText = textFromOpenAiResponse(responsePayload);
    if (!responseText) {
      return payload.products.map(localProductGuess);
    }

    try {
      return normalizeProductGuesses(JSON.parse(responseText), payload.products);
    } catch {
      return payload.products.map(localProductGuess);
    }
  }

  private async createEmbedding(serviceUrl: string, serviceToken: string, input: string): Promise<number[]> {
    const config = getAiConfig();
    const response = await fetch(`${serviceUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.embeddingModel,
        input,
        encoding_format: "float"
      })
    });

    if (!response.ok) {
      throw new ExternalServiceError(
        await openAiErrorMessage(response, `OpenAI embedding request failed with status ${response.status}`)
      );
    }

    const payload = (await response.json()) as EmbeddingPayload;
    return payload.data?.[0]?.embedding ?? [];
  }
}

export const createAiProvider = (): AiProvider => {
  const config = getAiConfig();
  return config.provider === "http" ? new HttpAiProvider() : new LocalAiProvider();
};
