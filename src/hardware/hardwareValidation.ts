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
  createSineCommand,
  createStopCommand,
  createTestCutoffCloseCommand,
  createTestCutoffOpenCommand,
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
    pin: 26,
  });
  results.push({
    id: 'heartbeat_timeout',
    passed: heartbeatTimeoutFrame.safetyState === 'emergency_stop' && heartbeatTimeoutFrame.cutoffState === 'open' && heartbeatTimeoutFrame.pin === 26,
    expected: 'heartbeat timeout vira emergency_stop e abre GPIO26',
    actual: `${heartbeatTimeoutFrame.safetyState}/${heartbeatTimeoutFrame.cutoffState}/GPIO${heartbeatTimeoutFrame.pin ?? 'n/a'}`,
  });

  const stopAckFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'stop_ack',
    cutoffState: 'open',
    safetyState: 'idle',
    pin: 26,
  });
  results.push({
    id: 'stop_ack',
    passed: stopAckFrame.cutoffState === 'open' && stopAckFrame.safetyState === 'idle' && stopAckFrame.pin === 26 && canExecuteCommand(createStopCommand()),
    expected: 'stop abre corte lógico no GPIO26',
    actual: `${stopAckFrame.cutoffState}/${stopAckFrame.safetyState}/GPIO${stopAckFrame.pin ?? 'n/a'}`,
  });

  const emergencyStopAckFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'emergency_stop_ack',
    cutoffState: 'open',
    safetyState: 'emergency_stop',
    pin: 26,
  });
  results.push({
    id: 'emergency_stop_ack',
    passed: emergencyStopAckFrame.cutoffState === 'open' && emergencyStopAckFrame.safetyState === 'emergency_stop' && emergencyStopAckFrame.pin === 26,
    expected: 'emergency_stop abre corte lógico no GPIO26',
    actual: `${emergencyStopAckFrame.cutoffState}/${emergencyStopAckFrame.safetyState}/GPIO${emergencyStopAckFrame.pin ?? 'n/a'}`,
  });

  const cutoffCloseCommand = createTestCutoffCloseCommand();
  results.push({
    id: 'test_cutoff_close_command',
    passed: cutoffCloseCommand.type === 'nitro_command' && cutoffCloseCommand.command === 'test_cutoff_close',
    expected: 'comando test_cutoff_close válido',
    actual: `${cutoffCloseCommand.type}/${cutoffCloseCommand.command}`,
  });

  const cutoffOpenCommand = createTestCutoffOpenCommand();
  results.push({
    id: 'test_cutoff_open_command',
    passed: cutoffOpenCommand.type === 'nitro_command' && cutoffOpenCommand.command === 'test_cutoff_open',
    expected: 'comando test_cutoff_open válido',
    actual: `${cutoffOpenCommand.type}/${cutoffOpenCommand.command}`,
  });

  const cutoffClosedFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'cutoff_test_closed',
    cutoffState: 'closed_test',
    safetyState: 'cutoff_test',
    pin: 26,
  });
  results.push({
    id: 'cutoff_test_closed_frame',
    passed: cutoffClosedFrame.event === 'cutoff_test_closed' && cutoffClosedFrame.cutoffState === 'closed_test' && cutoffClosedFrame.safetyState === 'cutoff_test' && cutoffClosedFrame.pin === 26,
    expected: 'GPIO26 acionado em modo teste',
    actual: `${cutoffClosedFrame.event}/${cutoffClosedFrame.cutoffState}/${cutoffClosedFrame.safetyState}/GPIO${cutoffClosedFrame.pin ?? 'n/a'}`,
  });

  const cutoffOpenFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'cutoff_test_open',
    cutoffState: 'open',
    safetyState: 'idle',
    pin: 26,
  });
  results.push({
    id: 'cutoff_test_open_frame',
    passed: cutoffOpenFrame.event === 'cutoff_test_open' && cutoffOpenFrame.cutoffState === 'open' && cutoffOpenFrame.safetyState === 'idle' && cutoffOpenFrame.pin === 26,
    expected: 'GPIO26 aberto em modo teste',
    actual: `${cutoffOpenFrame.event}/${cutoffOpenFrame.cutoffState}/${cutoffOpenFrame.safetyState}/GPIO${cutoffOpenFrame.pin ?? 'n/a'}`,
  });

  const commandBlockedFrame = parseHardwareFrame({
    type: 'nitro_frame',
    event: 'command_blocked',
    safetyState: 'blocked',
    cutoffState: 'open',
    reason: 'hardware_stage_not_connected',
    pin: 26,
  });
  const stageBlockPassed = commandBlockedFrame.safetyState === 'blocked' &&
    commandBlockedFrame.cutoffState === 'open' &&
    commandBlockedFrame.reason === 'hardware_stage_not_connected';
  results.push({
    id: 'inject_low_stage_blocked',
    passed: createLowInjectionCommand().command === 'inject_low' && stageBlockPassed,
    expected: 'inject_low bloqueado enquanto hardware real nao esta conectado',
    actual: `${commandBlockedFrame.safetyState}/${commandBlockedFrame.cutoffState}/${commandBlockedFrame.reason}`,
  });
  results.push({
    id: 'inject_sine_stage_blocked',
    passed: createSineCommand().command === 'inject_sine' && stageBlockPassed,
    expected: 'inject_sine bloqueado enquanto hardware real nao esta conectado',
    actual: `${commandBlockedFrame.safetyState}/${commandBlockedFrame.cutoffState}/${commandBlockedFrame.reason}`,
  });

  results.push({
    id: 'emergency_stop_blocks_injection',
    passed: canExecuteCommand(createEmergencyStopCommand()) && !canExecuteCommand(createLowInjectionCommand(), 'emergency_stop') && !canExecuteCommand(createSineCommand(), 'emergency_stop'),
    expected: 'emergency_stop permitido e injeções bloqueadas',
    actual: canExecuteCommand(createLowInjectionCommand(), 'emergency_stop') || canExecuteCommand(createSineCommand(), 'emergency_stop') ? 'injeção permitida' : 'injeção bloqueada',
  });

  return results;
}

export async function assertHardwareScenarios(): Promise<void> {
  const failed = (await validateHardwareScenarios()).filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(failed.map((result) => `${result.id}: esperado ${result.expected}, obtido ${result.actual}`).join('\n'));
  }
}
