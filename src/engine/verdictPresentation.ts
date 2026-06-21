import type { ConfirmationState } from '../types/confirmation';
import type { DiagnosticResult } from '../types/diagnostics';

export type VerdictStatus = 'open' | 'line_failure' | 'confirmed' | 'blocked';

export function verdictStatusFromState(state: ConfirmationState): VerdictStatus {
  if (state === 'confirmed') return 'confirmed';
  if (state === 'correlated') return 'line_failure';
  return 'open';
}

export const verdictLabels: Record<VerdictStatus, string> = {
  open: 'SEM VEREDITO FECHADO',
  line_failure: 'FALHA CONFIRMADA NA LINHA',
  confirmed: 'VEREDITO CONFIRMADO',
  blocked: 'TESTE BLOQUEADO POR SEGURANÇA',
};

export function neutralizeDiagnosticText(value: string): string {
  return value
    .replace(/forte indício/gi, 'evidências fortes sem fechamento')
    .replace(/hipóteses? principais/gi, 'leituras do diagnóstico')
    .replace(/hipóteses?/gi, 'leituras')
    .replace(/provavelmente/gi, 'com indicação técnica')
    .replace(/provável/gi, 'a confirmar')
    .replace(/suspeit[oa]s?/gi, 'a confirmar')
    .replace(/talvez/gi, 'a confirmar')
    .replace(/regiões a confirmar/gi, 'regiões em teste');
}

export function verdictHeadline(status: VerdictStatus, confirmedDefect?: string): string {
  if (status === 'blocked') return verdictLabels.blocked;
  if (status === 'confirmed') return `${verdictLabels.confirmed} — ${confirmedDefect || 'DIAGNÓSTICO FECHADO'}`;
  if (status === 'line_failure') return 'FALHA CONFIRMADA NA LINHA — COMPONENTE AINDA NÃO FECHADO';
  return 'SEM VEREDITO FECHADO — PROVA NECESSÁRIA';
}

export function verdictSummary(status: VerdictStatus, proofOrPending?: string): string {
  const detail = proofOrPending ? ` ${neutralizeDiagnosticText(proofOrPending)}` : '';
  if (status === 'blocked') return 'O Nitro bloqueou a operação para proteger a Nitro Box e a placa.';
  if (status === 'confirmed') return `Diagnóstico fechado por prova elétrica/visual.${detail}`;
  if (status === 'line_failure') return `A linha apresenta anomalia comprovada. Falta prova para cravar o componente.${detail}`;
  return `Falha inicial detectada. Falta prova elétrica para fechar diagnóstico.${detail}`;
}

export function presentDiagnosticResult(
  result: DiagnosticResult,
  status: VerdictStatus,
  proofOrPending?: string,
): DiagnosticResult {
  return {
    ...result,
    hypotheses: result.hypotheses.map((item) => ({
      ...item,
      title: neutralizeDiagnosticText(item.title),
      description: neutralizeDiagnosticText(item.description),
      suspects: item.suspects.map(neutralizeDiagnosticText),
    })),
    evidences: result.evidences.map((item) => ({ ...item, text: neutralizeDiagnosticText(item.text) })),
    nextTests: result.nextTests.map((item) => ({
      ...item,
      title: neutralizeDiagnosticText(item.title),
      description: neutralizeDiagnosticText(item.description),
      safetyNote: item.safetyNote ? neutralizeDiagnosticText(item.safetyNote) : undefined,
      expectedResult: item.expectedResult ? neutralizeDiagnosticText(item.expectedResult) : undefined,
    })),
    logs: result.logs.map((item) => ({ ...item, message: neutralizeDiagnosticText(item.message) })),
    summary: verdictSummary(status, proofOrPending),
  };
}
