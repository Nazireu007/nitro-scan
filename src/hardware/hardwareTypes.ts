import type { DiagnosticLog } from '../types/diagnostics';
import type { OfflineScanInput, OfflineScanResult } from '../types/offlineScan';

export type HardwareSource = 'simulator' | 'serial' | 'usb' | 'bluetooth' | 'manual' | 'esp32_mock';

export type HardwareSafetyState =
  | 'idle'
  | 'pre_scan'
  | 'safe_to_inject'
  | 'warning'
  | 'blocked'
  | 'emergency_stop';

export type HardwareScanMode =
  | 'one_point_scan'
  | 'line_to_gnd'
  | 'low_injection'
  | 'sine_response'
  | 'connector_response'
  | 'component_check'
  | 'confirmation';

export type HardwareChannelReading = number | string | null;

export type HardwareFrame = {
  id: string;
  timestamp: string;
  source: HardwareSource;
  scanMode: HardwareScanMode;
  inputPoint: string;
  groundDetected: boolean;
  impedanceOhms: number | null;
  injectionVoltage: number | null;
  measuredCurrent: number | null;
  signalFrequency: number | null;
  returnAmplitude: number | null;
  attenuation: 'baixa' | 'média' | 'alta' | null;
  channelA: HardwareChannelReading;
  channelB: HardwareChannelReading;
  channelC: HardwareChannelReading;
  safetyState: HardwareSafetyState;
  preScanCompleted: boolean;
  event?: string;
  hardware?: string;
  status?: string;
  cutoffState?: 'open' | 'closed' | string;
  reason?: string;
  raw: unknown;
};

export type HardwareSafetyAssessment = {
  state: HardwareSafetyState;
  canAnalyze: boolean;
  canInject: boolean;
  reasons: string[];
};

export type HardwareFrameValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type HardwareAnalysisResult = {
  frame: HardwareFrame;
  safety: HardwareSafetyAssessment;
  validation: HardwareFrameValidation;
  offlineScanInput?: OfflineScanInput;
  offlineScanResult?: OfflineScanResult;
  logs: DiagnosticLog[];
};

export type HardwareCommandName =
  | 'ping'
  | 'heartbeat'
  | 'pre_scan'
  | 'inject_low'
  | 'inject_sine'
  | 'stop'
  | 'emergency_stop'
  | 'read_impedance'
  | 'read_response';

export type HardwareCommand = {
  type: 'nitro_command';
  command: HardwareCommandName;
  mode?: HardwareScanMode;
  point?: string;
  limitCurrent?: number;
  maxVoltage?: number;
  frequency?: number;
  timestamp: string | number;
};
