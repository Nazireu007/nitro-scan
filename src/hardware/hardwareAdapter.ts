import { runOfflineScan } from '../engine/offlineScanEngine';
import type { DiagnosticLog } from '../types/diagnostics';
import { hardwareFrameToOfflineScanInput, validateHardwareFrame } from './hardwareProtocol';
import { assessHardwareSafety } from './hardwareSafety';
import type { HardwareAnalysisResult, HardwareFrame } from './hardwareTypes';

function log(level: DiagnosticLog['level'], message: string): DiagnosticLog {
  return { level, message, source: 'analyzeHardwareFrame' };
}

function format(value: number, unit: string): string {
  const number = value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return unit === '%' ? `${number}%` : `${number} ${unit}`;
}

function hardwareLogs(frame: HardwareFrame): DiagnosticLog[] {
  const logs: DiagnosticLog[] = [
    log('SCAN', 'Frame de hardware recebido.'),
    log('TEST', 'Pré-scan iniciado.'),
    log(frame.groundDetected ? 'SCAN' : 'FAIL', frame.groundDetected ? 'GND detectado.' : 'GND não detectado.'),
  ];

  if (frame.impedanceOhms === null) logs.push(log('TEST', 'Impedância medida: OL.'));
  else logs.push(log('TEST', `Impedância medida: ${format(frame.impedanceOhms, 'Ω')}.`));

  if (frame.impedanceOhms !== null && frame.impedanceOhms <= 1) {
    logs.push(log('WARN', 'Baixa impedância detectada antes da injeção.'));
  }
  if (frame.injectionVoltage !== null) logs.push(log('TEST', `Injeção baixa simulada: ${format(frame.injectionVoltage, 'V')}.`));
  if (frame.measuredCurrent !== null) logs.push(log(frame.measuredCurrent >= 0.5 ? 'WARN' : 'TEST', `Corrente medida: ${format(frame.measuredCurrent, 'A')}.`));
  if (frame.returnAmplitude !== null) logs.push(log('TEST', `Retorno de sinal: ${format(frame.returnAmplitude, '%')}.`));
  if (frame.attenuation === 'alta') logs.push(log('WARN', 'Atenuação alta detectada.'));

  return logs;
}

export function analyzeHardwareFrame(frame: HardwareFrame): HardwareAnalysisResult {
  const validation = validateHardwareFrame(frame);
  const safety = assessHardwareSafety(frame);
  const logs = hardwareLogs(frame);

  safety.reasons.forEach((reason) => logs.push(log(safety.state === 'blocked' || safety.state === 'emergency_stop' ? 'FAIL' : safety.state === 'warning' ? 'WARN' : 'INFO', reason)));

  if (!validation.valid || !safety.canAnalyze) {
    validation.errors.forEach((error) => logs.push(log('FAIL', error)));
    return { frame, safety, validation, logs };
  }

  const offlineScanInput = hardwareFrameToOfflineScanInput(frame);
  const scanResult = runOfflineScan(offlineScanInput);
  const offlineScanResult = {
    ...scanResult,
    logs: [...logs, ...scanResult.logs],
  };

  return {
    frame,
    safety,
    validation,
    offlineScanInput,
    offlineScanResult,
    logs: offlineScanResult.logs,
  };
}
