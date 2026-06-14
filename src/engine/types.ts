export type MeasurementKind =
  | 'voltage'
  | 'current'
  | 'resistance'
  | 'logic'
  | 'temperature'
  | 'status';

export type MeasurementStatus =
  | 'present'
  | 'absent'
  | 'forced-active'
  | 'low'
  | 'high'
  | 'cold'
  | 'dead'
  | 'ok'
  | 'unknown';

export type BoardLineRole =
  | 'standby'
  | 'primary'
  | 'secondary'
  | 'control'
  | 'logic'
  | 'clock'
  | 'reset'
  | 'data'
  | 'load';

export type BoardLineTopology =
  | 'rail'
  | 'buck'
  | 'ldo'
  | 'spi'
  | 'cpu'
  | 'inductor'
  | 'control';

export type EvidenceSeverity = 'OK' | 'WARN' | 'FAIL' | 'INFO';

export type EngineLogLevel = 'SCAN' | 'TEST' | 'AI' | 'WARN' | 'FAIL' | 'INFO';

export type Accent = 'cyan' | 'violet' | 'blue' | 'green' | 'amber';

export type Measurement = {
  id: string;
  label: string;
  kind: MeasurementKind;
  status: MeasurementStatus;
  value?: number;
  unit?: string;
  lineId?: string;
  note?: string;
};

export type BoardLine = {
  id: string;
  name: string;
  role: BoardLineRole;
  topology: BoardLineTopology;
  nominalVoltage?: number;
  inputMeasurementId?: string;
  enableMeasurementId?: string;
  outputMeasurementId?: string;
  resistanceMeasurementId?: string;
  currentMeasurementId?: string;
  voltageMeasurementId?: string;
};

export type DiagnosticEvidence = {
  id: string;
  severity: EvidenceSeverity;
  title: string;
  detail: string;
  sourceRuleId?: string;
};

export type Suspect = {
  id: string;
  name: string;
  probability: number;
  category: 'power' | 'firmware' | 'timing' | 'logic' | 'short' | 'regulator';
  reasons: string[];
};

export type MonitorMetric = {
  label: string;
  value: string;
  accent: Accent;
};

export type EngineLog = {
  level: EngineLogLevel;
  message: string;
};

export type DiagnosticResult = {
  scenarioId: string;
  scenarioName: string;
  boardName: string;
  healthPercentage: number;
  summary: string;
  conclusions: string[];
  evidence: DiagnosticEvidence[];
  suspects: Suspect[];
  nextTests: string[];
  logs: EngineLog[];
  monitorMetrics: MonitorMetric[];
};

export type DiagnosticScenario = {
  id: string;
  name: string;
  boardName: string;
  description: string;
  measurements: Measurement[];
  boardLines: BoardLine[];
};

export type RuleMatch = {
  evidence?: DiagnosticEvidence[];
  suspectScores?: Array<{
    id: string;
    name: string;
    category: Suspect['category'];
    score: number;
    reason: string;
  }>;
  conclusions?: string[];
  nextTests?: string[];
  logs?: EngineLog[];
};

export type Rule = {
  id: string;
  name: string;
  description: string;
  evaluate: (scenario: DiagnosticScenario) => RuleMatch | null;
};
