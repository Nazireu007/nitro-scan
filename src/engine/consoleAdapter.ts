import { lgCj87DiagnosticCase } from '../data/diagnosticCases';
import type { ComponentType } from '../types/components';
import type { DiagnosticLog, DiagnosticResult, DiagnosticSession, Hypothesis } from '../types/diagnostics';
import type {
  ConfirmationState,
  MeasurementInput,
  MeasurementTestMode,
  MeasurementTestOrigin,
  MeasurementType,
} from '../types/measurements';
import type { LineFinding, OfflineScanInput, OfflineScanResult } from '../types/offlineScan';
import { runBehaviorEngine } from './behaviorEngine';
import { runOfflineScan } from './offlineScanEngine';

export type ConsoleScanInput = {
  testMode: MeasurementTestMode;
  testOrigin: MeasurementTestOrigin;
  node: string;
  response: string;
  unit: string;
  context: string;
  injectionVoltage?: string;
  measuredCurrent?: string;
  signalFrequency?: string;
  returnAmplitude?: string;
  attenuation?: string;
  readChannel?: string;
  probeA?: string;
  probeB?: string;
  probeC?: string;
  componentLabel?: string;
  componentType?: ComponentType;
  confirmationState?: ConfirmationState;
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

function inputSource(input: ConsoleScanInput): string {
  return normalizeText(
    [
      input.testMode,
      input.testOrigin,
      input.node,
      input.response,
      input.unit,
      input.context,
      input.injectionVoltage,
      input.measuredCurrent,
      input.signalFrequency,
      input.returnAmplitude,
      input.attenuation,
      input.readChannel,
      input.componentLabel,
      input.componentType,
      input.confirmationState,
    ].join(' '),
  );
}

function hasAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(normalizeText(pattern)));
}

function firstMatch(source: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = source.match(pattern);

    if (match?.[1]) {
      return match[2] ? `${match[1]} ${match[2]}` : match[1];
    }
  }

  return undefined;
}

function inferComponentType(input: ConsoleScanInput): ComponentType | undefined {
  if (input.componentType) return input.componentType;

  const source = inputSource(input);

  if (hasAny(source, ['mosfet', 'd-s', 'dreno source', 'dreno-source'])) return 'mosfet';
  if (hasAny(source, ['capacitor', 'cap ceramico', 'cap cerâmico'])) return 'capacitor';
  if (hasAny(source, ['diodo', 'tvs'])) return 'diode';
  if (hasAny(source, ['bobina', 'indutor', 'l304'])) return 'inductor';
  if (hasAny(source, ['ldo'])) return 'ldo';
  if (hasAny(source, ['pwm'])) return 'pwm_controller';
  if (hasAny(source, ['buck'])) return 'buck_controller';
  if (hasAny(source, ['spi flash', 'firmware spi', 'spi'])) return 'spi_flash';
  if (hasAny(source, ['cpu', 'processador'])) return 'cpu';

  return undefined;
}

function inferComponentLabel(input: ConsoleScanInput, componentType: ComponentType | undefined): string | undefined {
  if (input.componentLabel?.trim()) return input.componentLabel.trim();

  const source = inputSource(input);

  if (source.includes('l304')) return 'L304';
  if (!componentType) return undefined;

  const labels: Record<ComponentType, string> = {
    capacitor: 'capacitor na linha',
    mosfet: 'MOSFET associado',
    diode: 'diodo associado',
    resistor: 'resistor associado',
    inductor: 'bobina associada',
    ldo: 'LDO associado',
    buck_controller: 'controlador buck',
    pwm_controller: 'controlador PWM',
    spi_flash: 'SPI Flash',
    cpu: 'CPU',
    unknown_ic: 'componente associado',
  };

  return labels[componentType];
}

function inferInjectionVoltage(input: ConsoleScanInput): string | undefined {
  if (input.injectionVoltage?.trim()) return input.injectionVoltage.trim();

  return firstMatch(`${input.response} ${input.context}`, [
    /(?:inje[cç][aã]o|injetad[ao]|injecao)\s*(?:baixa|limitada)?\s*:?\s*(\d+(?:[,.]\d+)?)\s*(v)/i,
    /(\d+(?:[,.]\d+)?)\s*(v)\s*(?:de\s*)?(?:inje[cç][aã]o|injecao|injetad[ao])/i,
  ]);
}

function inferMeasuredCurrent(input: ConsoleScanInput): string | undefined {
  if (input.measuredCurrent?.trim()) return input.measuredCurrent.trim();
  if (input.unit.toLowerCase() === 'a' && input.response.trim()) return input.response.trim();

  return firstMatch(`${input.response} ${input.context}`, [
    /(?:corrente|consumo)\s*(?:medida|alta|elevada)?\s*:?\s*(\d+(?:[,.]\d+)?)\s*(a)/i,
    /(\d+(?:[,.]\d+)?)\s*(a)\s*(?:na\s*)?(?:inje[cç][aã]o|injecao|consumo|corrente)/i,
  ]);
}

function inferSignalFrequency(input: ConsoleScanInput): string | undefined {
  if (input.signalFrequency?.trim()) return input.signalFrequency.trim();

  return firstMatch(`${input.response} ${input.context}`, [/(\d+(?:[,.]\d+)?)\s*(khz|hz)/i]);
}

function inferReturnAmplitude(input: ConsoleScanInput): string | undefined {
  if (input.returnAmplitude?.trim()) return input.returnAmplitude.trim();
  if (input.unit === '%' && input.response.trim()) return input.response.trim();

  return firstMatch(`${input.response} ${input.context}`, [
    /(?:retorno|amplitude)\s*:?\s*(\d+(?:[,.]\d+)?)\s*(%)/i,
    /(\d+(?:[,.]\d+)?)\s*(%)\s*(?:de\s*)?(?:retorno|amplitude)/i,
  ]);
}

function inferAttenuation(input: ConsoleScanInput): string | undefined {
  if (input.attenuation?.trim()) return input.attenuation.trim();

  const source = inputSource(input);

  if (hasAny(source, ['retorno muito atenuado', 'atenuacao alta', 'atenuação alta'])) return 'alta';
  if (hasAny(source, ['retorno atenuado', 'atenuacao media', 'atenuação média'])) return 'média';
  if (hasAny(source, ['baixa atenuacao', 'baixa atenuação'])) return 'baixa';

  return undefined;
}

function inferReadChannel(input: ConsoleScanInput): string | undefined {
  if (input.readChannel?.trim()) return input.readChannel.trim();

  const source = `${input.response} ${input.context} ${input.node}`;
  const match = source.match(/\b(?:ponto|canal)\s*([abc])\b/i);

  return match?.[1] ? `Ponto ${match[1].toUpperCase()}` : undefined;
}

function inferMeasurementType(input: ConsoleScanInput): MeasurementType {
  if (input.unit === 'V') return 'voltage';
  if (input.unit === 'A') return 'current';
  if (input.unit === 'Ω') return 'resistance';
  if (input.unit === 'lógico' || input.testMode === 'sine_wave' || input.testMode === 'connector_response') return 'signal';

  return 'state';
}

function inferConfirmation(input: ConsoleScanInput): ConfirmationState {
  if (input.confirmationState) return input.confirmationState;

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
  const componentType = inferComponentType(input);
  const injectionVoltage = inferInjectionVoltage(input);
  const measuredCurrent = inferMeasuredCurrent(input);
  const signalFrequency = inferSignalFrequency(input);
  const returnAmplitude = inferReturnAmplitude(input);
  const attenuation = inferAttenuation(input);
  const readChannel = inferReadChannel(input);

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
    injectionVoltage,
    measuredCurrent: measuredCurrent ?? (type === 'current' ? input.response.trim() : undefined),
    signalFrequency,
    returnAmplitude: returnAmplitude ?? (input.unit === '%' || input.testMode === 'connector_response' ? input.response.trim() : undefined),
    attenuation,
    readChannel: readChannel ?? (input.testMode === 'sine_wave' || input.testMode === 'connector_response' ? input.node.trim() : undefined),
    probeA: input.probeA,
    probeB: input.probeB,
    probeC: input.probeC,
    componentLabel: inferComponentLabel(input, componentType),
    componentType,
    confirmationState: inferConfirmation(input),
    timestamp,
  };
}

function hasConsoleScanInput(input: ConsoleScanInput): boolean {
  return Boolean(input.node.trim() || input.response.trim());
}

function buildOfflineScanInput(input: ConsoleScanInput, session: DiagnosticSession): OfflineScanInput {
  const componentType = inferComponentType(input);

  return {
    id: session.id,
    testMode: input.testMode,
    testOrigin: input.testOrigin,
    node: input.node.trim() || 'linha analisada',
    response: input.response.trim() || 'n/d',
    unit: input.unit,
    context: input.context.trim() || 'placa desligada; scan offline',
    injectionVoltage: inferInjectionVoltage(input),
    measuredCurrent: inferMeasuredCurrent(input),
    signalFrequency: inferSignalFrequency(input),
    returnAmplitude: inferReturnAmplitude(input),
    attenuation: inferAttenuation(input),
    readChannel: inferReadChannel(input),
    probeA: input.probeA,
    probeB: input.probeB,
    probeC: input.probeC,
    componentLabel: inferComponentLabel(input, componentType),
    componentType,
    confirmationState: inferConfirmation(input),
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

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function severityFromFinding(severity: LineFinding['severity']): Hypothesis['severity'] {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function titleFromLineFinding(finding: LineFinding): string {
  const titles: Record<LineFinding['status'], string> = {
    normal: 'Resposta elétrica normal',
    low_impedance: 'Baixa impedância detectada',
    short_detected: 'Linha em curto detectada',
    open_path: 'Caminho aberto detectado',
    attenuated_response: 'Retorno atenuado detectado',
    abnormal_load: 'Carga anormal detectada',
    no_return_signal: 'Retorno ausente detectado',
  };

  return titles[finding.status];
}

function lineCategory(status: LineFinding['status']): Hypothesis['category'] {
  if (status === 'low_impedance' || status === 'short_detected' || status === 'abnormal_load') return 'short';
  if (status === 'open_path' || status === 'no_return_signal' || status === 'attenuated_response') return 'control';
  return 'power';
}

function componentCategory(componentType: ComponentType): Hypothesis['category'] {
  if (componentType === 'capacitor' || componentType === 'mosfet' || componentType === 'diode' || componentType === 'ldo') return 'short';
  if (componentType === 'inductor' || componentType === 'buck_controller' || componentType === 'pwm_controller') return 'regulator';
  if (componentType === 'spi_flash') return 'firmware';
  if (componentType === 'cpu') return 'boot';
  return 'control';
}

function buildOfflineHypotheses(offline: OfflineScanResult): Hypothesis[] {
  const lineHypotheses: Hypothesis[] = offline.lineFindings.map((finding) => ({
    id: `offline-${finding.id}`,
    title: titleFromLineFinding(finding),
    description: finding.evidences.join(' '),
    confidence: finding.confidence,
    suspects:
      finding.status === 'short_detected' || finding.status === 'low_impedance'
        ? ['capacitor em curto', 'MOSFET em curto', 'CI alimentado em curto']
        : finding.status === 'open_path' || finding.status === 'no_return_signal'
          ? ['trilha rompida', 'bobina aberta', 'conector interrompido']
          : ['carga anormal', 'setor da linha em análise'],
    relatedMeasurements: [],
    evidenceIds: offline.evidences.map((evidenceItem) => evidenceItem.id),
    severity: severityFromFinding(finding.severity),
    category: lineCategory(finding.status),
  }));
  const componentHypotheses: Hypothesis[] = offline.componentFindings.map((finding) => ({
    id: `component-${finding.id}`,
    title: finding.confirmationState === 'confirmed' ? `${finding.componentLabel} confirmado` : `${finding.componentLabel} em análise`,
    description: finding.evidences.join(' '),
    confidence: finding.confidence,
    suspects: finding.evidences,
    relatedMeasurements: [],
    evidenceIds: offline.evidences.map((evidenceItem) => evidenceItem.id),
    severity: finding.confirmationState === 'confirmed' || finding.confirmationState === 'strong_indication' ? 'critical' : 'high',
    category: componentCategory(finding.componentType),
  }));

  return [...componentHypotheses, ...lineHypotheses].sort((left, right) => right.confidence - left.confidence);
}

function healthScoreFromOffline(behaviorScore: number, offline: OfflineScanResult): number {
  const critical = offline.lineFindings.some((finding) => finding.severity === 'critical') || offline.componentFindings.some((finding) => finding.confirmationState === 'confirmed');
  const high = offline.lineFindings.some((finding) => finding.severity === 'high') || offline.componentFindings.some((finding) => finding.confirmationState === 'strong_indication');
  const penalty = critical ? 42 : high ? 30 : 18;
  const calculated = 100 - Math.round(offline.confirmation.confidence * 0.42) - penalty;

  return Math.max(8, Math.min(behaviorScore, calculated));
}

function mergeOfflineResult(behaviorResult: DiagnosticResult, offline: OfflineScanResult): DiagnosticResult {
  const offlineHypotheses = buildOfflineHypotheses(offline);
  const hasOfflineEvidence = offline.evidences.length > 0 || offline.lineFindings.length > 0 || offline.componentFindings.length > 0;
  const behaviorEvidences = hasOfflineEvidence
    ? behaviorResult.evidences.filter((evidenceItem) => evidenceItem.id !== 'manual-insufficient-measurements')
    : behaviorResult.evidences;
  const behaviorLogs = hasOfflineEvidence
    ? behaviorResult.logs.filter((logItem) => logItem.message !== 'Medições insuficientes para diagnóstico confiável.')
    : behaviorResult.logs;
  const evidences = uniqueById([...offline.evidences, ...behaviorEvidences]);
  const nextTests = uniqueById([...offline.nextTests, ...behaviorResult.nextTests]).sort((left, right) => left.priority - right.priority);
  const hypotheses = uniqueById([...offlineHypotheses, ...behaviorResult.hypotheses]).sort((left, right) => right.confidence - left.confidence);
  const logs: DiagnosticLog[] = [...behaviorLogs, ...offline.logs];

  return {
    ...behaviorResult,
    healthScore: hasOfflineEvidence ? healthScoreFromOffline(behaviorResult.healthScore, offline) : behaviorResult.healthScore,
    hypotheses,
    evidences,
    nextTests,
    logs,
    summary: hasOfflineEvidence ? offline.summary : behaviorResult.summary,
  };
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

function toConsoleAnalysis(session: DiagnosticSession, source: ConsoleAnalysis['source'], input?: ConsoleScanInput): ConsoleAnalysis {
  const behaviorResult = runBehaviorEngine(session);
  const offlineResult = input && hasConsoleScanInput(input) ? runOfflineScan(buildOfflineScanInput(input, session)) : undefined;
  const result = offlineResult ? mergeOfflineResult(behaviorResult, offlineResult) : behaviorResult;
  const confirmationState = offlineResult?.confirmation.confirmationState ?? resolveConfirmation(session, result);

  return {
    session,
    result,
    confirmationState,
    headline: offlineResult?.headline ?? buildHeadline(result, confirmationState),
    confidence: offlineResult?.confirmation.confidence ?? primaryHypothesis(result)?.confidence ?? 0,
    analyzedAt: new Date().toISOString(),
    source,
  };
}

export function analyzeConsoleInput(input: ConsoleScanInput): ConsoleAnalysis {
  return toConsoleAnalysis(buildConsoleSession(input), 'manual', input);
}

export function loadLgConsoleCase(): ConsoleAnalysis {
  return toConsoleAnalysis(lgCj87DiagnosticCase, 'lg-demo');
}
