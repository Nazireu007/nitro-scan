export type MeasurementType = 'voltage' | 'current' | 'resistance' | 'signal' | 'temperature' | 'state';

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
