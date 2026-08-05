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

export interface AiProvider {
  analyzeImage(payload: ImageAnalysisRequest): Promise<ImageAnalysis>;
  normalizeSearchQuery(payload: SearchQueryNormalizationRequest): Promise<SearchQueryNormalization>;
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
}

type OpenAiTextOutput = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  content?: OpenAiTextOutput[];
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: OpenAiOutputItem[];
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

type OpenAiErrorPayload = {
  error?: {
    message?: string;
  };
};

const textFromOpenAiResponse = (payload: OpenAiResponsePayload): string | undefined => {
  if (payload.output_text) {
    return payload.output_text;
  }
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }
  return undefined;
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

    const responseText = textFromOpenAiResponse((await response.json()) as OpenAiResponsePayload);
    if (!responseText) {
      throw new ExternalServiceError("OpenAI image analysis response did not include text output.");
    }

    const analysis = normalizeAnalysis(JSON.parse(responseText), payload.modelVersion ?? config.model);
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

    const responseText = textFromOpenAiResponse((await response.json()) as OpenAiResponsePayload);
    if (!responseText) {
      throw new ExternalServiceError("OpenAI search query response did not include text output.");
    }

    return normalizeSearchQueryResponse(JSON.parse(responseText), payload.modelVersion ?? config.model);
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
