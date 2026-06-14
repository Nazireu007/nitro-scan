import { rules } from './rules';
import type {
  DiagnosticResult,
  DiagnosticScenario,
  EngineLog,
  Measurement,
  MonitorMetric,
  RuleMatch,
  Suspect,
} from './types';

type SuspectAccumulator = {
  id: string;
  name: string;
  category: Suspect['category'];
  score: number;
  reasons: string[];
};

const metricAccentBySeverity: Record<'healthy' | 'warn' | 'fail', MonitorMetric['accent']> = {
  healthy: 'green',
  warn: 'amber',
  fail: 'violet',
};

function formatMeasurementValue(measurement: Measurement): string {
  if (typeof measurement.value === 'number' && measurement.unit) {
    return `${measurement.value}${measurement.unit}`;
  }

  return measurement.status.replace('-', ' ');
}

function measurementToLog(measurement: Measurement): EngineLog | null {
  if (measurement.status === 'present') {
    return { level: 'SCAN', message: `${measurement.label} detected` };
  }

  if (measurement.status === 'forced-active') {
    return { level: 'TEST', message: `${measurement.label} active under forced command` };
  }

  if (measurement.status === 'absent' || measurement.status === 'dead') {
    return { level: 'WARN', message: `${measurement.label} absent` };
  }

  if (measurement.status === 'low' || measurement.status === 'high') {
    return { level: 'SCAN', message: `${measurement.label} ${measurement.status}: ${formatMeasurementValue(measurement)}` };
  }

  return null;
}

function pushUnique(target: string[], values: string[] | undefined): void {
  values?.forEach((value) => {
    if (!target.includes(value)) {
      target.push(value);
    }
  });
}

function applyRuleMatch(
  match: RuleMatch,
  suspects: Map<string, SuspectAccumulator>,
  resultParts: Pick<DiagnosticResult, 'evidence' | 'conclusions' | 'nextTests' | 'logs'>,
): void {
  match.evidence?.forEach((evidence) => resultParts.evidence.push(evidence));
  match.logs?.forEach((log) => resultParts.logs.push(log));
  pushUnique(resultParts.conclusions, match.conclusions);
  pushUnique(resultParts.nextTests, match.nextTests);

  match.suspectScores?.forEach((score) => {
    const current = suspects.get(score.id);

    if (current) {
      current.score += score.score;
      current.reasons.push(score.reason);
      return;
    }

    suspects.set(score.id, {
      id: score.id,
      name: score.name,
      category: score.category,
      score: score.score,
      reasons: [score.reason],
    });
  });
}

function calculateHealthPercentage(suspects: Suspect[], scenario: DiagnosticScenario): number {
  const highestProbability = suspects[0]?.probability ?? 12;
  const hasShort = suspects.some((suspect) => suspect.category === 'short');
  const hasFunctionalSource = scenario.id === 'lg-cj87-boot-failure';
  const penalty = hasShort ? 28 : hasFunctionalSource ? 10 : 18;

  return Math.max(12, Math.min(94, 100 - Math.round(highestProbability * 0.58) - penalty));
}

function buildMonitorMetrics(scenario: DiagnosticScenario, healthPercentage: number): MonitorMetric[] {
  const firstVoltage = scenario.measurements.find((measurement) => measurement.kind === 'voltage' && measurement.status === 'present');
  const current = scenario.measurements.find((measurement) => measurement.kind === 'current');
  const resistance = scenario.measurements.find((measurement) => measurement.kind === 'resistance');
  const shortDetected = resistance?.value !== undefined && resistance.value < 2;
  const voltageValue = firstVoltage ? formatMeasurementValue(firstVoltage) : '0V';
  const currentValue = current ? formatMeasurementValue(current) : 'n/a';
  const resistanceValue = resistance ? formatMeasurementValue(resistance) : 'n/a';

  return [
    {
      label: 'Board Health',
      value: `${healthPercentage}%`,
      accent: healthPercentage > 72 ? 'green' : healthPercentage > 45 ? 'amber' : 'violet',
    },
    { label: 'Detected Voltage', value: voltageValue, accent: 'cyan' },
    { label: 'Current Draw', value: currentValue, accent: current?.status === 'high' ? 'amber' : 'blue' },
    { label: 'Estimated Resistance', value: resistanceValue, accent: shortDetected ? 'amber' : 'violet' },
    {
      label: 'Short Status',
      value: shortDetected ? 'Probable short' : 'No hard short',
      accent: shortDetected ? metricAccentBySeverity.fail : metricAccentBySeverity.healthy,
    },
  ];
}

function buildSummary(scenario: DiagnosticScenario, suspects: Suspect[], conclusions: string[]): string {
  if (scenario.id === 'lg-cj87-boot-failure') {
    return 'Source rails can be generated, but the main board does not complete the boot sequence. Firmware SPI, clock/reset and CPU boot path are the leading suspects.';
  }

  if (suspects.length === 0) {
    return 'No decisive failure pattern matched. Continue guided probing with the captured measurements.';
  }

  return `${suspects[0].name} is the strongest match. ${conclusions[0] ?? 'The captured measurements match a known diagnostic pattern.'}`;
}

export function runDiagnosticScenario(scenario: DiagnosticScenario): DiagnosticResult {
  const resultParts: Pick<DiagnosticResult, 'evidence' | 'conclusions' | 'nextTests' | 'logs'> = {
    evidence: [],
    conclusions: [],
    nextTests: [],
    logs: scenario.measurements.map(measurementToLog).filter((log): log is EngineLog => Boolean(log)),
  };
  const suspectAccumulator = new Map<string, SuspectAccumulator>();

  rules.forEach((rule) => {
    const match = rule.evaluate(scenario);

    if (match) {
      applyRuleMatch(match, suspectAccumulator, resultParts);
    }
  });

  const suspects = Array.from(suspectAccumulator.values())
    .map<Suspect>((suspect) => ({
      id: suspect.id,
      name: suspect.name,
      category: suspect.category,
      probability: Math.min(96, Math.max(12, Math.round(suspect.score))),
      reasons: Array.from(new Set(suspect.reasons)),
    }))
    .sort((left, right) => right.probability - left.probability);

  suspects.slice(0, 4).forEach((suspect) => {
    resultParts.logs.push({ level: 'AI', message: `${suspect.name} suspected: ${suspect.probability}%` });
  });

  if (resultParts.conclusions.length === 0) {
    resultParts.conclusions.push('Insufficient evidence for a high-confidence classification.');
  }

  if (resultParts.nextTests.length === 0) {
    resultParts.nextTests.push('Capture additional voltage, resistance and control-signal measurements.');
  }

  const healthPercentage = calculateHealthPercentage(suspects, scenario);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    boardName: scenario.boardName,
    healthPercentage,
    summary: buildSummary(scenario, suspects, resultParts.conclusions),
    conclusions: resultParts.conclusions,
    evidence: resultParts.evidence,
    suspects,
    nextTests: resultParts.nextTests,
    logs: resultParts.logs,
    monitorMetrics: buildMonitorMetrics(scenario, healthPercentage),
  };
}
