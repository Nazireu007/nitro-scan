import type { HardwareCommand, HardwareFrame, HardwareSafetyAssessment, HardwareSafetyState } from './hardwareTypes';

export const HARDWARE_SAFETY_LIMITS = {
  extremeLowImpedanceOhms: 1,
  warningCurrentAmps: 0.5,
  emergencyStopCurrentAmps: 1,
  maximumLowInjectionVolts: 1,
} as const;

export function assessHardwareSafety(frame: HardwareFrame): HardwareSafetyAssessment {
  const reasons: string[] = [];

  if (frame.event) {
    if (frame.event === 'heartbeat_timeout' || frame.event === 'emergency_stop_ack' || frame.safetyState === 'emergency_stop') {
      return {
        state: 'emergency_stop',
        canAnalyze: false,
        canInject: false,
        reasons: [frame.reason === 'heartbeat_timeout' ? 'Heartbeat expirado. Corte de segurança acionado.' : 'Parada de emergência confirmada pela Nitro Box.'],
      };
    }

    if (frame.event === 'command_blocked' || frame.safetyState === 'blocked') {
      return {
        state: 'blocked',
        canAnalyze: false,
        canInject: false,
        reasons: [frame.reason ? `Comando bloqueado: ${frame.reason}.` : 'Comando bloqueado pela Nitro Box.'],
      };
    }

    return {
      state: frame.safetyState,
      canAnalyze: false,
      canInject: false,
      reasons: [`Frame de comunicação recebido: ${frame.event}.`],
    };
  }

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
    return {
      state: 'blocked',
      canAnalyze: false,
      canInject: false,
      reasons: ['Tensão solicitada excede 1 V no modo inicial. Injeção bloqueada.'],
    };
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

export function canExecuteCommand(
  command: HardwareCommand,
  frameOrSafetyState?: HardwareFrame | HardwareSafetyState,
): boolean {
  if (
    command.command === 'ping' ||
    command.command === 'heartbeat' ||
    command.command === 'emergency_stop' ||
    command.command === 'stop'
  ) return true;
  if (command.command === 'pre_scan' || command.command === 'read_impedance') return true;

  const frame = typeof frameOrSafetyState === 'object' ? frameOrSafetyState : undefined;
  const safetyState = frame ? assessHardwareSafety(frame).state : frameOrSafetyState;

  if (!safetyState || safetyState === 'blocked' || safetyState === 'emergency_stop') return false;

  if (command.command === 'inject_low') {
    return Boolean(
      frame?.groundDetected &&
      frame.preScanCompleted &&
      (command.maxVoltage ?? 0) <= HARDWARE_SAFETY_LIMITS.maximumLowInjectionVolts,
    );
  }

  if (command.command === 'inject_sine') {
    return Boolean(
      frame?.groundDetected &&
      frame.preScanCompleted &&
      (command.maxVoltage ?? 0) <= HARDWARE_SAFETY_LIMITS.maximumLowInjectionVolts,
    );
  }

  return command.command === 'read_response';
}
