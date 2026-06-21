import type { ConfirmationState } from '../types/confirmation';
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

  return results;
}

export async function assertHardwareScenarios(): Promise<void> {
  const failed = (await validateHardwareScenarios()).filter((result) => !result.passed);
  if (failed.length > 0) {
    throw new Error(failed.map((result) => `${result.id}: esperado ${result.expected}, obtido ${result.actual}`).join('\n'));
  }
}
