import type { BehaviorCategory, EvidenceStrength, Severity } from './behaviors';
import type { MeasurementInput } from './measurements';

export type DiagnosticSession = {
  id: string;
  title: string;
  deviceCategory: string;
  symptoms: string[];
  measurements: MeasurementInput[];
  selectedCase: string;
  createdAt: string;
};

export type Evidence = {
  id: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  text: string;
  source: string;
  relatedRule: string;
  relatedMeasurements?: string[];
  strength?: EvidenceStrength;
};

export type Hypothesis = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  suspects: string[];
  relatedMeasurements: string[];
  evidenceIds: string[];
  severity: Severity;
  category: BehaviorCategory;
};

export type NextTest = {
  id: string;
  title: string;
  description: string;
  priority: number;
  safetyNote?: string;
  expectedResult?: string;
};

export type DiagnosticLog = {
  level: 'SCAN' | 'TEST' | 'AI' | 'WARN' | 'FAIL' | 'INFO';
  message: string;
  source?: string;
  count?: number;
};

export type DiagnosticResult = {
  sessionId: string;
  healthScore: number;
  hypotheses: Hypothesis[];
  evidences: Evidence[];
  nextTests: NextTest[];
  logs: DiagnosticLog[];
  summary: string;
};
