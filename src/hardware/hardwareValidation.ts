import type { ConfirmationState } from '../types/confirmation';
import {
  NITRO_PING_TIMEOUT_MESSAGE,
  createHardwareConnectionManager,
  isNitroBoxPongFrame,
} from './hardwareConnectionManager';
import {
  createEmergencyStopCommand,
  createHeartbeatCommand,
  createLowInjectionCommand,
  createPingCommand,
  createStopCommand,
  parseHardwareFrame,
} from './hardwareProtocol';
import { canExecuteCommand } from './hardwareSafety';
import { runOneClickBoardScan } from './oneClickScanRunner';
import { simulateOneClickBoardScan, type HardwareSimulationScenario } from './hardwareSimulator';

export type HardwareValidationResult = {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
};

const diagnosticCases: Array<{ scenario: HardwareSimulationScenario; expected: ConfirmationState }> = [
  { scenario: 'normal_line', expected: 'detected' },
  { scenario: 'shorted_line', expected: 'strong_indication' },
  { scenario: 'open_path', expected: 'correlated' },
  { scenario: 'attenuated_return', expected: 'correlated' },
  { scenario: 'mosfet_ds_low', expected: 'strong_indication' },
  { scenario: 'capacitor_confirmed', expected: 'confirmed' },
  { scenario: 'line_normalized_after_isolation', expected: 'confirmed' },
];

function options(scenario: HardwareSimulationScenario) {
  return {
    source: 'simulator' as const,
    scenario,
    inputPoint: 'VIN',
    scanMode: 'one_point_scan' as const,
    maxVoltage: 0.5,
    limitCurrent: 0.05,
    frequency: 1000,
  };
}

export async function validateHardwareScenarios(): Promise<HardwareValidationResult[]> {
  const results: HardwareValidationResult[] = [];

  for (const item of diagnosticCases) {
    const result = await runOneClickBoardScan(options(item.scenario));
    const actual = result.analysis?.offlineScanResult?.confirmation.confirmationState ?? result.step;
    results.push({
      id: item.scenario,
      passed: result.step === 'completed' && actual === item.expected,
      expected: item.expected,
      actual,
    });
  }

  const groundFrames = simulateOneClickBoardScan('normal_line');
  groundFrames[0] = { ...groundFrames[0], groundDetected: false, safetyState: 'blocked' };
  const groundResult = await runOneClickBoardScan({ ...options('normal_line'), simulatorFrames: groundFrames });
  results.push({
    id: 'ground_false',
    passed: groundResult.step === 'blocked' && !groundResult.frames.some((frame) => frame.scanMode === 'low_injection'),
    expected: 'blocked sem injeção',
    actual: groundResult.step,
  });

  const overcurrentFrames = simulateOneClickBoardScan('shorted_line');
  const injectionIndex = overcurrentFrames.findIndex((frame) => frame.scanMode === 'low_injection');
  overcurrentFrames[injectionIndex] = {
    ...overcurrentFrames[injectionIndex],
    measuredCurrent: 1.2,
    safetyState: 'emergency_stop',
  };
  let emergencyCommandSent = false;
  const overcurrentResult = await runOneClickBoardScan({
    ...options('shorted_line'),
    simulatorFrames: overcurrentFrames,
    sendCommand: async (command) => {
      emergencyCommandSent ||= command.command === 'emergency_stop';
      return { sent: true, message: 'Comando simulado.' };
    },
  });
  results.push({
    id: 'overcurrent',
    passed: overcurrentResult.step === 'emergency_stop' && emergencyCommandSent,
    expected: 'emergency_stop com comando enviado',
    actual: overcurrentResult.step,
  });

  const pingCommand = createPingCommand();
  results.push({
    id: 'ping_command',
    passed: pingCommand.type === 'nitro_command' && pingCommand.command === 'ping',
    expected: 'comando ping válido',
    actual: `${pingCommand.type}/${pingCommand.command}`,
  });

  const pongFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'pong',
    hardware: 'Nitro Box',
    status: 'online',
  });
  results.push({
    id: 'pong_frame',
    passed: isNitroBoxPongFrame(pongFrame),
    expected: 'pong da Nitro Box reconhecido',
    actual: `${pongFrame.event}/${pongFrame.hardware}/${pongFrame.status}`,
  });

  const heartbeatCommand = createHeartbeatCommand(123456);
  results.push({
    id: 'heartbeat_command',
    passed: heartbeatCommand.command === 'heartbeat' && heartbeatCommand.timestamp === 123456,
    expected: 'heartbeat com timestamp numérico',
    actual: `${heartbeatCommand.command}/${heartbeatCommand.timestamp}`,
  });

  const managerBeforeHandshake = createHardwareConnectionManager();
  const heartbeatBeforePong = managerBeforeHandshake.startHeartbeat();
  results.push({
    id: 'heartbeat_before_pong',
    passed: heartbeatBeforePong.heartbeatActive !== true,
    expected: 'heartbeat bloqueado antes do pong',
    actual: heartbeatBeforePong.heartbeatActive ? 'heartbeat ativo' : 'heartbeat inativo',
  });

  results.push({
    id: 'ping_timeout_message',
    passed: NITRO_PING_TIMEOUT_MESSAGE === 'Nitro Box não respondeu ao ping dentro do tempo esperado.',
    expected: 'erro amigável de timeout de ping',
    actual: NITRO_PING_TIMEOUT_MESSAGE,
  });

  const heartbeatTimeoutFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'heartbeat_timeout',
    safetyState: 'emergency_stop',
    cutoffState: 'open',
    reason: 'heartbeat_timeout',
  });
  results.push({
    id: 'heartbeat_timeout',
    passed: heartbeatTimeoutFrame.safetyState === 'emergency_stop' && heartbeatTimeoutFrame.cutoffState === 'open',
    expected: 'heartbeat timeout vira emergency_stop',
    actual: `${heartbeatTimeoutFrame.safetyState}/${heartbeatTimeoutFrame.cutoffState}`,
  });

  const stopAckFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'stop_ack',
    cutoffState: 'open',
    safetyState: 'idle',
  });
  results.push({
    id: 'stop_ack',
    passed: stopAckFrame.cutoffState === 'open' && stopAckFrame.safetyState === 'idle' && canExecuteCommand(createStopCommand()),
    expected: 'stop abre corte lógico',
    actual: `${stopAckFrame.cutoffState}/${stopAckFrame.safetyState}`,
  });

  results.push({
    id: 'emergency_stop_blocks_injection',
    passed: canExecuteCommand(createEmergencyStopCommand()) && !canExecuteCommand(createLowInjectionCommand(), 'emergency_stop'),
    expected: 'emergency_stop permitido e injeção bloqueada',
    actual: canExecuteCommand(createLowInjectionCommand(), 'emergency_stop') ? 'injeção permitida' : 'injeção bloqueada',
  });

  return results;
}

export async function assertHardwareScenarios(): Promise<void> {
  const failed = (await validateHardwareScenarios()).filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(failed.map((result) => `${result.id}: esperado ${result.expected}, obtido ${result.actual}`).join('\n'));
  }
}
