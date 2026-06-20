import type { ComponentType } from '../types/components';
import type { ConfirmationState } from '../types/confirmation';
import type { ConnectorType } from '../types/connectors';
import type { HardwareFrame, HardwareScanMode, HardwareSafetyState } from './hardwareTypes';

export type HardwareSimulationScenario =
  | 'normal_line'
  | 'shorted_line'
  | 'open_path'
  | 'attenuated_return'
  | 'mosfet_short'
  | 'capacitor_short_confirmed'
  | 'line_normalized';

export const hardwareSimulationOptions: Array<{ value: HardwareSimulationScenario; label: string }> = [
  { value: 'normal_line', label: 'Linha normal' },
  { value: 'shorted_line', label: 'Linha em curto' },
  { value: 'open_path', label: 'Caminho aberto' },
  { value: 'attenuated_return', label: 'Retorno atenuado' },
  { value: 'mosfet_short', label: 'MOSFET D-S baixo' },
  { value: 'capacitor_short_confirmed', label: 'Capacitor confirmado' },
  { value: 'line_normalized', label: 'Linha normalizou' },
];

type SimulatorMetadata = {
  context: string;
  response?: string;
  testOrigin: ConnectorType;
  componentType?: ComponentType;
  componentLabel?: string;
  confirmationState?: ConfirmationState;
  preScanCompleted: true;
};

type SimulatorFrameOptions = {
  scanMode: HardwareScanMode;
  inputPoint: string;
  impedanceOhms: number | null;
  injectionVoltage: number | null;
  measuredCurrent: number | null;
  signalFrequency: number | null;
  returnAmplitude: number | null;
  attenuation: HardwareFrame['attenuation'];
  safetyState: HardwareSafetyState;
  channelA?: HardwareFrame['channelA'];
  channelB?: HardwareFrame['channelB'];
  channelC?: HardwareFrame['channelC'];
  metadata: SimulatorMetadata;
};

let sequence = 0;

function simulatorFrame(options: SimulatorFrameOptions): HardwareFrame {
  sequence += 1;
  const timestamp = new Date().toISOString();

  return {
    id: `sim-${Date.now()}-${sequence}`,
    timestamp,
    source: 'simulator',
    scanMode: options.scanMode,
    inputPoint: options.inputPoint,
    groundDetected: true,
    impedanceOhms: options.impedanceOhms,
    injectionVoltage: options.injectionVoltage,
    measuredCurrent: options.measuredCurrent,
    signalFrequency: options.signalFrequency,
    returnAmplitude: options.returnAmplitude,
    attenuation: options.attenuation,
    channelA: options.channelA ?? null,
    channelB: options.channelB ?? null,
    channelC: options.channelC ?? null,
    safetyState: options.safetyState,
    preScanCompleted: true,
    raw: options.metadata,
  };
}

export function simulateNormalLine(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'one_point_scan', inputPoint: '3,3 V', impedanceOhms: 120, injectionVoltage: 0.5,
    measuredCurrent: 0.01, signalFrequency: 1000, returnAmplitude: 92, attenuation: 'baixa', safetyState: 'safe_to_inject',
    channelA: 100, channelB: 92, metadata: { context: 'linha normal; retorno normal', testOrigin: 'probe', preScanCompleted: true },
  });
}

export function simulateShortedLine(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'low_injection', inputPoint: '3,3 V', impedanceOhms: 0.6, injectionVoltage: 0.5,
    measuredCurrent: 0.82, signalFrequency: null, returnAmplitude: 12, attenuation: 'alta', safetyState: 'warning',
    metadata: { context: 'linha para GND; injeção limitada; corrente alta', response: '0,6 Ω; linha em curto; corrente alta', testOrigin: 'probe', preScanCompleted: true },
  });
}

export function simulateOpenPath(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'sine_response', inputPoint: 'Ponto B', impedanceOhms: null, injectionVoltage: 0.3,
    measuredCurrent: 0.01, signalFrequency: 1000, returnAmplitude: 0, attenuation: 'alta', safetyState: 'safe_to_inject',
    channelA: 100, channelB: 0,
    metadata: { context: 'onda aplicada no ponto A; continuidade ausente', response: 'OL; caminho aberto; sinal ausente no ponto B', testOrigin: 'signal_flex', preScanCompleted: true },
  });
}

export function simulateAttenuatedReturn(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'connector_response', inputPoint: 'Canal B', impedanceOhms: 47, injectionVoltage: 0.3,
    measuredCurrent: 0.12, signalFrequency: 1000, returnAmplitude: 18, attenuation: 'alta', safetyState: 'safe_to_inject',
    channelA: 100, channelB: 18,
    metadata: { context: 'resposta por conector; onda 1 kHz', response: 'retorno atenuado 18% no canal B', testOrigin: 'signal_flex', preScanCompleted: true },
  });
}

export function simulateMosfetShort(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'component_check', inputPoint: 'VIN', impedanceOhms: 0.4, injectionVoltage: 0.5,
    measuredCurrent: 0.78, signalFrequency: null, returnAmplitude: 8, attenuation: 'alta', safetyState: 'warning',
    metadata: { context: 'teste de componente; linha em curto; corrente alta', response: 'MOSFET D-S baixo com linha em curto', testOrigin: 'probe', componentType: 'mosfet', componentLabel: 'MOSFET de entrada', preScanCompleted: true },
  });
}

export function simulateCapacitorShortConfirmed(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'confirmation', inputPoint: '1,2 V', impedanceOhms: 68, injectionVoltage: 0.5,
    measuredCurrent: 0.03, signalFrequency: null, returnAmplitude: 90, attenuation: 'baixa', safetyState: 'safe_to_inject',
    metadata: { context: 'injeção limitada; capacitor aqueceu; componente isolado; linha normalizou', response: 'capacitor aqueceu na injeção e a linha normalizou após isolar componente', testOrigin: 'probe', componentType: 'capacitor', componentLabel: 'capacitor cerâmico na linha', confirmationState: 'confirmed', preScanCompleted: true },
  });
}

export function simulateLineNormalizedAfterIsolation(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'confirmation', inputPoint: '5 V', impedanceOhms: 85, injectionVoltage: null,
    measuredCurrent: 0.02, signalFrequency: null, returnAmplitude: 96, attenuation: 'baixa', safetyState: 'safe_to_inject',
    metadata: { context: 'prova elétrica antes/depois; setor suspeito isolado', response: 'linha normalizou após isolar componente', testOrigin: 'probe', confirmationState: 'confirmed', preScanCompleted: true },
  });
}

export function simulateHardwareScenario(scenario: HardwareSimulationScenario): HardwareFrame {
  const simulations: Record<HardwareSimulationScenario, () => HardwareFrame> = {
    normal_line: simulateNormalLine,
    shorted_line: simulateShortedLine,
    open_path: simulateOpenPath,
    attenuated_return: simulateAttenuatedReturn,
    mosfet_short: simulateMosfetShort,
    capacitor_short_confirmed: simulateCapacitorShortConfirmed,
    line_normalized: simulateLineNormalizedAfterIsolation,
  };
  return simulations[scenario]();
}
