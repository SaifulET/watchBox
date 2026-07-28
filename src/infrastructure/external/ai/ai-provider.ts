export type ImageAnalysis = {
  containsWatch: boolean;
  probableBrand?: string;
  probableModel?: string;
  probableReferenceNumber?: string;
  visualAttributes: Record<string, string>;
  embedding: number[];
  modelVersion: string;
};

export type ImageAnalysisRequest = {
  imageUrl: string;
  modelVersion?: string;
};

export interface AiProvider {
  analyzeImage(payload: ImageAnalysisRequest): Promise<ImageAnalysis>;
}

export class LocalAiProvider implements AiProvider {
  public analyzeImage(payload: ImageAnalysisRequest): Promise<ImageAnalysis> {
    const seed = [...payload.imageUrl].reduce((total, char) => total + char.charCodeAt(0), 0);
    const embedding = Array.from({ length: 64 }, (_value, index) => {
      const raw = Math.sin(seed + index) * 10_000;
      return Number((raw - Math.floor(raw)).toFixed(6));
    });

    return Promise.resolve({
      containsWatch: true,
      probableBrand: "Rolex",
      probableModel: "Submariner",
      probableReferenceNumber: "126610LN",
      visualAttributes: { case: "round", dial: "black", bezel: "ceramic" },
      embedding,
      modelVersion: payload.modelVersion ?? "local-v1"
    });
  }
}
