import type { ComponentFinding } from '../types/components';
import type { ConfirmationDecision, ConfirmationState } from '../types/confirmation';
import type { Evidence, NextTest } from '../types/diagnostics';
import type { LineFinding, OfflineScanInput } from '../types/offlineScan';
import type { InjectionResponseFinding } from './injectionResponseAnalyzer';

type ConfirmationInput = {
  input: OfflineScanInput;
  evidences: Evidence[];
  lineFindings: LineFinding[];
  componentFindings: ComponentFinding[];
  injectionFindings: InjectionResponseFinding[];
};

function normalizeText(value: string | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sourceText(input: OfflineScanInput): string {
  return normalizeText(
    [
      input.testMode,
      input.node,
      input.response,
      input.context,
      input.componentLabel,
      input.componentType,
      input.confirmationState,
    ].join(' '),
  );
}

function hasAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(normalizeText(pattern)));
}

function confirmationTest(id: string, title: string, description: string, priority: number): NextTest {
  return {
    id,
    title,
    description,
    priority,
    safetyNote: 'Executar com placa desligada e energia limitada quando houver injeção.',
  };
}

function stateLabel(state: ConfirmationState): string {
  if (state === 'confirmed') return 'CONFIRMADO';
  if (state === 'strong_indication') return 'FORTE INDÍCIO';
  if (state === 'correlated') return 'CORRELACIONADO';
  return 'DETECTADO';
}

export function runConfirmationEngine({
  input,
  evidences,
  lineFindings,
  componentFindings,
  injectionFindings,
}: ConfirmationInput): ConfirmationDecision {
  const source = sourceText(input);
  const onlyNormalResponse =
    lineFindings.length > 0 &&
    lineFindings.every((finding) => finding.status === 'normal') &&
    componentFindings.length === 0 &&
    injectionFindings.every((finding) => finding.status === 'normal_return');

  if (onlyNormalResponse) {
    return {
      confirmationState: 'detected',
      confidence: 58,
      reasons: ['Resposta elétrica dentro do padrão informado para a linha analisada.'],
      missingProofs: [],
      nextConfirmationTests: [],
    };
  }
  const confirmationRequested = input.confirmationState === 'confirmed';
  const hasClosureProof = hasAny(source, [
      'linha normalizou',
      'normalizou apos isolar',
      'normalizou após isolar',
      'curto sumiu',
      'remocao normaliza',
      'remoção normaliza',
      'remover componente',
      'reparo de trilha normalizou',
      'jumper normalizou',
      'continuidade confirma aberto',
    ]);
  const hasLocalizedThermalProof =
    hasAny(source, ['aquecimento localizado']) &&
    hasAny(source, ['injecao limitada', 'injeção limitada', 'baixa injecao', 'baixa injeção']) &&
    Boolean(input.componentLabel || input.componentType);
  const confirmedComponent = componentFindings.find((finding) => finding.confirmationState === 'confirmed');

  if (hasClosureProof || hasLocalizedThermalProof || confirmedComponent) {
    const reasons = [
      hasClosureProof ? 'Linha normalizou ou o caminho foi fechado após isolamento/remoção do setor suspeito.' : undefined,
      hasLocalizedThermalProof ? 'Aquecimento localizado durante injeção limitada fechou prova elétrica no componente indicado.' : undefined,
      confirmedComponent ? `${confirmedComponent.componentLabel} possui confirmação por prova elétrica.` : undefined,
    ].filter((reason): reason is string => Boolean(reason));

    return {
      confirmationState: 'confirmed',
      confidence: hasClosureProof ? 100 : 94,
      reasons,
      missingProofs: [],
      nextConfirmationTests: [],
    };
  }

  const strongSignals = [
    ...lineFindings.filter((finding) => finding.severity === 'critical' || finding.confidence >= 78),
    ...componentFindings.filter((finding) => finding.confirmationState === 'strong_indication' || finding.confidence >= 78),
    ...injectionFindings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high'),
  ].length;
  const evidenceStrength = evidences.filter((evidence) => evidence.strength === 'strong').length;
  const hasShortAndInjection =
    lineFindings.some((finding) => finding.status === 'low_impedance' || finding.status === 'short_detected') &&
    injectionFindings.some((finding) => finding.status === 'high_current_low_voltage');
  const hasOpenPathEvidence =
    lineFindings.some((finding) => finding.status === 'open_path' || finding.status === 'no_return_signal') ||
    injectionFindings.some((finding) => finding.status === 'no_return');
  const hasAttenuatedCorrelation =
    lineFindings.some((finding) => finding.status === 'attenuated_response') &&
    injectionFindings.some((finding) => finding.status === 'attenuated_return');

  let confirmationState: ConfirmationState = 'detected';
  let confidence = 42;

  if (strongSignals >= 3 || hasShortAndInjection || componentFindings.some((finding) => finding.confirmationState === 'strong_indication')) {
    confirmationState = 'strong_indication';
    confidence = 82;
  } else if (strongSignals >= 2 || evidenceStrength >= 2 || hasOpenPathEvidence || hasAttenuatedCorrelation) {
    confirmationState = 'correlated';
    confidence = 66;
  } else if (strongSignals >= 1 || evidences.length > 0) {
    confirmationState = 'detected';
    confidence = 48;
  }

  if (confirmationRequested && confirmationState !== 'strong_indication') {
    confirmationState = 'strong_indication';
    confidence = Math.max(confidence, 75);
  }

  const missingProofs = [
    lineFindings.some((finding) => finding.status === 'low_impedance' || finding.status === 'short_detected')
      ? 'Isolar carga/componente e repetir resistência para confirmar que o curto sumiu.'
      : undefined,
    hasOpenPathEvidence ? 'Confirmar continuidade entre ponto A e B para fechar caminho aberto.' : undefined,
    componentFindings.length > 0 ? 'Repetir medição após isolar o componente indicado.' : undefined,
  ].filter((proof): proof is string => Boolean(proof));

  return {
    confirmationState,
    confidence,
    reasons: [
      `${stateLabel(confirmationState)} por correlação de ${Math.max(strongSignals, evidenceStrength, evidences.length)} evidência(s) elétrica(s).`,
    ],
    missingProofs: missingProofs.length > 0 ? missingProofs : ['Executar prova elétrica de fechamento antes de marcar como confirmado.'],
    nextConfirmationTests: [
      confirmationTest(
        `${input.id}-confirmation-isolate`,
        'Isolar setor suspeito e repetir leitura.',
        'Separar carga ou componente indicado e confirmar se a linha muda de estado.',
        1,
      ),
      confirmationTest(
        `${input.id}-confirmation-before-after`,
        'Registrar medição antes/depois.',
        'Comparar a leitura original com a leitura após isolamento para fechar prova elétrica.',
        2,
      ),
    ],
  };
}
