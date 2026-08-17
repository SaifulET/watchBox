import type { Chrono24Product } from "./chrono24.types.js";

type ScoredProduct = Chrono24Product & {
  similarityScore: number;
  matchReasons: string[];
};

const normalized = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

const sameText = (left: string | null | undefined, right: string | null | undefined): boolean =>
  Boolean(normalized(left) && normalized(left) === normalized(right));

const priceScore = (left: number, right: number): number => {
  if (left <= 0 || right <= 0) {
    return 0;
  }
  const delta = Math.abs(left - right) / Math.max(left, right);
  if (delta <= 0.05) {
    return 16;
  }
  if (delta <= 0.15) {
    return 10;
  }
  if (delta <= 0.3) {
    return 4;
  }
  return 0;
};

const yearScore = (left: number | null, right: number | null): number => {
  if (!left || !right) {
    return 0;
  }
  const delta = Math.abs(left - right);
  if (delta === 0) {
    return 8;
  }
  if (delta <= 2) {
    return 5;
  }
  if (delta <= 5) {
    return 2;
  }
  return 0;
};

export const similarChrono24Products = (
  target: Chrono24Product,
  candidates: Chrono24Product[],
  limit: number
): ScoredProduct[] =>
  candidates
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate) => {
      let score = 0;
      const matchReasons: string[] = [];
      if (sameText(candidate.reference, target.reference)) {
        score += 40;
        matchReasons.push("same reference");
      }
      if (sameText(candidate.model, target.model)) {
        score += 24;
        matchReasons.push("same model");
      }
      if (sameText(candidate.brand, target.brand)) {
        score += 18;
        matchReasons.push("same brand");
      }
      const candidatePriceScore = priceScore(candidate.price, target.price);
      if (candidatePriceScore > 0) {
        score += candidatePriceScore;
        matchReasons.push("similar price");
      }
      if (sameText(candidate.condition, target.condition)) {
        score += 8;
        matchReasons.push("same condition");
      }
      const candidateYearScore = yearScore(candidate.year, target.year);
      if (candidateYearScore > 0) {
        score += candidateYearScore;
        matchReasons.push("similar year");
      }
      if (sameText(candidate.caseMaterial, target.caseMaterial)) {
        score += 6;
        matchReasons.push("same case material");
      }
      if (sameText(candidate.movement, target.movement)) {
        score += 6;
        matchReasons.push("same movement");
      }
      return {
        ...candidate,
        similarityScore: Math.min(100, score),
        matchReasons
      };
    })
    .filter((candidate) => candidate.similarityScore > 0)
    .sort((left, right) => right.similarityScore - left.similarityScore || left.price - right.price)
    .slice(0, limit);
