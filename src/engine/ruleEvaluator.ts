import type { BehaviorSignature } from '../types/behaviors';
import type { DiagnosticLog, DiagnosticSession, Evidence, NextTest } from '../types/diagnostics';
import type { NormalizedMeasurement } from '../types/measurements';
import {
  byId,
  hasState,
  hasText,
  isHighCurrent,
  isLowResistance,
  isSignalAbsent,
  isSignalPresent,
  isVoltageAbsent,
  isVoltagePresent,
} from '../utils/electrical';
import type { HypothesisSeed } from './scoring';

export type RuleEvaluation = {
  evidences: Evidence[];
  hypothesisSeeds: HypothesisSeed[];
  nextTests: NextTest[];
  logs: DiagnosticLog[];
  conclusions: string[];
};

function emptyEvaluation(): RuleEvaluation {
  return {
    evidences: [],
    hypothesisSeeds: [],
    nextTests: [],
    logs: [],
    conclusions: [],
  };
}

function mergeEvaluations(evaluations: RuleEvaluation[]): RuleEvaluation {
  return evaluations.reduce(
    (merged, evaluation) => ({
      evidences: [...merged.evidences, ...evaluation.evidences],
      hypothesisSeeds: [...merged.hypothesisSeeds, ...evaluation.hypothesisSeeds],
      nextTests: [...merged.nextTests, ...evaluation.nextTests],
      logs: [...merged.logs, ...evaluation.logs],
      conclusions: [...merged.conclusions, ...evaluation.conclusions],
    }),
    emptyEvaluation(),
  );
}

function signature(signatures: BehaviorSignature[], id: string): BehaviorSignature {
  const found = signatures.find((item) => item.id === id);

  if (!found) {
    throw new Error(`Behavior signature not found: ${id}`);
  }

  return found;
}

function findByLabel(measurements: NormalizedMeasurement[], label: string): NormalizedMeasurement | undefined {
  return measurements.find((measurement) => measurement.label.toLowerCase().includes(label.toLowerCase()));
}

function testFromSignature(signatureItem: BehaviorSignature): NextTest[] {
  return signatureItem.nextTests.map((test) => ({
    id: test.id,
    title: test.title,
    description: test.description,
    priority: test.priority,
    safetyNote: test.safetyNote,
    expectedResult: test.expectedResult,
  }));
}

function scanLogs(measurements: NormalizedMeasurement[]): DiagnosticLog[] {
  return measurements
    .map<DiagnosticLog | null>((measurement) => {
      if (measurement.states.includes('forced_command_active')) {
        return { level: 'TEST', message: `${measurement.label} ativo sob comando forçado`, source: 'measurementNormalizer' };
      }

      if (measurement.isPresent) {
        return { level: 'SCAN', message: `${measurement.label} detectado`, source: 'measurementNormalizer' };
      }

      if (measurement.isAbsent) {
        return { level: 'WARN', message: `${measurement.label} ausente`, source: 'measurementNormalizer' };
      }

      if (measurement.states.includes('low_resistance')) {
        return { level: 'FAIL', message: `${measurement.label} baixa resistência: ${measurement.normalizedValue}`, source: 'measurementNormalizer' };
      }

      if (measurement.states.includes('current_high')) {
        return { level: 'FAIL', message: `${measurement.label} corrente alta: ${measurement.normalizedValue}`, source: 'measurementNormalizer' };
      }

      return null;
    })
    .filter((log): log is DiagnosticLog => Boolean(log));
}

export function evaluateVoltageRules(_session: DiagnosticSession, measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();
  const standby5v = byId(measurements, 'standby_5v');
  const rail14v = byId(measurements, 'rail_14v');
  const rail12v = byId(measurements, 'rail_12v_initial');
  const rail3v3 = byId(measurements, 'rail_3v3');
  const rail1v2 = byId(measurements, 'rail_1v2');

  if (isVoltagePresent(standby5v) && isVoltagePresent(rail14v) && isVoltageAbsent(rail12v)) {
    evaluation.evidences.push({
      id: 'primary-standby-present-secondary-absent',
      level: 'warning',
      text: '5 V e 14 V presentes com trilho de 12 V ausente no modo normal.',
      source: 'evaluateVoltageRules',
      relatedRule: 'forced-command-functional-source',
      relatedMeasurements: ['standby_5v', 'rail_14v', 'rail_12v_initial'],
      strength: 'medium',
    });
  }

  if (isVoltagePresent(rail3v3) && isVoltagePresent(rail1v2)) {
    evaluation.evidences.push({
      id: 'main-logic-rails-present',
      level: 'info',
      text: 'Linhas de 3,3 V e 1,2 V presentes, mas a CPU permanece sem inicialização.',
      source: 'evaluateVoltageRules',
      relatedRule: 'cpu-no-activity',
      relatedMeasurements: ['rail_3v3', 'rail_1v2', 'cpu_temperature'],
      strength: 'medium',
    });
  }

  return evaluation;
}

export function evaluateResistanceRules(_session: DiagnosticSession, measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();

  measurements
    .filter((measurement) => measurement.type === 'resistance' && isLowResistance(measurement))
    .forEach((measurement) => {
      evaluation.evidences.push({
        id: `${measurement.id}-low-resistance`,
        level: 'critical',
        text: `${measurement.label}: baixa resistência para GND (${measurement.normalizedValue}).`,
        source: 'evaluateResistanceRules',
        relatedRule: 'shorted-rail',
        relatedMeasurements: [measurement.id],
        strength: 'strong',
      });
    });

  return evaluation;
}

export function evaluateSignalRules(_session: DiagnosticSession, measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();
  const pfcCommand = byId(measurements, 'pfc_pctl');
  const l304Activity = byId(measurements, 'l304_activity');

  if (isSignalAbsent(pfcCommand)) {
    evaluation.evidences.push({
      id: 'pfc-pctl-command-absent',
      level: 'warning',
      text: 'Comando PFC_PCTL ausente durante a sequência normal.',
      source: 'evaluateSignalRules',
      relatedRule: 'forced-command-functional-source',
      relatedMeasurements: ['pfc_pctl'],
      strength: 'weak',
    });
    evaluation.hypothesisSeeds.push({
      id: 'control_logic',
      title: 'Lógica de boot/controle suspeita',
      description: 'A placa principal não libera o comando de controle esperado durante a partida.',
      category: 'control',
      severity: 'high',
      suspects: ['placa principal', 'comando power', 'lógica de controle', 'firmware'],
      relatedMeasurements: ['pfc_pctl'],
      evidenceIds: ['pfc-pctl-command-absent'],
      contributions: ['weak'],
    });
  }

  if (isSignalAbsent(l304Activity)) {
    evaluation.evidences.push({
      id: 'l304-switching-absent',
      level: 'warning',
      text: 'Atividade de comutação L304 ausente.',
      source: 'evaluateSignalRules',
      relatedRule: 'cpu-no-activity',
      relatedMeasurements: ['l304_activity'],
      strength: 'weak',
    });
  }

  return evaluation;
}

export function evaluateShortRules(signatures: BehaviorSignature[], measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();
  const shortSignature = signature(signatures, 'shorted-rail');
  const lowResistance = measurements.find((measurement) => isLowResistance(measurement));
  const highCurrent = measurements.find((measurement) => isHighCurrent(measurement));

  if (!lowResistance && !highCurrent) {
    return evaluation;
  }

  evaluation.evidences.push({
    id: 'probable-shorted-rail',
    level: 'critical',
    text: 'Baixa resistência e corrente elevada com queda de tensão indicam curto provável no trilho.',
    source: 'evaluateShortRules',
    relatedRule: shortSignature.id,
    relatedMeasurements: [lowResistance?.id, highCurrent?.id].filter((id): id is string => Boolean(id)),
    strength: 'strong',
  });
  evaluation.hypothesisSeeds.push({
    id: 'shorted_rail',
    title: 'Linha em curto provável',
    description: shortSignature.description,
    category: 'short',
    severity: 'critical',
    suspects: shortSignature.suspects.map((suspect) => suspect.title),
    relatedMeasurements: [lowResistance?.id, highCurrent?.id].filter((id): id is string => Boolean(id)),
    evidenceIds: ['probable-shorted-rail'],
    contributions: lowResistance && highCurrent ? ['strong', 'strong'] : ['strong'],
  });
  evaluation.nextTests.push(...testFromSignature(shortSignature));
  evaluation.logs.push({ level: 'FAIL', message: 'Curto provável detectado no trilho alvo', source: 'evaluateShortRules' });

  return evaluation;
}

export function evaluateBootRules(session: DiagnosticSession, signatures: BehaviorSignature[], measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();
  const cpuSignature = signature(signatures, 'cpu-no-activity');
  const spiSignature = signature(signatures, 'spi-powered-no-boot');
  const rail3v3 = byId(measurements, 'rail_3v3');
  const rail1v2 = byId(measurements, 'rail_1v2');
  const spiVcc = byId(measurements, 'spi_vcc');
  const cpuTemperature = byId(measurements, 'cpu_temperature');
  const pfcCommand = byId(measurements, 'pfc_pctl');
  const mainRailsPresent = isVoltagePresent(rail3v3) && isVoltagePresent(rail1v2);
  const cpuCold = hasState(cpuTemperature, 'temperature_cold');
  const pfcAbsent = isSignalAbsent(pfcCommand);
  const symptomsMentionTiming = session.symptoms.some((symptom) => hasText(symptom, 'clock') || hasText(symptom, 'reset'));

  if (mainRailsPresent && cpuCold && pfcAbsent) {
    evaluation.evidences.push({
      id: 'main-board-no-boot-sequence',
      level: 'warning',
      text: 'CPU permanece fria e comandos de boot/controle não são liberados.',
      source: 'evaluateBootRules',
      relatedRule: cpuSignature.id,
      relatedMeasurements: ['rail_3v3', 'rail_1v2', 'cpu_temperature', 'pfc_pctl'],
      strength: 'medium',
    });
    evaluation.hypothesisSeeds.push(
      {
        id: 'cpu_boot_failure',
        title: 'Falha na inicialização da CPU',
        description: 'Tensões principais existem, mas a CPU não apresenta progressão de boot.',
        category: 'boot',
        severity: 'high',
        suspects: ['reset', 'clock', 'firmware', 'alimentação secundária ausente'],
        relatedMeasurements: ['rail_3v3', 'rail_1v2', 'cpu_temperature', 'pfc_pctl'],
        evidenceIds: ['main-board-no-boot-sequence'],
        contributions: ['medium', 'weak', 'weak'],
        confidenceOffset: -2,
      },
      {
        id: 'firmware_spi',
        title: 'Firmware SPI suspeito',
        description: 'A cadeia de boot está alimentada, mas não há progressão suficiente para liberar comandos.',
        category: 'firmware',
        severity: 'high',
        suspects: ['firmware SPI', 'transação SPI ausente', 'imagem corrompida'],
        relatedMeasurements: ['rail_3v3', 'rail_1v2', 'cpu_temperature'],
        evidenceIds: ['main-board-no-boot-sequence'],
        contributions: ['medium'],
      },
      {
        id: 'clock_reset',
        title: 'Clock/Reset suspeito',
        description: 'CPU alimentada permanece parada; clock ausente ou reset preso devem ser verificados.',
        category: 'timing',
        severity: 'medium',
        suspects: ['reset', 'clock', 'cristal'],
        relatedMeasurements: ['cpu_temperature', 'pfc_pctl'],
        evidenceIds: ['main-board-no-boot-sequence'],
        contributions: symptomsMentionTiming ? ['medium', 'weak'] : ['weak'],
        confidenceOffset: symptomsMentionTiming ? -6 : 0,
      },
    );
    evaluation.conclusions.push('A placa principal não inicializa a sequência de boot/controle.');
    evaluation.nextTests.push(...testFromSignature(cpuSignature));
    evaluation.logs.push({ level: 'WARN', message: 'Placa principal não libera sinais de boot/controle', source: 'evaluateBootRules' });
  }

  if (isVoltagePresent(spiVcc) && cpuCold) {
    evaluation.evidences.push({
      id: 'spi-vcc-present-no-boot',
      level: 'warning',
      text: 'SPI VCC detectado.',
      source: 'evaluateBootRules',
      relatedRule: spiSignature.id,
      relatedMeasurements: ['spi_vcc', 'cpu_temperature'],
      strength: 'strong',
    });
    evaluation.hypothesisSeeds.push({
      id: 'firmware_spi',
      title: 'Firmware SPI suspeito',
      description: 'SPI está alimentada, mas a CPU não progride no boot.',
      category: 'firmware',
      severity: 'high',
      suspects: ['firmware SPI', 'reset', 'clock', 'CPU/PCH'],
      relatedMeasurements: ['spi_vcc', 'cpu_temperature'],
      evidenceIds: ['spi-vcc-present-no-boot'],
      contributions: ['strong', 'weak'],
    });
    evaluation.nextTests.push(...testFromSignature(spiSignature));
    evaluation.logs.push({ level: 'AI', message: 'Firmware SPI suspeito', source: 'evaluateBootRules' });
  }

  return evaluation;
}

export function evaluateForcedCommandRules(signatures: BehaviorSignature[], measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();
  const forcedSignature = signature(signatures, 'forced-command-functional-source');
  const initial12v = byId(measurements, 'rail_12v_initial');
  const forced12v = byId(measurements, 'rail_12v_forced');

  if (!isVoltageAbsent(initial12v) || !isVoltagePresent(forced12v)) {
    return evaluation;
  }

  evaluation.evidences.push({
    id: 'source-functional-forced-command',
    level: 'success',
    text: 'Fonte classificada como funcional no teste com comando forçado.',
    source: 'evaluateForcedCommandRules',
    relatedRule: forcedSignature.id,
    relatedMeasurements: ['rail_12v_initial', 'rail_12v_forced'],
    strength: 'strong',
  });
  evaluation.evidences.push({
    id: 'rail-12v-recovers-forced-command',
    level: 'success',
    text: 'Trilho de 12 V ausente inicialmente; tensão aparece quando PFC_PCTL é forçado.',
    source: 'evaluateForcedCommandRules',
    relatedRule: forcedSignature.id,
    relatedMeasurements: ['rail_12v_initial', 'rail_12v_forced'],
    strength: 'strong',
  });
  evaluation.hypothesisSeeds.push(
    {
      id: 'source_functional',
      title: 'Fonte provavelmente funcional',
      description: 'O estágio de fonte gera 12 V quando o comando PFC_PCTL é forçado.',
      category: 'power',
      severity: 'low',
      suspects: ['fonte funcional sob comando'],
      relatedMeasurements: ['rail_12v_initial', 'rail_12v_forced'],
      evidenceIds: ['source-functional-forced-command', 'rail-12v-recovers-forced-command'],
      contributions: ['strong', 'medium'],
    },
    {
      id: 'control_logic',
      title: 'Lógica de boot/controle suspeita',
      description: 'A fonte responde, mas a placa principal não libera o comando no modo normal.',
      category: 'control',
      severity: 'high',
      suspects: forcedSignature.suspects.map((suspect) => suspect.title),
      relatedMeasurements: ['rail_12v_initial', 'rail_12v_forced', 'pfc_pctl'],
      evidenceIds: ['source-functional-forced-command', 'rail-12v-recovers-forced-command'],
      contributions: ['strong'],
      confidenceOffset: 2,
    },
  );
  evaluation.conclusions.push('Fonte classificada como funcional no teste com comando forçado.');
  evaluation.nextTests.push(...testFromSignature(forcedSignature));
  evaluation.logs.push(
    { level: 'TEST', message: 'PFC_PCTL forçado -> trilho de 12 V ativo', source: 'evaluateForcedCommandRules' },
    { level: 'AI', message: 'Fonte classificada como funcional', source: 'evaluateForcedCommandRules' },
  );

  return evaluation;
}

export function evaluateRegulatorRules(signatures: BehaviorSignature[], measurements: NormalizedMeasurement[]): RuleEvaluation {
  const evaluation = emptyEvaluation();
  const buckNoEnable = signature(signatures, 'buck-no-enable');
  const buckNoOutput = signature(signatures, 'buck-vin-enable-no-output');
  const ldoNoOutput = signature(signatures, 'ldo-no-output');
  const buckVin = findByLabel(measurements, 'Buck VIN');
  const buckEnable = findByLabel(measurements, 'Buck ENABLE');
  const buckVout = findByLabel(measurements, 'Buck VOUT');
  const ldoInput = findByLabel(measurements, 'LDO input');
  const ldoOutput = findByLabel(measurements, 'LDO output');

  if (isVoltagePresent(buckVin) && isSignalAbsent(buckEnable) && isVoltageAbsent(buckVout)) {
    evaluation.evidences.push({
      id: 'buck-vin-no-enable-no-output',
      level: 'critical',
      text: 'Buck com VIN presente, ENABLE ausente e VOUT ausente.',
      source: 'evaluateRegulatorRules',
      relatedRule: buckNoEnable.id,
      relatedMeasurements: [buckVin?.id, buckEnable?.id, buckVout?.id].filter((id): id is string => Boolean(id)),
      strength: 'strong',
    });
    evaluation.hypothesisSeeds.push({
      id: 'buck_converter',
      title: 'Conversor Buck suspeito',
      description: buckNoEnable.description,
      category: 'regulator',
      severity: 'high',
      suspects: buckNoEnable.suspects.map((suspect) => suspect.title),
      relatedMeasurements: [buckVin?.id, buckEnable?.id, buckVout?.id].filter((id): id is string => Boolean(id)),
      evidenceIds: ['buck-vin-no-enable-no-output'],
      contributions: ['strong', 'medium'],
    });
    evaluation.nextTests.push(...testFromSignature(buckNoEnable));
  }

  if (isVoltagePresent(buckVin) && isSignalPresent(buckEnable) && isVoltageAbsent(buckVout)) {
    evaluation.evidences.push({
      id: 'buck-vin-enable-no-output',
      level: 'critical',
      text: 'Buck com VIN e ENABLE presentes, mas sem saída.',
      source: 'evaluateRegulatorRules',
      relatedRule: buckNoOutput.id,
      relatedMeasurements: [buckVin?.id, buckEnable?.id, buckVout?.id].filter((id): id is string => Boolean(id)),
      strength: 'strong',
    });
    evaluation.hypothesisSeeds.push({
      id: 'buck_converter',
      title: 'Conversor Buck suspeito',
      description: buckNoOutput.description,
      category: 'regulator',
      severity: 'high',
      suspects: buckNoOutput.suspects.map((suspect) => suspect.title),
      relatedMeasurements: [buckVin?.id, buckEnable?.id, buckVout?.id].filter((id): id is string => Boolean(id)),
      evidenceIds: ['buck-vin-enable-no-output'],
      contributions: ['strong', 'strong', 'medium'],
    });
    evaluation.nextTests.push(...testFromSignature(buckNoOutput));
  }

  if (isVoltagePresent(ldoInput) && isVoltageAbsent(ldoOutput)) {
    evaluation.evidences.push({
      id: 'ldo-input-no-output',
      level: 'critical',
      text: 'LDO com entrada presente e saída ausente.',
      source: 'evaluateRegulatorRules',
      relatedRule: ldoNoOutput.id,
      relatedMeasurements: [ldoInput?.id, ldoOutput?.id].filter((id): id is string => Boolean(id)),
      strength: 'strong',
    });
    evaluation.hypothesisSeeds.push({
      id: 'ldo_regulator',
      title: 'Regulador LDO suspeito',
      description: ldoNoOutput.description,
      category: 'regulator',
      severity: 'high',
      suspects: ldoNoOutput.suspects.map((suspect) => suspect.title),
      relatedMeasurements: [ldoInput?.id, ldoOutput?.id].filter((id): id is string => Boolean(id)),
      evidenceIds: ['ldo-input-no-output'],
      contributions: ['strong', 'strong'],
    });
    evaluation.nextTests.push(...testFromSignature(ldoNoOutput));
  }

  return evaluation;
}

export function evaluateRules(session: DiagnosticSession, measurements: NormalizedMeasurement[], signatures: BehaviorSignature[]): RuleEvaluation {
  return mergeEvaluations([
    { ...emptyEvaluation(), logs: scanLogs(measurements) },
    evaluateVoltageRules(session, measurements),
    evaluateResistanceRules(session, measurements),
    evaluateSignalRules(session, measurements),
    evaluateShortRules(signatures, measurements),
    evaluateBootRules(session, signatures, measurements),
    evaluateForcedCommandRules(signatures, measurements),
    evaluateRegulatorRules(signatures, measurements),
  ]);
}
