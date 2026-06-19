import { lgCj87DiagnosticCase } from '../data/diagnosticCases';
import type { DiagnosticResult, DiagnosticSession } from '../types/diagnostics';
import type {
  ConfirmationState,
  MeasurementInput,
  MeasurementTestMode,
  MeasurementTestOrigin,
  MeasurementType,
} from '../types/measurements';
import { runBehaviorEngine } from './behaviorEngine';

export type ConsoleScanInput = {
  testMode: MeasurementTestMode;
  testOrigin: MeasurementTestOrigin;
  node: string;
  response: string;
  unit: string;
  context: string;
};

export type ConsoleAnalysis = {
  session: DiagnosticSession;
  result: DiagnosticResult;
  confirmationState: ConfirmationState;
  headline: string;
  confidence: number;
  analyzedAt: string;
  source: 'manual' | 'lg-demo';
};

export const consoleTestModeOptions: Array<{ value: MeasurementTestMode; label: string }> = [
  { value: 'offline_scan', label: 'Scan offline' },
  { value: 'line_to_gnd', label: 'Linha para GND' },
  { value: 'low_injection', label: 'Injeção baixa' },
  { value: 'sine_wave', label: 'Onda senoidal' },
  { value: 'connector_response', label: 'Resposta por conector' },
  { value: 'component_test', label: 'Teste de componente' },
  { value: 'confirmation', label: 'Confirmação' },
];

export const consoleTestOriginOptions: Array<{ value: MeasurementTestOrigin; label: string }> = [
  { value: 'probe', label: 'Ponta de prova' },
  { value: 'dc_jack', label: 'DC Jack' },
  { value: 'usb_c_charge', label: 'USB-C / conector de carga' },
  { value: 'battery_connector', label: 'Conector de bateria' },
  { value: 'power_connector', label: 'Conector de fonte' },
  { value: 'signal_flex', label: 'Flat / conector de sinal' },
  { value: 'other_board_connector', label: 'Outro conector da placa' },
];

export const consoleUnitOptions = [
  { value: 'Ω', label: 'Ω' },
  { value: 'V', label: 'V' },
  { value: 'A', label: 'A' },
  { value: '%', label: '%' },
  { value: 'lógico', label: 'Lógico' },
  { value: 'estado', label: 'Estado' },
];

const confirmationRank: Record<ConfirmationState, number> = {
  detected: 1,
  correlated: 2,
  strong_indication: 3,
  confirmed: 4,
};

export function createDefaultConsoleInput(): ConsoleScanInput {
  return {
    testMode: 'offline_scan',
    testOrigin: 'probe',
    node: '',
    response: '',
    unit: 'Ω',
    context: 'placa desligada; pré-scan de segurança',
  };
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferMeasurementType(input: ConsoleScanInput): MeasurementType {
  if (input.unit === 'V') return 'voltage';
  if (input.unit === 'A') return 'current';
  if (input.unit === 'Ω') return 'resistance';
  if (input.unit === 'lógico' || input.testMode === 'sine_wave' || input.testMode === 'connector_response') return 'signal';

  return 'state';
}

function inferConfirmation(input: ConsoleScanInput): ConfirmationState {
  const source = normalizeText(`${input.response} ${input.context}`);

  if (
    input.testMode === 'confirmation' &&
    ['confirmado', 'normalizou', 'apos isolar', 'após isolar', 'prova eletrica'].some((term) => source.includes(normalizeText(term)))
  ) {
    return 'confirmed';
  }

  if (source.includes('forte indicio')) return 'strong_indication';
  if (source.includes('correlacionado')) return 'correlated';

  return 'detected';
}

function measurementLabel(input: ConsoleScanInput): string {
  if (input.testMode === 'line_to_gnd') return `Linha ${input.node || 'alvo'} para GND`;
  if (input.testMode === 'low_injection') return `Injeção baixa em ${input.node || 'linha alvo'}`;
  if (input.testMode === 'sine_wave') return `Resposta de onda em ${input.node || 'ponto de leitura'}`;
  if (input.testMode === 'connector_response') return `Resposta no conector ${input.node || 'medido'}`;

  return `Scan em ${input.node || 'ponto de teste'}`;
}

function createMeasurement(input: ConsoleScanInput, timestamp: string): MeasurementInput {
  const type = inferMeasurementType(input);
  const context = [input.context, 'placa desligada'].filter(Boolean).join('; ');

  return {
    id: `console-${Date.now()}`,
    label: measurementLabel(input),
    type,
    value: input.response.trim() || 'n/d',
    unit: input.unit,
    node: input.node.trim() || 'ponto de teste',
    component: input.testOrigin,
    context,
    testMode: input.testMode,
    testOrigin: input.testOrigin,
    injectionVoltage: input.testMode === 'low_injection' && input.unit === 'V' ? input.response.trim() : undefined,
    measuredCurrent: type === 'current' ? input.response.trim() : undefined,
    returnAmplitude: input.unit === '%' || input.testMode === 'connector_response' ? input.response.trim() : undefined,
    readChannel: input.testMode === 'sine_wave' || input.testMode === 'connector_response' ? input.node.trim() : undefined,
    confirmationState: inferConfirmation(input),
    timestamp,
  };
}

export function buildConsoleSession(input: ConsoleScanInput): DiagnosticSession {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('pt-BR', { hour12: false });

  return {
    id: `console-scan-${now.getTime()}`,
    title: input.node.trim() ? `Scan offline — ${input.node.trim()}` : 'Nova análise offline',
    deviceCategory: 'Placa desligada',
    symptoms: [input.context.trim() || 'Leitura manual de bancada'],
    measurements: input.response.trim() || input.node.trim() ? [createMeasurement(input, timestamp)] : [],
    selectedCase: 'manual-console',
    createdAt: now.toISOString(),
  };
}

function primaryHypothesis(result: DiagnosticResult) {
  return result.hypotheses.find((hypothesis) => hypothesis.id !== 'source_functional') ?? result.hypotheses[0];
}

function resolveConfirmation(session: DiagnosticSession, result: DiagnosticResult): ConfirmationState {
  const explicit = session.measurements
    .map((measurement) => measurement.confirmationState)
    .filter((state): state is ConfirmationState => Boolean(state))
    .sort((left, right) => confirmationRank[right] - confirmationRank[left])[0];

  if (explicit === 'confirmed') return 'confirmed';

  const confidence = primaryHypothesis(result)?.confidence ?? 0;
  if (explicit === 'strong_indication' || confidence >= 70) return 'strong_indication';
  if (explicit === 'correlated' || confidence >= 40) return 'correlated';

  return 'detected';
}

function cleanHypothesisTitle(value: string): string {
  return value
    .replace(/\s+suspeit[oa]$/i, '')
    .replace(/\s+provável$/i, '')
    .trim();
}

function buildHeadline(result: DiagnosticResult, state: ConfirmationState): string {
  if (result.evidences.some((evidence) => evidence.id === 'manual-insufficient-measurements')) {
    return 'LEITURA INSUFICIENTE';
  }

  const hypothesis = primaryHypothesis(result);
  if (!hypothesis) return 'PADRÃO NÃO CONCLUSIVO';

  const title = cleanHypothesisTitle(hypothesis.title).toUpperCase();
  const prefix: Record<ConfirmationState, string> = {
    detected: 'DETECTADO',
    correlated: 'CORRELACIONADO',
    strong_indication: 'FORTE INDÍCIO',
    confirmed: 'CONFIRMADO',
  };

  return `${prefix[state]} — ${title}`;
}

function toConsoleAnalysis(session: DiagnosticSession, source: ConsoleAnalysis['source']): ConsoleAnalysis {
  const result = runBehaviorEngine(session);
  const confirmationState = resolveConfirmation(session, result);

  return {
    session,
    result,
    confirmationState,
    headline: buildHeadline(result, confirmationState),
    confidence: primaryHypothesis(result)?.confidence ?? 0,
    analyzedAt: new Date().toISOString(),
    source,
  };
}

export function analyzeConsoleInput(input: ConsoleScanInput): ConsoleAnalysis {
  return toConsoleAnalysis(buildConsoleSession(input), 'manual');
}

export function loadLgConsoleCase(): ConsoleAnalysis {
  return toConsoleAnalysis(lgCj87DiagnosticCase, 'lg-demo');
}

