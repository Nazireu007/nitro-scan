import { behaviorSignatures } from '../data/behaviorSignatures';
import { diagnosticCases } from '../data/diagnosticCases';
import type { DiagnosticResult as BehaviorDiagnosticResult, DiagnosticSession, Evidence, Hypothesis } from '../types/diagnostics';
import type { MeasurementInput, NormalizedMeasurement } from '../types/measurements';
import { buildConclusionTexts, buildHypothesisEvidence, toLegacyEvidence, uniqueEvidences } from './evidenceBuilder';
import { normalizeMeasurements } from './measurementNormalizer';
import { buildNextTests, toLegacyNextTests } from './nextTests';
import { evaluateRules } from './ruleEvaluator';
import { scoreHypotheses } from './scoring';
import type {
  DiagnosticResult,
  DiagnosticScenario,
  EngineLog,
  Measurement,
  MonitorMetric,
  Suspect,
} from './types';

const legacyNameByHypothesisId: Record<string, string> = {
  firmware_spi: 'Firmware SPI',
  control_logic: 'Boot/Control Logic',
  cpu_boot_failure: 'CPU Boot Failure',
  clock_reset: 'Clock/Reset',
  shorted_rail: 'Shorted Rail',
  buck_converter: 'Buck Converter',
  ldo_regulator: 'LDO Regulator',
};

const legacyCategoryByHypothesisId: Record<string, Suspect['category']> = {
  firmware_spi: 'firmware',
  control_logic: 'logic',
  cpu_boot_failure: 'logic',
  clock_reset: 'timing',
  shorted_rail: 'short',
  buck_converter: 'regulator',
  ldo_regulator: 'regulator',
};

function legacyKindToType(kind: Measurement['kind']): MeasurementInput['type'] {
  if (kind === 'logic') {
    return 'signal';
  }

  if (kind === 'status') {
    return 'state';
  }

  if (kind === 'voltage' || kind === 'current' || kind === 'resistance' || kind === 'temperature') {
    return kind;
  }

  return 'state';
}

function legacyMeasurementToInput(measurement: Measurement): MeasurementInput {
  return {
    id: measurement.id,
    label: measurement.label,
    type: legacyKindToType(measurement.kind),
    value: measurement.value ?? measurement.status,
    unit: measurement.unit,
    node: measurement.lineId ?? measurement.id,
    component: measurement.lineId,
    context: [measurement.status, measurement.note].filter(Boolean).join(' '),
    timestamp: '00:00:00',
    expected: measurement.kind === 'voltage' && typeof measurement.value === 'number' ? { nominal: measurement.value } : undefined,
  };
}

function sessionFromScenario(scenario: DiagnosticScenario): DiagnosticSession {
  const predefinedCase = diagnosticCases.find((diagnosticCase) => diagnosticCase.id === scenario.id);

  if (predefinedCase) {
    return predefinedCase;
  }

  return {
    id: scenario.id,
    title: scenario.name,
    deviceCategory: scenario.boardName,
    symptoms: [scenario.description],
    measurements: scenario.measurements.map(legacyMeasurementToInput),
    selectedCase: scenario.id,
    createdAt: new Date(0).toISOString(),
  };
}

function metricValue(measurement: NormalizedMeasurement | undefined, fallback: string): string {
  return measurement?.normalizedValue ?? fallback;
}

function buildMonitorMetrics(measurements: NormalizedMeasurement[], healthScore: number): MonitorMetric[] {
  const firstVoltage = measurements.find((measurement) => measurement.type === 'voltage' && measurement.isPresent);
  const current = measurements.find((measurement) => measurement.type === 'current');
  const resistance = measurements.find((measurement) => measurement.type === 'resistance');
  const shortDetected = measurements.some((measurement) => measurement.states.includes('low_resistance'));

  return [
    {
      label: 'Board Health',
      value: `${healthScore}%`,
      accent: healthScore > 72 ? 'green' : healthScore > 45 ? 'amber' : 'violet',
    },
    { label: 'Detected Voltage', value: metricValue(firstVoltage, '0 V'), accent: 'cyan' },
    { label: 'Current Draw', value: metricValue(current, 'n/d'), accent: current?.states.includes('current_high') ? 'amber' : 'blue' },
    { label: 'Estimated Resistance', value: metricValue(resistance, 'n/d'), accent: shortDetected ? 'amber' : 'violet' },
    {
      label: 'Short Status',
      value: shortDetected ? 'Probable short' : 'No hard short',
      accent: shortDetected ? 'violet' : 'green',
    },
  ];
}

function calculateHealthScore(session: DiagnosticSession, hypotheses: Hypothesis[]): number {
  const faultHypotheses = hypotheses.filter((hypothesis) => hypothesis.id !== 'source_functional');
  const highestConfidence = faultHypotheses[0]?.confidence ?? 12;
  const hasShort = faultHypotheses.some((hypothesis) => hypothesis.category === 'short');
  const sourceValidated = hypotheses.some((hypothesis) => hypothesis.id === 'source_functional');
  const penalty = hasShort ? 28 : sourceValidated || session.id === 'lg-cj87-boot-failure' ? 10 : 18;

  return Math.max(12, Math.min(94, 100 - Math.round(highestConfidence * 0.58) - penalty));
}

function buildSummary(session: DiagnosticSession, hypotheses: Hypothesis[], evidences: Evidence[]): string {
  if (session.id === 'lg-cj87-boot-failure') {
    return 'Fonte responde ao comando forçado, mas a placa principal não completa a sequência de boot/controle. Firmware SPI, Clock/Reset e inicialização da CPU seguem como hipóteses principais.';
  }

  const strongest = hypotheses.find((hypothesis) => hypothesis.id !== 'source_functional');

  if (!strongest) {
    return evidences[0]?.text ?? 'Nenhum padrão decisivo foi confirmado; continuar medições guiadas.';
  }

  return `${strongest.title} é a hipótese mais forte. ${evidences[0]?.text ?? 'As medições indicam comportamento elétrico anômalo.'}`;
}

function hypothesisLogs(hypotheses: Hypothesis[]): EngineLog[] {
  return hypotheses
    .filter((hypothesis) => hypothesis.id !== 'source_functional')
    .slice(0, 4)
    .map((hypothesis) => ({
      level: 'AI',
      message: `${hypothesis.title}: ${hypothesis.confidence}%`,
    }));
}

function toLegacySuspects(hypotheses: Hypothesis[]): Suspect[] {
  return hypotheses
    .filter((hypothesis) => hypothesis.id !== 'source_functional')
    .map((hypothesis) => ({
      id: hypothesis.id,
      name: legacyNameByHypothesisId[hypothesis.id] ?? hypothesis.title,
      probability: hypothesis.confidence,
      category: legacyCategoryByHypothesisId[hypothesis.id] ?? 'logic',
      reasons: [hypothesis.description, ...hypothesis.suspects],
    }));
}

export function runBehaviorEngine(session: DiagnosticSession): BehaviorDiagnosticResult {
  const measurements = normalizeMeasurements(session.measurements);
  const evaluation = evaluateRules(session, measurements, behaviorSignatures);
  const hypotheses = scoreHypotheses(evaluation.hypothesisSeeds);
  const nextTests = buildNextTests(evaluation.nextTests, hypotheses);
  const technicalEvidences = uniqueEvidences(evaluation.evidences);
  const evidences = uniqueEvidences([...technicalEvidences, ...buildHypothesisEvidence(hypotheses)]);
  const healthScore = calculateHealthScore(session, hypotheses);

  return {
    sessionId: session.id,
    healthScore,
    hypotheses,
    evidences,
    nextTests,
    logs: [...evaluation.logs, ...hypothesisLogs(hypotheses)],
    summary: buildSummary(session, hypotheses, technicalEvidences),
  };
}

export function runDiagnosticScenario(scenario: DiagnosticScenario): DiagnosticResult {
  const session = sessionFromScenario(scenario);
  const measurements = normalizeMeasurements(session.measurements);
  const behaviorResult = runBehaviorEngine(session);
  const technicalEvidences = behaviorResult.evidences.filter((evidence) => !evidence.id.endsWith('-confidence'));
  const conclusions = buildConclusionTexts(technicalEvidences);
  const suspects = toLegacySuspects(behaviorResult.hypotheses);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    boardName: scenario.boardName,
    healthPercentage: behaviorResult.healthScore,
    summary: behaviorResult.summary,
    conclusions,
    evidence: toLegacyEvidence(technicalEvidences),
    suspects,
    nextTests: toLegacyNextTests(behaviorResult.nextTests),
    logs: behaviorResult.logs.map((log) => ({
      level: log.level,
      message: log.message,
    })),
    monitorMetrics: buildMonitorMetrics(measurements, behaviorResult.healthScore),
  };
}
