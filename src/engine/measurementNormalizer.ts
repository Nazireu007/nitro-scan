import type { MeasurementInput, MeasurementState, NormalizedMeasurement } from '../types/measurements';
import { normalizeUnit, parseNumericValue } from '../utils/electrical';

function textValue(value: MeasurementInput['value']): string {
  return String(value ?? '').trim().toLowerCase();
}

function hasAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(pattern));
}

function normalizedUnitLabel(unit: NormalizedMeasurement['normalizedUnit']): string {
  return unit ?? '';
}

function formatNormalizedValue(value: MeasurementInput['value'], numericValue: number | undefined, unit: NormalizedMeasurement['normalizedUnit']): string {
  if (numericValue === undefined) {
    return String(value ?? 'n/d');
  }

  return `${String(numericValue).replace('.', ',')} ${normalizedUnitLabel(unit)}`.trim();
}

function classifyVoltage(measurement: MeasurementInput, numericValue: number | undefined, source: string): MeasurementState[] {
  const states: MeasurementState[] = [];
  const nominal = measurement.expected?.nominal;
  const absentThreshold = nominal ? Math.max(0.3, nominal * 0.16) : 0.35;
  const presentThreshold = nominal ? Math.max(0.5, nominal * 0.55) : 0.5;

  if (hasAny(source, ['ausente', 'absent', 'sem tensão', '0v', '0 v'])) {
    states.push('voltage_absent');
  } else if (hasAny(source, ['presente', 'present', 'ativo', 'active'])) {
    states.push('voltage_present');
  }

  if (numericValue !== undefined) {
    if (numericValue <= absentThreshold) {
      states.push('voltage_absent');
    }

    if (numericValue >= presentThreshold) {
      states.push('voltage_present');
    }
  }

  if (states.includes('voltage_present') && hasAny(source, ['forçado', 'forced'])) {
    states.push('forced_command_active');
  }

  return states;
}

function classifyCurrent(numericValue: number | undefined, source: string): MeasurementState[] {
  const states: MeasurementState[] = [];

  if (hasAny(source, ['alta', 'high', 'excessiva'])) {
    states.push('current_high');
  }

  if (hasAny(source, ['baixa', 'low'])) {
    states.push('current_low');
  }

  if (numericValue !== undefined) {
    if (numericValue >= 1.5) {
      states.push('current_high');
    } else if (numericValue <= 0.12) {
      states.push('current_low');
    }
  }

  return states;
}

function classifyResistance(numericValue: number | undefined, source: string): MeasurementState[] {
  if (hasAny(source, ['ol', 'open', 'aberto', 'alta impedância', 'alta impedancia'])) {
    return ['high_resistance'];
  }

  if (numericValue !== undefined && numericValue <= 2) {
    return ['low_resistance'];
  }

  if (numericValue !== undefined && numericValue > 2) {
    return ['high_resistance'];
  }

  return [];
}

function classifySignalOrState(type: MeasurementInput['type'], numericValue: number | undefined, source: string): MeasurementState[] {
  const presentState: MeasurementState = type === 'signal' ? 'signal_present' : 'state_present';
  const absentState: MeasurementState = type === 'signal' ? 'signal_absent' : 'state_absent';

  if (hasAny(source, ['ausente', 'absent', 'dead', 'inativo', 'sem atividade'])) {
    return [absentState];
  }

  if (hasAny(source, ['presente', 'present', 'ativo', 'active', 'ok'])) {
    return [presentState];
  }

  if (numericValue !== undefined) {
    return numericValue > 0.8 ? [presentState] : [absentState];
  }

  return [];
}

function classifyTemperature(numericValue: number | undefined, source: string): MeasurementState[] {
  if (hasAny(source, ['fria', 'cold', 'sem inicializacao', 'sem inicialização'])) {
    return ['temperature_cold'];
  }

  if (numericValue !== undefined && numericValue <= 35) {
    return ['temperature_cold'];
  }

  return [];
}

function uniqueStates(states: MeasurementState[]): MeasurementState[] {
  return Array.from(new Set(states.length > 0 ? states : ['unknown']));
}

export function normalizeMeasurements(input: MeasurementInput[]): NormalizedMeasurement[] {
  return input.map((measurement) => {
    const valueSource = textValue(measurement.value);
    const signalStateSource = [measurement.value, measurement.context]
      .map((item) => String(item ?? '').toLowerCase())
      .join(' ');
    const source = [
      measurement.value,
      measurement.unit,
      measurement.label,
      measurement.node,
      measurement.component,
      measurement.context,
    ]
      .map((item) => String(item ?? '').toLowerCase())
      .join(' ');
    const numericValue = parseNumericValue(measurement.value);
    const normalizedUnit = normalizeUnit(measurement.type, measurement.unit, measurement.value);
    const stateGroups: MeasurementState[] = [];

    if (measurement.type === 'voltage') {
      stateGroups.push(...classifyVoltage(measurement, numericValue, source));
    }

    if (measurement.type === 'current') {
      stateGroups.push(...classifyCurrent(numericValue, source));
    }

    if (measurement.type === 'resistance') {
      stateGroups.push(...classifyResistance(numericValue, source));
    }

    if (measurement.type === 'signal' || measurement.type === 'state') {
      stateGroups.push(...classifySignalOrState(measurement.type, numericValue, signalStateSource || valueSource));
    }

    if (measurement.type === 'temperature') {
      stateGroups.push(...classifyTemperature(numericValue, source));
    }

    const states = uniqueStates(stateGroups);

    return {
      ...measurement,
      rawValue: measurement.value,
      numericValue,
      normalizedValue: formatNormalizedValue(measurement.value, numericValue, normalizedUnit),
      normalizedUnit,
      states,
      isPresent: states.some((state) => state.endsWith('_present') || state === 'forced_command_active'),
      isAbsent: states.some((state) => state.endsWith('_absent')),
    };
  });
}
