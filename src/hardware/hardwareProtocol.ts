import type { ComponentType } from '../types/components';
import type { ConfirmationState } from '../types/confirmation';
import type { ConnectorType } from '../types/connectors';
import type { OfflineScanInput, OfflineTestMode } from '../types/offlineScan';
import { assessHardwareSafety } from './hardwareSafety';
import type {
  HardwareCommand,
  HardwareFrame,
  HardwareFrameValidation,
  HardwareScanMode,
  HardwareSafetyState,
  HardwareSource,
} from './hardwareTypes';

type HardwareRawMetadata = {
  context?: string;
  response?: string;
  testOrigin?: ConnectorType;
  componentType?: ComponentType;
  componentLabel?: string;
  confirmationState?: ConfirmationState;
  confirmationProof?: string;
  preScanCompleted?: boolean;
};

const scanModes: HardwareScanMode[] = [
  'one_point_scan',
  'line_to_gnd',
  'low_injection',
  'sine_response',
  'connector_response',
  'component_check',
  'confirmation',
];
const sources: HardwareSource[] = ['simulator', 'serial', 'usb', 'bluetooth', 'manual', 'esp32_mock'];
const safetyStates: HardwareSafetyState[] = ['idle', 'pre_scan', 'safe_to_inject', 'warning', 'blocked', 'emergency_stop'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === 'OL') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function formatNumber(value: number | null, unit: string): string {
  if (value === null) return 'OL';
  const number = value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return unit === '%' ? `${number}%` : `${number} ${unit}`;
}

function metadataFromRaw(raw: unknown): HardwareRawMetadata {
  if (!isRecord(raw)) return {};
  const testOrigin = stringValue(raw.testOrigin);
  const componentType = stringValue(raw.componentType);
  const confirmationState = stringValue(raw.confirmationState);

  return {
    context: stringValue(raw.context) || undefined,
    response: stringValue(raw.response) || undefined,
    testOrigin: testOrigin ? testOrigin as ConnectorType : undefined,
    componentType: componentType ? componentType as ComponentType : undefined,
    componentLabel: stringValue(raw.componentLabel) || undefined,
    confirmationState: confirmationState ? confirmationState as ConfirmationState : undefined,
    confirmationProof: stringValue(raw.confirmationProof) || undefined,
    preScanCompleted: typeof raw.preScanCompleted === 'boolean' ? raw.preScanCompleted : undefined,
  };
}

function protocolObject(raw: unknown): Record<string, unknown> {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!isRecord(parsed)) throw new Error('Frame de hardware deve ser um objeto JSON.');
  if (parsed.type !== undefined && parsed.type !== 'nitro_frame') throw new Error('Tipo de frame não reconhecido.');
  return parsed;
}

export function validateHardwareFrame(frame: unknown): HardwareFrameValidation {
  const errors: string[] = [];

  if (!isRecord(frame)) return { valid: false, errors: ['Frame inválido.'], warnings: [] };
  if (typeof frame.id !== 'string' || !frame.id.trim()) errors.push('ID do frame ausente.');
  if (typeof frame.timestamp !== 'string' || Number.isNaN(Date.parse(frame.timestamp))) errors.push('Timestamp inválido.');
  if (!sources.includes(frame.source as HardwareSource)) errors.push('Origem de hardware inválida.');
  if (!scanModes.includes(frame.scanMode as HardwareScanMode)) errors.push('Modo de scan inválido.');
  if (typeof frame.inputPoint !== 'string' || !frame.inputPoint.trim()) errors.push('Ponto de entrada ausente.');
  if (typeof frame.groundDetected !== 'boolean') errors.push('Estado de GND inválido.');
  if (!safetyStates.includes(frame.safetyState as HardwareSafetyState)) errors.push('Estado de segurança inválido.');
  if (typeof frame.preScanCompleted !== 'boolean') errors.push('Estado do pré-scan inválido.');

  const numericKeys = ['impedanceOhms', 'injectionVoltage', 'measuredCurrent', 'signalFrequency', 'returnAmplitude'] as const;
  numericKeys.forEach((key) => {
    const value = frame[key];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      errors.push(`${key} deve ser número positivo ou nulo.`);
    }
  });

  const warnings = errors.length === 0 ? assessHardwareSafety(frame as HardwareFrame).reasons : [];
  return { valid: errors.length === 0, errors, warnings };
}

export function parseHardwareFrame(raw: unknown): HardwareFrame {
  const payload = protocolObject(raw);
  const metadata = metadataFromRaw(payload.raw);
  const mode = stringValue(payload.mode ?? payload.scanMode, 'one_point_scan') as HardwareScanMode;
  const source = stringValue(payload.source, 'serial') as HardwareSource;
  const requestedSafety = stringValue(payload.safetyState, 'idle') as HardwareSafetyState;
  const event = stringValue(payload.event) || undefined;
  const frame: HardwareFrame = {
    id: stringValue(payload.id, `hardware-${Date.now()}`),
    timestamp: stringValue(payload.timestamp, new Date().toISOString()),
    source,
    scanMode: mode,
    inputPoint: stringValue(payload.point ?? payload.inputPoint, 'ponto não informado'),
    groundDetected: booleanValue(payload.groundDetected),
    impedanceOhms: nullableNumber(payload.impedanceOhms),
    injectionVoltage: nullableNumber(payload.injectionVoltage),
    measuredCurrent: nullableNumber(payload.measuredCurrent),
    signalFrequency: nullableNumber(payload.signalFrequency),
    returnAmplitude: nullableNumber(payload.returnAmplitude),
    attenuation: ['baixa', 'média', 'alta'].includes(stringValue(payload.attenuation))
      ? stringValue(payload.attenuation) as HardwareFrame['attenuation']
      : null,
    channelA: payload.channelA as HardwareFrame['channelA'] ?? null,
    channelB: payload.channelB as HardwareFrame['channelB'] ?? null,
    channelC: payload.channelC as HardwareFrame['channelC'] ?? null,
    safetyState: requestedSafety,
    preScanCompleted: typeof payload.preScanCompleted === 'boolean'
      ? payload.preScanCompleted
      : metadata.preScanCompleted ?? false,
    event,
    hardware: stringValue(payload.hardware) || undefined,
    status: stringValue(payload.status) || undefined,
    cutoffState: stringValue(payload.cutoffState) || undefined,
    reason: stringValue(payload.reason) || undefined,
    raw: payload.raw ?? raw,
  };
  const validation = validateHardwareFrame(frame);
  if (!validation.valid) throw new Error(validation.errors.join(' '));

  return { ...frame, safetyState: assessHardwareSafety(frame).state };
}

function offlineMode(mode: HardwareScanMode): OfflineTestMode {
  const mapping: Record<HardwareScanMode, OfflineTestMode> = {
    one_point_scan: 'offline_scan',
    line_to_gnd: 'line_to_gnd',
    low_injection: 'low_injection',
    sine_response: 'sine_wave',
    connector_response: 'connector_response',
    component_check: 'component_test',
    confirmation: 'confirmation',
  };
  return mapping[mode];
}

function frameResponse(frame: HardwareFrame, metadata: HardwareRawMetadata): string {
  if (metadata.response) return metadata.response;
  if (frame.scanMode === 'confirmation') return 'linha normalizou após isolar componente';
  if (frame.impedanceOhms === null && frame.returnAmplitude === 0) return 'OL; caminho aberto; retorno ausente';
  if (frame.impedanceOhms !== null && frame.impedanceOhms <= 1) {
    return `${formatNumber(frame.impedanceOhms, 'Ω')}; corrente ${formatNumber(frame.measuredCurrent, 'A')}`;
  }
  if (frame.returnAmplitude !== null && frame.returnAmplitude <= 35) return `retorno atenuado ${formatNumber(frame.returnAmplitude, '%')}`;
  return `linha normal; retorno ${formatNumber(frame.returnAmplitude, '%')}`;
}

export function hardwareFrameToOfflineScanInput(frame: HardwareFrame): OfflineScanInput {
  const metadata = metadataFromRaw(frame.raw);
  const safety = assessHardwareSafety(frame);
  const context = [
    metadata.context,
    'frame de hardware',
    'placa desligada',
    `segurança ${safety.state}`,
    frame.preScanCompleted ? 'pré-scan válido' : 'pré-scan pendente',
  ].filter(Boolean).join('; ');

  return {
    id: frame.id,
    testMode: offlineMode(frame.scanMode),
    testOrigin: metadata.testOrigin ?? 'probe',
    node: frame.inputPoint,
    response: frameResponse(frame, metadata),
    unit: frame.scanMode === 'line_to_gnd' || frame.scanMode === 'component_check' ? 'Ω' : 'estado',
    context,
    injectionVoltage: frame.injectionVoltage === null ? undefined : formatNumber(frame.injectionVoltage, 'V'),
    measuredCurrent: frame.measuredCurrent === null ? undefined : formatNumber(frame.measuredCurrent, 'A'),
    signalFrequency: frame.signalFrequency === null ? undefined : formatNumber(frame.signalFrequency, 'Hz'),
    returnAmplitude: frame.returnAmplitude === null ? undefined : formatNumber(frame.returnAmplitude, '%'),
    attenuation: frame.attenuation ?? undefined,
    readChannel: frame.channelB === null ? undefined : 'Canal B',
    probeA: frame.channelA === null ? undefined : String(frame.channelA),
    probeB: frame.channelB === null ? undefined : String(frame.channelB),
    probeC: frame.channelC === null ? undefined : String(frame.channelC),
    componentType: metadata.componentType,
    componentLabel: metadata.componentLabel,
    confirmationState: metadata.confirmationState,
    confirmationProof: metadata.confirmationProof,
  };
}

function command(commandName: HardwareCommand['command'], mode: HardwareScanMode, point: string, values: Partial<HardwareCommand> = {}): HardwareCommand {
  return {
    type: 'nitro_command',
    command: commandName,
    mode,
    point,
    timestamp: new Date().toISOString(),
    ...values,
  };
}

export function createPingCommand(): HardwareCommand {
  return {
    type: 'nitro_command',
    command: 'ping',
    timestamp: Date.now(),
  };
}

export function createHeartbeatCommand(timestamp = Date.now()): HardwareCommand {
  return {
    type: 'nitro_command',
    command: 'heartbeat',
    timestamp,
  };
}

export function createPreScanCommand(point = 'VIN'): HardwareCommand {
  return command('pre_scan', 'one_point_scan', point, { limitCurrent: 0.01, maxVoltage: 0.3 });
}

export function createReadImpedanceCommand(point = 'VIN'): HardwareCommand {
  return command('read_impedance', 'line_to_gnd', point);
}

export function createLowInjectionCommand(limitCurrent = 0.05, maxVoltage = 0.5, point = 'VIN'): HardwareCommand {
  return command('inject_low', 'low_injection', point, { limitCurrent, maxVoltage });
}

export function createSineCommand(frequency = 1000, maxVoltage = 0.5, point = 'VIN'): HardwareCommand {
  return command('inject_sine', 'sine_response', point, { limitCurrent: 0.05, maxVoltage, frequency });
}

export function createReadResponseCommand(point = 'VIN'): HardwareCommand {
  return command('read_response', 'connector_response', point);
}

export function createStopCommand(point = 'VIN'): HardwareCommand {
  return command('stop', 'one_point_scan', point);
}

export function createEmergencyStopCommand(point = 'VIN'): HardwareCommand {
  return command('emergency_stop', 'one_point_scan', point);
}
