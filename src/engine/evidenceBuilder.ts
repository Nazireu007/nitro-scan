import type { Evidence, Hypothesis } from '../types/diagnostics';
import type { DiagnosticEvidence } from './types';

const severityByLevel: Record<Evidence['level'], DiagnosticEvidence['severity']> = {
  info: 'INFO',
  warning: 'WARN',
  critical: 'FAIL',
  success: 'OK',
};

export function uniqueEvidences(evidences: Evidence[]): Evidence[] {
  return Array.from(
    evidences
      .reduce((map, evidence) => {
        if (!map.has(evidence.id)) {
          map.set(evidence.id, evidence);
        }

        return map;
      }, new Map<string, Evidence>())
      .values(),
  );
}

export function buildConclusionTexts(evidences: Evidence[]): string[] {
  const conclusions: string[] = [];

  if (evidences.some((evidence) => evidence.id === 'source-functional-forced-command')) {
    conclusions.push('Fonte classificada como funcional no teste com comando forçado.');
  }

  if (evidences.some((evidence) => evidence.id === 'main-board-no-boot-sequence')) {
    conclusions.push('A placa principal não inicializa a sequência de boot/controle.');
  }

  if (evidences.some((evidence) => evidence.id === 'probable-shorted-rail')) {
    conclusions.push('Curto provável detectado no trilho medido.');
  }

  if (evidences.some((evidence) => evidence.id === 'manual-insufficient-measurements')) {
    conclusions.push('Medições insuficientes para diagnóstico confiável.');
  }

  return conclusions.length > 0 ? conclusions : ['Medições capturadas correspondem a um padrão diagnóstico conhecido.'];
}

export function buildHypothesisEvidence(hypotheses: Hypothesis[]): Evidence[] {
  return hypotheses
    .filter((hypothesis) => hypothesis.id !== 'source_functional')
    .map((hypothesis) => ({
      id: `${hypothesis.id}-confidence`,
      level: hypothesis.confidence >= 70 ? 'critical' : hypothesis.confidence >= 40 ? 'warning' : 'info',
      text: `${hypothesis.title}: ${hypothesis.confidence}%.`,
      source: 'scoring',
      relatedRule: 'scoreHypotheses',
      relatedMeasurements: hypothesis.relatedMeasurements,
      strength: hypothesis.confidence >= 60 ? 'strong' : hypothesis.confidence >= 40 ? 'medium' : 'weak',
    }));
}

export function toLegacyEvidence(evidences: Evidence[]): DiagnosticEvidence[] {
  return uniqueEvidences(evidences).map((evidence) => ({
    id: evidence.id,
    severity: severityByLevel[evidence.level],
    title: evidence.source,
    detail: evidence.text,
    sourceRuleId: evidence.relatedRule,
  }));
}
