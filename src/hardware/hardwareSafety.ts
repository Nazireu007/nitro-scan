import type { HardwareFrame, HardwareSafetyAssessment } from './hardwareTypes';

export const HARDWARE_SAFETY_LIMITS = {
  extremeLowImpedanceOhms: 1,
  warningCurrentAmps: 0.5,
  emergencyStopCurrentAmps: 1,
  maximumLowInjectionVolts: 1,
} as const;

export function assessHardwareSafety(frame: HardwareFrame): HardwareSafetyAssessment {
  const reasons: string[] = [];

  if (!frame.groundDetected) {
    return {
      state: 'blocked',
      canAnalyze: false,
      canInject: false,
      reasons: ['GND não detectado. Scan e injeção bloqueados.'],
    };
  }

  if (
    frame.safetyState === 'emergency_stop' ||
    (frame.measuredCurrent !== null && frame.measuredCurrent >= HARDWARE_SAFETY_LIMITS.emergencyStopCurrentAmps)
  ) {
    return {
      state: 'emergency_stop',
      canAnalyze: false,
      canInject: false,
      reasons: ['Corrente acima do limite seguro. Parada de emergência acionada.'],
    };
  }

  if (frame.safetyState === 'blocked') {
    return {
      state: 'blocked',
      canAnalyze: false,
      canInject: false,
      reasons: ['O hardware informou estado bloqueado.'],
    };
  }

  if (
    frame.impedanceOhms !== null &&
    frame.impedanceOhms <= HARDWARE_SAFETY_LIMITS.extremeLowImpedanceOhms
  ) {
    reasons.push('Impedância extremamente baixa detectada antes da injeção.');
  }

  if (
    frame.measuredCurrent !== null &&
    frame.measuredCurrent >= HARDWARE_SAFETY_LIMITS.warningCurrentAmps
  ) {
    reasons.push('Corrente elevada detectada durante o teste.');
  }

  if (
    frame.injectionVoltage !== null &&
    frame.injectionVoltage > HARDWARE_SAFETY_LIMITS.maximumLowInjectionVolts
  ) {
    reasons.push('Tensão solicitada excede o limite da injeção baixa.');
  }

  if (reasons.length > 0 || frame.safetyState === 'warning') {
    return {
      state: 'warning',
      canAnalyze: true,
      canInject: false,
      reasons: reasons.length > 0 ? reasons : ['Hardware informou condição de alerta.'],
    };
  }

  if (!frame.preScanCompleted) {
    return {
      state: 'pre_scan',
      canAnalyze: true,
      canInject: false,
      reasons: ['Pré-scan ainda não validado. Injeção permanece bloqueada.'],
    };
  }

  return {
    state: 'safe_to_inject',
    canAnalyze: true,
    canInject: true,
    reasons: ['Pré-scan válido. GND e limites elétricos verificados.'],
  };
}

export function canAdvanceHardwareProtocol(frame: HardwareFrame): boolean {
  const assessment = assessHardwareSafety(frame);
  return assessment.canAnalyze && assessment.state !== 'blocked' && assessment.state !== 'emergency_stop';
}
