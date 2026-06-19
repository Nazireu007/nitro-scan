import type { MeasurementInput, NormalizedMeasurement } from '../types/measurements';

export function parseNumericValue(value: MeasurementInput['value']): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : undefined;
}

export function normalizeUnit(
  type: MeasurementInput['type'],
  unit: string | undefined,
  rawValue: MeasurementInput['value'],
): NormalizedMeasurement['normalizedUnit'] {
  if (type === 'voltage') {
    return 'V';
  }

  if (type === 'current') {
    return 'A';
  }

  if (type === 'resistance') {
    return 'Ω';
  }

  if (type === 'temperature') {
    return '°C';
  }

  if (type === 'signal') {
    return 'signal';
  }

  if (type === 'state') {
    return 'state';
  }

  const source = `${rawValue ?? ''} ${unit ?? ''}`.toLowerCase();

  if (source.includes('ohm') || source.includes('Ω')) {
    return 'Ω';
  }

  if (source.includes('a') && !source.includes('va')) {
    return 'A';
  }

  if (source.includes('v')) {
    return 'V';
  }

  if (source.includes('c') || source.includes('°')) {
    return '°C';
  }

  return undefined;
}

export function hasText(value: string | undefined, pattern: string): boolean {
  return Boolean(value?.toLowerCase().includes(pattern.toLowerCase()));
}

export function byId(measurements: NormalizedMeasurement[], id: string): NormalizedMeasurement | undefined {
  return measurements.find((measurement) => measurement.id === id);
}

export function hasState(measurement: NormalizedMeasurement | undefined, state: NormalizedMeasurement['states'][number]): boolean {
  return Boolean(measurement?.states.includes(state));
}

export function isVoltagePresent(measurement: NormalizedMeasurement | undefined): boolean {
  return hasState(measurement, 'voltage_present') || hasState(measurement, 'forced_command_active');
}

export function isVoltageAbsent(measurement: NormalizedMeasurement | undefined): boolean {
  return hasState(measurement, 'voltage_absent');
}

export function isSignalPresent(measurement: NormalizedMeasurement | undefined): boolean {
  return hasState(measurement, 'signal_present') || hasState(measurement, 'state_present');
}

export function isSignalAbsent(measurement: NormalizedMeasurement | undefined): boolean {
  return hasState(measurement, 'signal_absent') || hasState(measurement, 'state_absent');
}

export function isLowResistance(measurement: NormalizedMeasurement | undefined): boolean {
  return hasState(measurement, 'low_resistance');
}

export function isHighCurrent(measurement: NormalizedMeasurement | undefined): boolean {
  return hasState(measurement, 'current_high');
}
