import type { DiagnosticLog } from '../types/diagnostics';
import { analyzeHardwareFrame } from './hardwareAdapter';
import {
  createEmergencyStopCommand,
  createLowInjectionCommand,
  createPreScanCommand,
  createReadImpedanceCommand,
  createReadResponseCommand,
  createSineCommand,
} from './hardwareProtocol';
import { canExecuteCommand, assessHardwareSafety } from './hardwareSafety';
import { simulateOneClickBoardScan, type HardwareSimulationScenario } from './hardwareSimulator';
import type { HardwareAnalysisResult, HardwareCommand, HardwareFrame, HardwareScanMode } from './hardwareTypes';

export type OneClickScanStep =
  | 'idle'
  | 'ground_check'
  | 'pre_scan'
  | 'impedance_scan'
  | 'low_injection'
  | 'sine_response'
  | 'response_analysis'
  | 'component_correlation'
  | 'confirmation_check'
  | 'completed'
  | 'blocked'
  | 'emergency_stop';

export type OneClickBoardScanOptions = {
  source: 'simulator' | 'serial';
  scenario?: HardwareSimulationScenario;
  simulatorFrames?: HardwareFrame[];
  inputPoint: string;
  scanMode: HardwareScanMode;
  maxVoltage: number;
  limitCurrent: number;
  frequency: number;
  onStep?: (step: OneClickScanStep) => void;
  onFrame?: (frame: HardwareFrame) => void;
  onResult?: (result: OneClickBoardScanResult) => void;
  onLog?: (log: DiagnosticLog) => void;
  sendCommand?: (command: HardwareCommand) => Promise<{ sent: boolean; message: string }>;
  readFrame?: () => Promise<HardwareFrame | null>;
};

export type OneClickBoardScanResult = {
  step: OneClickScanStep;
  frames: HardwareFrame[];
  finalFrame?: HardwareFrame;
  analysis?: HardwareAnalysisResult;
  logs: DiagnosticLog[];
  blockedReason?: string;
};

const stepLogs: Partial<Record<OneClickScanStep, string>> = {
  ground_check: 'Verificação de GND concluída.',
  pre_scan: 'Pré-scan de segurança iniciado.',
  impedance_scan: 'Varredura de impedância concluída.',
  low_injection: 'Injeção baixa autorizada.',
  sine_response: 'Resposta senoidal capturada.',
  response_analysis: 'Resposta elétrica enviada ao motor de análise.',
  component_correlation: 'Evidências correlacionadas com componentes e regiões prováveis.',
  confirmation_check: 'Protocolo de confirmação executado.',
  completed: 'One-Click Board Scan concluído.',
};

function frameStep(frame: HardwareFrame): OneClickScanStep | undefined {
  if (typeof frame.raw !== 'object' || frame.raw === null) return undefined;
  const step = (frame.raw as Record<string, unknown>).oneClickStep;
  return typeof step === 'string' ? step as OneClickScanStep : undefined;
}

export async function runOneClickBoardScan(options: OneClickBoardScanOptions): Promise<OneClickBoardScanResult> {
  const logs: DiagnosticLog[] = [];
  const frames: HardwareFrame[] = [];
  let currentStep: OneClickScanStep = 'idle';
  let currentFrame: HardwareFrame | undefined;

  function emitLog(message: string, level: DiagnosticLog['level'] = 'SCAN') {
    const item: DiagnosticLog = { level, message, source: 'runOneClickBoardScan' };
    logs.push(item);
    options.onLog?.(item);
  }

  function move(step: OneClickScanStep) {
    currentStep = step;
    options.onStep?.(step);
    if (stepLogs[step]) emitLog(stepLogs[step] as string, step === 'completed' ? 'AI' : 'SCAN');
  }

  function receive(frame: HardwareFrame) {
    currentFrame = frame;
    frames.push(frame);
    options.onFrame?.(frame);
    if (frame.impedanceOhms !== null && frameStep(frame) === 'impedance_scan') {
      emitLog(`Impedância medida: ${frame.impedanceOhms.toLocaleString('pt-BR')} Ω.`, frame.impedanceOhms <= 1 ? 'WARN' : 'TEST');
      if (frame.impedanceOhms <= 1) emitLog('Baixa impedância detectada.', 'WARN');
    }
    if (frameStep(frame) === 'low_injection' && frame.injectionVoltage !== null) {
      emitLog(`Injeção baixa executada: ${frame.injectionVoltage.toLocaleString('pt-BR')} V.`, 'TEST');
      if (frame.measuredCurrent !== null) emitLog(`Corrente medida: ${frame.measuredCurrent.toLocaleString('pt-BR')} A.`, frame.measuredCurrent >= 0.5 ? 'WARN' : 'TEST');
    }
    if (frameStep(frame) === 'sine_response' && frame.returnAmplitude !== null) {
      emitLog(`Retorno do sinal: ${frame.returnAmplitude.toLocaleString('pt-BR')}%.`, 'TEST');
      if (frame.attenuation === 'alta') emitLog('Atenuação alta detectada.', 'WARN');
    }
  }

  async function stop(reason: string, emergency: boolean): Promise<OneClickBoardScanResult> {
    currentStep = emergency ? 'emergency_stop' : 'blocked';
    options.onStep?.(currentStep);
    emitLog(
      emergency ? 'Emergência: corrente acima do limite. Injeção bloqueada.' : reason,
      'FAIL',
    );
    if (emergency && options.sendCommand) await options.sendCommand(createEmergencyStopCommand(options.inputPoint));
    const result = { step: currentStep, frames, finalFrame: currentFrame, logs, blockedReason: reason };
    options.onResult?.(result);
    return result;
  }

  async function checkSafety(frame: HardwareFrame): Promise<OneClickBoardScanResult | undefined> {
    const safety = assessHardwareSafety(frame);
    if (safety.state === 'emergency_stop') return stop(safety.reasons[0], true);
    if (safety.state === 'blocked') return stop(safety.reasons[0], false);
    return undefined;
  }

  emitLog('One-Click Board Scan iniciado.');

  if (options.source === 'simulator') {
    const sequence = options.simulatorFrames ?? simulateOneClickBoardScan(options.scenario ?? 'normal_line');
    for (const frame of sequence) {
      const step = frameStep(frame) ?? 'response_analysis';
      if (step === 'low_injection' && currentFrame && !canExecuteCommand(createLowInjectionCommand(options.limitCurrent, options.maxVoltage, options.inputPoint), currentFrame)) {
        return stop('Injeção baixa bloqueada pelo pré-scan de segurança.', false);
      }
      if (step === 'sine_response' && currentFrame && !canExecuteCommand(createSineCommand(options.frequency, options.maxVoltage, options.inputPoint), currentFrame)) {
        return stop('Injeção senoidal bloqueada pelas regras de segurança.', false);
      }
      move(step);
      receive(frame);
      const stopped = await checkSafety(frame);
      if (stopped) return stopped;
    }
  } else {
    if (!options.sendCommand || !options.readFrame) return stop('Ponte serial indisponível para o One-Click Scan.', false);
    const protocol: Array<{ step: OneClickScanStep; command: HardwareCommand }> = [
      { step: 'ground_check', command: createPreScanCommand(options.inputPoint) },
      { step: 'pre_scan', command: createPreScanCommand(options.inputPoint) },
      { step: 'impedance_scan', command: createReadImpedanceCommand(options.inputPoint) },
      { step: 'low_injection', command: createLowInjectionCommand(options.limitCurrent, options.maxVoltage, options.inputPoint) },
      { step: 'sine_response', command: createSineCommand(options.frequency, options.maxVoltage, options.inputPoint) },
      { step: 'response_analysis', command: createReadResponseCommand(options.inputPoint) },
    ];

    for (const item of protocol) {
      if (!canExecuteCommand(item.command, currentFrame)) return stop(`Comando ${item.command.command} bloqueado pelas regras de segurança.`, false);
      move(item.step);
      const sent = await options.sendCommand(item.command);
      if (!sent.sent) return stop(sent.message, false);
      const frame = await options.readFrame();
      if (!frame) return stop('Nitro Probe não retornou frame para a etapa atual.', false);
      receive(frame);
      const stopped = await checkSafety(frame);
      if (stopped) return stopped;
    }
  }

  if (!currentFrame) return stop('Nenhum frame foi produzido pelo protocolo.', false);

  if (frameStep(currentFrame) !== 'response_analysis') move('response_analysis');
  const analysis = analyzeHardwareFrame(currentFrame);
  move('component_correlation');
  move('confirmation_check');
  if (analysis.offlineScanResult?.confirmation.confirmationState === 'confirmed') {
    emitLog('Diagnóstico confirmado por prova elétrica.', 'AI');
  } else {
    emitLog('Prova de confirmação pendente.', 'TEST');
  }
  move('completed');

  if (analysis.offlineScanResult) {
    analysis.offlineScanResult = {
      ...analysis.offlineScanResult,
      logs: [...logs, ...analysis.offlineScanResult.logs],
    };
    analysis.logs = analysis.offlineScanResult.logs;
  }

  const result = { step: currentStep, frames, finalFrame: currentFrame, analysis, logs };
  options.onResult?.(result);
  return result;
}
