import type { BehaviorCategory, EvidenceStrength, Severity } from '../types/behaviors';
import type { Hypothesis } from '../types/diagnostics';

export type HypothesisSeed = {
  id: string;
  title: string;
  description: string;
  category: BehaviorCategory;
  severity: Severity;
  suspects: string[];
  relatedMeasurements: string[];
  evidenceIds: string[];
  contributions: EvidenceStrength[];
  confidenceOffset?: number;
};

const scoreByStrength: Record<EvidenceStrength, number> = {
  strong: 30,
  medium: 20,
  weak: 10,
  conflict: -15,
  missing: 0,
};

function mergeSeed(left: HypothesisSeed, right: HypothesisSeed): HypothesisSeed {
  return {
    ...left,
    suspects: Array.from(new Set([...left.suspects, ...right.suspects])),
    relatedMeasurements: Array.from(new Set([...left.relatedMeasurements, ...right.relatedMeasurements])),
    evidenceIds: Array.from(new Set([...left.evidenceIds, ...right.evidenceIds])),
    contributions: [...left.contributions, ...right.contributions],
    confidenceOffset: (left.confidenceOffset ?? 0) + (right.confidenceOffset ?? 0),
  };
}

export function scoreHypotheses(seeds: HypothesisSeed[]): Hypothesis[] {
  const merged = seeds.reduce((map, seed) => {
    const current = map.get(seed.id);
    map.set(seed.id, current ? mergeSeed(current, seed) : seed);

    return map;
  }, new Map<string, HypothesisSeed>());

  return Array.from(merged.values())
    .map((seed) => {
      const rawScore = seed.contributions.reduce((total, strength) => total + scoreByStrength[strength], 0);
      const confidence = Math.max(0, Math.min(100, Math.round(rawScore + (seed.confidenceOffset ?? 0))));

      return {
        id: seed.id,
        title: seed.title,
        description: seed.description,
        confidence,
        suspects: seed.suspects,
        relatedMeasurements: seed.relatedMeasurements,
        evidenceIds: seed.evidenceIds,
        severity: seed.severity,
        category: seed.category,
      };
    })
    .filter((hypothesis) => hypothesis.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);
}
