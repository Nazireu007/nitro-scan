export type MeasurementType = 'voltage' | 'current' | 'resistance' | 'signal' | 'temperature' | 'state';

export type MeasurementTestMode =
  | 'offline_scan'
  | 'line_to_gnd'
  | 'low_injection'
  | 'sine_wave'
  | 'connector_response'
  | 'component_test'
  | 'confirmation';

export type MeasurementTestOrigin =
  | 'probe'
  | 'dc_jack'
  | 'usb_c_charge'
  | 'battery_connector'
  | 'power_connector'
  | 'signal_flex'
  | 'other_board_connector';

export type ConfirmationState =
  | 'detected'
  | 'correlated'
  | 'strong_indication'
  | 'confirmed';

export type MeasurementState =
  | 'voltage_present'
  | 'voltage_absent'
  | 'low_resistance'
  | 'high_resistance'
  | 'current_high'
  | 'current_low'
  | 'signal_present'
  | 'signal_absent'
  | 'temperature_cold'
  | 'state_present'
  | 'state_absent'
  | 'forced_command_active'
  | 'unknown';

export type MeasurementInput = {
  id: string;
  label: string;
  type: MeasurementType;
  value: string | number | boolean | null;
  unit?: string;
  node?: string;
  component?: string;
  context?: string;
  testMode?: MeasurementTestMode;
  testOrigin?: MeasurementTestOrigin;
  injectionVoltage?: string;
  measuredCurrent?: string;
  signalFrequency?: string;
  returnAmplitude?: string;
  attenuation?: string;
  readChannel?: string;
  confirmationState?: ConfirmationState;
  timestamp?: string;
  expected?: {
    nominal?: number;
    min?: number;
    max?: number;
  };
};

export type NormalizedMeasurement = MeasurementInput & {
  rawValue: MeasurementInput['value'];
  numericValue?: number;
  normalizedValue: string;
  normalizedUnit?: 'V' | 'A' | 'Ω' | '°C' | 'state' | 'signal';
  states: MeasurementState[];
  isPresent: boolean;
  isAbsent: boolean;
};
