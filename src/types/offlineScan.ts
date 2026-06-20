import type { ComponentFinding, ComponentType } from './components';
import type { ConfirmationDecision, ConfirmationState } from './confirmation';
import type { ConnectorType } from './connectors';
import type { DiagnosticLog, Evidence, NextTest } from './diagnostics';

export type OfflineTestMode =
  | 'offline_scan'
  | 'line_to_gnd'
  | 'low_injection'
  | 'sine_wave'
  | 'connector_response'
  | 'component_test'
  | 'confirmation';

export type LineFindingStatus =
  | 'normal'
  | 'low_impedance'
  | 'short_detected'
  | 'open_path'
  | 'attenuated_response'
  | 'abnormal_load'
  | 'no_return_signal';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export type OfflineScanInput = {
  id: string;
  testMode: OfflineTestMode;
  testOrigin: ConnectorType;
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

export type LineFinding = {
  id: string;
  lineName: string;
  status: LineFindingStatus;
  severity: FindingSeverity;
  confidence: number;
  evidences: string[];
};

export type OfflineScanResult = {
  lineFindings: LineFinding[];
  componentFindings: ComponentFinding[];
  confirmation: ConfirmationDecision;
  evidences: Evidence[];
  nextTests: NextTest[];
  logs: DiagnosticLog[];
  headline: string;
  summary: string;
};
