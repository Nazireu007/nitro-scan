import type { DiagnosticLog, Evidence, NextTest } from '../types/diagnostics';
import type { FindingSeverity, OfflineScanInput } from '../types/offlineScan';
import { parseNumericValue } from '../utils/electrical';

export type InjectionResponseStatus =
  | 'high_current_low_voltage'
  | 'no_return'
  | 'attenuated_return'
  | 'normal_return'
  | 'line_normalized';

export type InjectionResponseFinding = {
  id: string;
  status: InjectionResponseStatus;
  severity: FindingSeverity;
  confidence: number;
  evidences: string[];
};

export type InjectionResponseAnalysis = {
  findings: InjectionResponseFinding[];
  evidences: Evidence[];
  nextTests: NextTest[];
  logs: DiagnosticLog[];
};

function normalizeText(value: string | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sourceText(input: OfflineScanInput): string {
  return normalizeText(
    [
      input.testMode,
      input.testOrigin,
      input.node,
      input.response,
      input.unit,
      input.context,
      input.injectionVoltage,
      input.measuredCurrent,
      input.signalFrequency,
      input.returnAmplitude,
      input.attenuation,
      input.readChannel,
      input.componentLabel,
      input.componentType,
      input.confirmationProof,
    ].join(' '),
  );
}

function hasAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(normalizeText(pattern)));
}

function lineName(input: OfflineScanInput): string {
  return input.node.trim() || 'linha analisada';
}

function evidence(id: string, level: Evidence['level'], text: string, strength: Evidence['strength'] = 'medium'): Evidence {
  return {
    id,
    level,
    text,
    source: 'analyzeInjectionResponse',
    relatedRule: 'offline-injection-response',
    strength,
  };
}

function nextTest(id: string, title: string, description: string, priority: number, safetyNote?: string): NextTest {
  return {
    id,
    title,
    description,
    priority,
    safetyNote,
  };
}

function log(level: DiagnosticLog['level'], message: string): DiagnosticLog {
  return {
    level,
    message,
    source: 'analyzeInjectionResponse',
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function analyzeInjectionResponse(input: OfflineScanInput): InjectionResponseAnalysis {
  const source = sourceText(input);
  const line = lineName(input);
  const findings: InjectionResponseFinding[] = [];
  const evidences: Evidence[] = [];
  const nextTests: NextTest[] = [];
  const logs: DiagnosticLog[] = [];
  const injectionVoltage = parseNumericValue(input.injectionVoltage ?? null);
  const currentValue =
    parseNumericValue(input.measuredCurrent ?? null) ??
    (input.unit.toLowerCase() === 'a' ? parseNumericValue(input.response) : undefined);
  const returnValue =
    parseNumericValue(input.returnAmplitude ?? null) ??
    (input.unit === '%' ? parseNumericValue(input.response) : undefined);
  const lowVoltageInjection = input.testMode === 'low_injection' || (injectionVoltage !== undefined && injectionVoltage <= 1);
  const currentHigh = hasAny(source, ['corrente alta', 'corrente elevada', 'consumo alto', 'excessiva']) || (currentValue !== undefined && currentValue >= 0.5);
  const noReturn = hasAny(source, ['retorno ausente', 'sem retorno', 'sinal ausente', 'ausente no ponto b', 'sem continuidade']);
  const attenuated =
    hasAny(source, ['retorno atenuado', 'muito atenuado', 'atenuação alta', 'atenuacao alta', 'amplitude baixa']) ||
    (returnValue !== undefined && returnValue > 0 && returnValue <= 35);
  const normalReturn = hasAny(source, ['retorno normal', 'sinal presente', 'caminho integro', 'caminho íntegro']);
  const lineNormalized = hasAny(source, ['linha normalizou', 'normalizou apos isolar', 'normalizou após isolar', 'curto sumiu', 'remocao normaliza', 'remoção normaliza']);

  if (lowVoltageInjection && currentHigh) {
    findings.push({
      id: `${input.id}-high-current-low-voltage`,
      status: 'high_current_low_voltage',
      severity: currentValue !== undefined && currentValue >= 1 ? 'critical' : 'high',
      confidence: currentValue !== undefined && currentValue >= 1 ? 88 : 80,
      evidences: [`Corrente elevada durante injeção limitada na ${line}.`],
    });
    evidences.push(evidence(`${input.id}-high-current-low-voltage-ev`, 'critical', `Corrente elevada durante injeção limitada na ${line}.`, 'strong'));
    nextTests.push(
      nextTest(
        `${input.id}-thermal-search`,
        'Localizar aquecimento na linha.',
        'Manter injeção limitada e procurar o primeiro componente que aquece.',
        1,
        'Usar baixa tensão e limite de corrente antes de elevar qualquer parâmetro.',
      ),
      nextTest(`${input.id}-repeat-resistance`, 'Repetir resistência para GND.', 'Comparar a resistência antes e depois da injeção limitada.', 2),
    );
    logs.push(log('FAIL', 'Corrente elevada durante injeção limitada.'));
  }

  if (noReturn) {
    findings.push({
      id: `${input.id}-no-return`,
      status: 'no_return',
      severity: 'high',
      confidence: 78,
      evidences: [`Retorno ausente no ${input.readChannel || 'canal de leitura'} da ${line}.`],
    });
    evidences.push(evidence(`${input.id}-no-return-ev`, 'warning', `Retorno ausente no ${input.readChannel || 'canal de leitura'} da ${line}.`, 'strong'));
    nextTests.push(
      nextTest(`${input.id}-continuity-ab`, 'Medir continuidade entre ponto A e B.', 'Confirmar se existe interrupção física entre os pontos comparados.', 1),
      nextTest(`${input.id}-last-valid-point`, 'Procurar último ponto com retorno.', 'Mover a leitura por trechos para localizar a interrupção do caminho.', 2),
    );
    logs.push(log('WARN', `Retorno ausente no ${input.readChannel || 'canal de leitura'}.`));
  }

  if (attenuated) {
    findings.push({
      id: `${input.id}-attenuated-return`,
      status: 'attenuated_return',
      severity: 'medium',
      confidence: 70,
      evidences: [`Retorno atenuado detectado na ${line}.`],
    });
    evidences.push(evidence(`${input.id}-attenuated-return-ev`, 'warning', `Retorno atenuado detectado na ${line}.`, 'medium'));
    nextTests.push(
      nextTest(`${input.id}-split-load`, 'Isolar carga da linha.', 'Separar a carga em teste e repetir a leitura de retorno.', 2),
      nextTest(`${input.id}-intermediate-return`, 'Medir retorno em ponto intermediário.', 'Comparar amplitude antes e depois do setor em teste.', 2),
    );
    logs.push(log('WARN', 'Retorno atenuado detectado.'));
  }

  if (normalReturn && findings.length === 0) {
    findings.push({
      id: `${input.id}-normal-return`,
      status: 'normal_return',
      severity: 'low',
      confidence: 58,
      evidences: [`Retorno da ${line} aparentemente íntegro no teste aplicado.`],
    });
    evidences.push(evidence(`${input.id}-normal-return-ev`, 'success', `Retorno da ${line} aparentemente íntegro no teste aplicado.`, 'weak'));
    nextTests.push(nextTest(`${input.id}-reference-capture`, 'Registrar leitura de referência.', 'Salvar a resposta normal como comparação para o próximo ponto.', 3));
    logs.push(log('SCAN', 'Retorno normal registrado no scan offline.'));
  }

  if (lineNormalized) {
    findings.push({
      id: `${input.id}-line-normalized`,
      status: 'line_normalized',
      severity: 'critical',
      confidence: 98,
      evidences: [`A ${line} normalizou após isolamento ou remoção do setor em teste.`],
    });
    evidences.push(evidence(`${input.id}-line-normalized-ev`, 'success', `A ${line} normalizou após isolamento ou remoção do setor em teste.`, 'strong'));
    nextTests.push(nextTest(`${input.id}-document-proof`, 'Registrar prova elétrica de fechamento.', 'Documentar medição antes/depois do isolamento para fechar o diagnóstico.', 1));
    logs.push(log('AI', 'Linha normalizou após isolar componente.'));
  }

  if (input.injectionVoltage) {
    logs.unshift(log('TEST', `Injeção baixa registrada: ${input.injectionVoltage}.`));
  }

  return {
    findings: uniqueById(findings),
    evidences: uniqueById(evidences),
    nextTests: uniqueById(nextTests),
    logs,
  };
}
