import type { MeasurementState } from './measurements';

export type BehaviorCategory = 'power' | 'regulator' | 'short' | 'boot' | 'firmware' | 'timing' | 'control';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type EvidenceStrength = 'strong' | 'medium' | 'weak' | 'conflict' | 'missing';

export type BehaviorCondition = {
  id: string;
  description: string;
  state?: MeasurementState;
  measurementIds?: string[];
  nodeIncludes?: string[];
  componentIncludes?: string[];
  contextIncludes?: string[];
  symptomIncludes?: string[];
  strength?: EvidenceStrength;
  required?: boolean;
};

export type BehaviorSuspect = {
  id: string;
  title: string;
  category: BehaviorCategory;
  description: string;
  confidenceOffset?: number;
};

export type BehaviorNextTest = {
  id: string;
  title: string;
  description: string;
  priority: number;
  safetyNote?: string;
  expectedResult?: string;
};

export type BehaviorSignature = {
  id: string;
  name: string;
  category: BehaviorCategory;
  description: string;
  expectedConditions: BehaviorCondition[];
  failureConditions: BehaviorCondition[];
  suspects: BehaviorSuspect[];
  nextTests: BehaviorNextTest[];
  severity: Severity;
};
