import type { ComponentType } from '../types/components';
import type { ConfirmationState } from '../types/confirmation';
import type { ConnectorType } from '../types/connectors';
import type { HardwareFrame, HardwareScanMode, HardwareSafetyState } from './hardwareTypes';

export type HardwareSimulationScenario =
  | 'normal_line'
  | 'shorted_line'
  | 'open_path'
  | 'attenuated_return'
  | 'mosfet_ds_low'
  | 'capacitor_confirmed'
  | 'line_normalized_after_isolation';

export const hardwareSimulationOptions: Array<{ value: HardwareSimulationScenario; label: string }> = [
  { value: 'normal_line', label: 'Linha normal' },
  { value: 'shorted_line', label: 'Linha em curto' },
  { value: 'open_path', label: 'Caminho aberto' },
  { value: 'attenuated_return', label: 'Retorno atenuado' },
  { value: 'mosfet_ds_low', label: 'MOSFET D-S baixo' },
  { value: 'capacitor_confirmed', label: 'Capacitor confirmado' },
  { value: 'line_normalized_after_isolation', label: 'Linha normalizou' },
];

type SimulatorMetadata = {
  context: string;
  response?: string;
  testOrigin: ConnectorType;
  componentType?: ComponentType;
  componentLabel?: string;
  confirmationState?: ConfirmationState;
  preScanCompleted: boolean;
  oneClickStep?: string;
};

type SimulatorFrameOptions = {
  scanMode: HardwareScanMode;
  inputPoint: string;
  groundDetected?: boolean;
  preScanCompleted?: boolean;
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

type SequenceProfile = {
  initialImpedance?: number | null;
  injectionCurrent?: number | null;
  initialReturn?: number | null;
};

let sequence = 0;

function simulatorFrame(options: SimulatorFrameOptions): HardwareFrame {
  sequence += 1;
  return {
    id: `sim-${Date.now()}-${sequence}`,
    timestamp: new Date().toISOString(),
    source: 'simulator',
    scanMode: options.scanMode,
    inputPoint: options.inputPoint,
    groundDetected: options.groundDetected ?? true,
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
    preScanCompleted: options.preScanCompleted ?? true,
    raw: options.metadata,
  };
}

function metadata(frame: HardwareFrame): SimulatorMetadata {
  return typeof frame.raw === 'object' && frame.raw !== null
    ? frame.raw as SimulatorMetadata
    : { context: 'scan simulado', testOrigin: 'probe', preScanCompleted: frame.preScanCompleted };
}

function stageFrame(
  finalFrame: HardwareFrame,
  step: string,
  values: Partial<HardwareFrame>,
  context: string,
  preserveProof = false,
): HardwareFrame {
  sequence += 1;
  const finalMetadata = metadata(finalFrame);
  return {
    ...finalFrame,
    ...values,
    id: `${finalFrame.id}-${step}-${sequence}`,
    timestamp: new Date().toISOString(),
    raw: {
      ...finalMetadata,
      context,
      response: preserveProof ? finalMetadata.response : undefined,
      confirmationState: preserveProof ? finalMetadata.confirmationState : undefined,
      preScanCompleted: values.preScanCompleted ?? finalFrame.preScanCompleted,
      oneClickStep: step,
    } satisfies SimulatorMetadata,
  };
}

function oneClickSequence(finalFrame: HardwareFrame, profile: SequenceProfile = {}): HardwareFrame[] {
  const impedance = profile.initialImpedance !== undefined ? profile.initialImpedance : finalFrame.impedanceOhms;
  const injectionCurrent = profile.injectionCurrent !== undefined ? profile.injectionCurrent : finalFrame.measuredCurrent;
  const initialReturn = profile.initialReturn !== undefined ? profile.initialReturn : finalFrame.returnAmplitude;
  const frames = [
    stageFrame(finalFrame, 'ground_check', {
      scanMode: 'one_point_scan', preScanCompleted: false, impedanceOhms: null, injectionVoltage: null,
      measuredCurrent: null, signalFrequency: null, returnAmplitude: null, attenuation: null, safetyState: 'pre_scan',
    }, 'verificação de GND'),
    stageFrame(finalFrame, 'pre_scan', {
      scanMode: 'one_point_scan', preScanCompleted: true, impedanceOhms: impedance, injectionVoltage: null,
      measuredCurrent: null, signalFrequency: null, returnAmplitude: null, attenuation: null,
      safetyState: impedance !== null && impedance <= 1 ? 'warning' : 'safe_to_inject',
    }, 'pré-scan de segurança'),
    stageFrame(finalFrame, 'impedance_scan', {
      scanMode: 'line_to_gnd', preScanCompleted: true, impedanceOhms: impedance, injectionVoltage: null,
      measuredCurrent: null, signalFrequency: null, returnAmplitude: null, attenuation: null,
      safetyState: impedance !== null && impedance <= 1 ? 'warning' : 'safe_to_inject',
    }, impedance === null ? 'impedância OL; caminho aberto' : `impedância medida ${impedance} ohms`),
  ];

  if (finalFrame.injectionVoltage !== null) {
    frames.push(stageFrame(finalFrame, 'low_injection', {
      scanMode: 'low_injection', preScanCompleted: true, impedanceOhms: impedance,
      measuredCurrent: injectionCurrent, returnAmplitude: null, signalFrequency: null,
      safetyState: injectionCurrent !== null && injectionCurrent >= 1 ? 'emergency_stop' : injectionCurrent !== null && injectionCurrent >= 0.5 ? 'warning' : 'safe_to_inject',
    }, 'injeção baixa limitada'));
  }

  if (finalFrame.signalFrequency !== null || initialReturn !== null) {
    frames.push(stageFrame(finalFrame, 'sine_response', {
      scanMode: 'sine_response', preScanCompleted: true, impedanceOhms: impedance,
      measuredCurrent: injectionCurrent, returnAmplitude: initialReturn,
      safetyState: injectionCurrent !== null && injectionCurrent >= 1 ? 'emergency_stop' : injectionCurrent !== null && injectionCurrent >= 0.5 ? 'warning' : finalFrame.safetyState,
    }, 'resposta senoidal capturada'));
  }

  frames.push(stageFrame(finalFrame, 'response_analysis', {}, metadata(finalFrame).context, true));
  return frames;
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
    measuredCurrent: 0.82, signalFrequency: 1000, returnAmplitude: 12, attenuation: 'alta', safetyState: 'warning',
    metadata: { context: 'linha para GND; injeção limitada; corrente alta', response: '0,6 Ω; linha em curto; corrente alta; retorno atenuado 12%', testOrigin: 'probe', preScanCompleted: true },
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
    measuredCurrent: 0.78, signalFrequency: 1000, returnAmplitude: 8, attenuation: 'alta', safetyState: 'warning',
    metadata: { context: 'teste de componente; linha em curto; corrente alta', response: 'MOSFET D-S baixo com linha em curto', testOrigin: 'probe', componentType: 'mosfet', componentLabel: 'MOSFET D-S baixo', preScanCompleted: true },
  });
}

export function simulateCapacitorShortConfirmed(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'confirmation', inputPoint: '1,2 V', impedanceOhms: 68, injectionVoltage: 0.5,
    measuredCurrent: 0.03, signalFrequency: 1000, returnAmplitude: 90, attenuation: 'baixa', safetyState: 'safe_to_inject',
    metadata: { context: 'injeção limitada; capacitor aqueceu; componente isolado; linha normalizou', response: 'capacitor aqueceu na injeção e a linha normalizou após isolar componente', testOrigin: 'probe', componentType: 'capacitor', componentLabel: 'capacitor cerâmico na linha', confirmationState: 'confirmed', preScanCompleted: true },
  });
}

export function simulateLineNormalizedAfterIsolation(): HardwareFrame {
  return simulatorFrame({
    scanMode: 'confirmation', inputPoint: '5 V', impedanceOhms: 85, injectionVoltage: 0.5,
    measuredCurrent: 0.02, signalFrequency: 1000, returnAmplitude: 96, attenuation: 'baixa', safetyState: 'safe_to_inject',
    metadata: { context: 'prova elétrica antes/depois; setor suspeito isolado', response: 'linha normalizou após isolar componente', testOrigin: 'probe', confirmationState: 'confirmed', preScanCompleted: true },
  });
}

export function simulateHardwareScenario(scenario: HardwareSimulationScenario): HardwareFrame {
  const simulations: Record<HardwareSimulationScenario, () => HardwareFrame> = {
    normal_line: simulateNormalLine,
    shorted_line: simulateShortedLine,
    open_path: simulateOpenPath,
    attenuated_return: simulateAttenuatedReturn,
    mosfet_ds_low: simulateMosfetShort,
    capacitor_confirmed: simulateCapacitorShortConfirmed,
    line_normalized_after_isolation: simulateLineNormalizedAfterIsolation,
  };
  return simulations[scenario]();
}

export function simulateOneClickBoardScan(scenario: HardwareSimulationScenario): HardwareFrame[] {
  const finalFrame = simulateHardwareScenario(scenario);
  if (scenario === 'capacitor_confirmed') return oneClickSequence(finalFrame, { initialImpedance: 0.5, injectionCurrent: 0.74, initialReturn: 10 });
  if (scenario === 'line_normalized_after_isolation') return oneClickSequence(finalFrame, { initialImpedance: 0.6, injectionCurrent: 0.82, initialReturn: 12 });
  return oneClickSequence(finalFrame);
}
