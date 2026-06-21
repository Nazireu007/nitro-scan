import type { DiagnosticLog, Evidence, NextTest } from '../types/diagnostics';
import type { ComponentType } from '../types/components';
import type { LineFinding, OfflineScanInput, OfflineScanResult } from '../types/offlineScan';
import { parseNumericValue } from '../utils/electrical';
import { runComponentDiagnosis } from './componentDiagnosis';
import { runConfirmationEngine } from './confirmationEngine';
import { runConnectorScan } from './connectorScanEngine';
import { analyzeInjectionResponse, type InjectionResponseFinding } from './injectionResponseAnalyzer';
import { verdictHeadline, verdictStatusFromState, verdictSummary } from './verdictPresentation';

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
      input.confirmationState,
      input.confirmationProof,
    ].join(' '),
  );
}

function hasAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(normalizeText(pattern)));
}

function hasToken(source: string, token: string): boolean {
  return source.split(/[^a-z0-9]+/).includes(normalizeText(token));
}

function lineName(input: OfflineScanInput): string {
  return input.node.trim() || 'linha analisada';
}

function evidence(id: string, level: Evidence['level'], text: string, strength: Evidence['strength'] = 'medium'): Evidence {
  return {
    id,
    level,
    text,
    source: 'runOfflineScan',
    relatedRule: 'offline-scan-engine',
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
    source: 'runOfflineScan',
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function evaluateLineFindings(input: OfflineScanInput, injectionFindings: InjectionResponseFinding[]): LineFinding[] {
  const source = sourceText(input);
  const line = lineName(input);
  const value = parseNumericValue(input.response);
  const returnValue = input.unit === '%' ? parseNumericValue(input.response) : parseNumericValue(input.returnAmplitude ?? null);
  const lowResistance = input.unit === 'Ω' && value !== undefined && value <= 2;
  const highResistance = input.unit === 'Ω' && value !== undefined && value > 100000;
  const shortText = hasAny(source, ['curto', 'baixa impedancia', 'baixa impedância', 'linha para gnd baixa', 'd-s baixo', 'ds baixo']);
  const currentText = hasAny(source, ['corrente alta', 'corrente elevada', 'consumo alto']);
  const openText =
    hasToken(source, 'OL') ||
    hasToken(source, 'aberto') ||
    hasAny(source, ['caminho aberto', 'sem continuidade', 'trilha rompida']);
  const noReturnText = hasAny(source, ['retorno ausente', 'sem retorno', 'sinal ausente', 'ausente no ponto b']);
  const attenuatedText = hasAny(source, ['retorno atenuado', 'atenuacao alta', 'atenuação alta', 'amplitude baixa']) || (returnValue !== undefined && returnValue > 0 && returnValue <= 35);
  const normalizedText = hasAny(source, ['linha normalizou', 'normalizou apos isolar', 'normalizou após isolar', 'curto sumiu']);
  const normalText = hasAny(source, ['normal', 'integro', 'íntegro', 'sinal presente', 'retorno normal']);
  const hasHighInjection = injectionFindings.some((finding) => finding.status === 'high_current_low_voltage');
  const findings: LineFinding[] = [];

  if (lowResistance || shortText || hasHighInjection) {
    const status = shortText || hasHighInjection ? 'short_detected' : 'low_impedance';
    const confidence = hasHighInjection && (lowResistance || shortText) ? 86 : lowResistance || shortText ? 74 : 68;

    findings.push({
      id: `${input.id}-line-short`,
      lineName: line,
      status,
      severity: hasHighInjection ? 'critical' : 'high',
      confidence,
      evidences: [
        lowResistance ? `Baixa impedância medida na ${line}: ${input.response}.` : `Resposta da ${line} compatível com baixa impedância.`,
        hasHighInjection ? 'Corrente elevada durante injeção limitada reforça curto/carga anormal.' : undefined,
      ].filter((item): item is string => Boolean(item)),
    });
  }

  if (currentText && !hasHighInjection) {
    findings.push({
      id: `${input.id}-abnormal-load`,
      lineName: line,
      status: 'abnormal_load',
      severity: 'high',
      confidence: 72,
      evidences: [`Consumo anormal registrado na ${line}.`],
    });
  }

  if (noReturnText) {
    findings.push({
      id: `${input.id}-no-return-signal`,
      lineName: line,
      status: 'no_return_signal',
      severity: 'high',
      confidence: 76,
      evidences: [`Sinal/retorno ausente na ${line}.`],
    });
  }

  if (openText || highResistance) {
    findings.push({
      id: `${input.id}-open-path`,
      lineName: line,
      status: 'open_path',
      severity: 'high',
      confidence: 78,
      evidences: [`Caminho aberto indicado na ${line}.`],
    });
  }

  if (attenuatedText) {
    findings.push({
      id: `${input.id}-attenuated-response`,
      lineName: line,
      status: 'attenuated_response',
      severity: 'medium',
      confidence: 70,
      evidences: [`Retorno atenuado na ${line}.`],
    });
  }

  if ((normalText || normalizedText) && findings.length === 0) {
    findings.push({
      id: `${input.id}-normal-response`,
      lineName: line,
      status: 'normal',
      severity: 'low',
      confidence: normalizedText ? 92 : 58,
      evidences: [normalizedText ? `A ${line} normalizou após isolamento.` : `A ${line} respondeu dentro do padrão informado.`],
    });
  }

  return uniqueById(findings);
}

function lineFindingEvidences(input: OfflineScanInput, findings: LineFinding[]): Evidence[] {
  return findings.flatMap((finding) => {
    const baseId = `${input.id}-${finding.status}`;
    const text = finding.evidences[0] ?? `Achado registrado na ${finding.lineName}.`;

    if (finding.status === 'short_detected' || finding.status === 'low_impedance') {
      return [evidence(baseId, 'critical', text, 'strong')];
    }

    if (finding.status === 'open_path' || finding.status === 'no_return_signal') {
      return [evidence(baseId, 'warning', text, 'strong')];
    }

    if (finding.status === 'attenuated_response' || finding.status === 'abnormal_load') {
      return [evidence(baseId, 'warning', text, 'medium')];
    }

    return [evidence(baseId, 'success', text, 'weak')];
  });
}

function lineFindingTests(input: OfflineScanInput, findings: LineFinding[]): NextTest[] {
  return findings.flatMap((finding) => {
    if (finding.status === 'short_detected' || finding.status === 'low_impedance') {
      return [
        nextTest(
          `${input.id}-limited-injection`,
          'Fazer injeção limitada.',
          'Aplicar baixa tensão com limite de corrente e observar resposta térmica.',
          1,
          'Começar com baixa tensão e corrente limitada.',
        ),
        nextTest(`${input.id}-isolate-load`, 'Isolar carga/componente.', 'Separar o setor em teste e repetir resistência da linha.', 1),
      ];
    }

    if (finding.status === 'open_path' || finding.status === 'no_return_signal') {
      return [
        nextTest(`${input.id}-continuity-test`, 'Medir continuidade do caminho.', 'Comparar ponto de origem e ponto de leitura para confirmar interrupção.', 1),
        nextTest(`${input.id}-before-after-signal`, 'Comparar sinal antes/depois.', 'Aplicar sinal leve e procurar o último ponto com retorno.', 2),
      ];
    }

    if (finding.status === 'attenuated_response') {
      return [nextTest(`${input.id}-attenuation-map`, 'Mapear atenuação por setores.', 'Medir retorno em pontos intermediários para localizar carga anormal.', 2)];
    }

    if (finding.status === 'abnormal_load') {
      return [nextTest(`${input.id}-load-isolation`, 'Isolar carga anormal.', 'Desconectar ou separar a carga associada e repetir a leitura.', 2)];
    }

    return [nextTest(`${input.id}-reference-log`, 'Registrar resposta como referência.', 'Usar a leitura normal para comparação com o próximo ponto.', 3)];
  });
}

function lineFindingLogs(input: OfflineScanInput, findings: LineFinding[]): DiagnosticLog[] {
  const started: DiagnosticLog = log('SCAN', 'Pré-scan offline iniciado.');

  return [
    started,
    ...findings.flatMap((finding) => {
      if (finding.status === 'short_detected' || finding.status === 'low_impedance') {
        return [
          log('WARN', `Baixa impedância detectada na ${finding.lineName}.`),
          log('AI', 'Evidências correlacionadas apontam para curto ou carga anormal na linha.'),
        ];
      }

      if (finding.status === 'open_path' || finding.status === 'no_return_signal') {
        return [
          log('WARN', `Resposta ausente na ${finding.lineName}.`),
          log('AI', 'Resposta por conector indica caminho interrompido.'),
        ];
      }

      if (finding.status === 'attenuated_response') {
        return [log('WARN', `Retorno atenuado detectado na ${finding.lineName}.`)];
      }

      if (finding.status === 'abnormal_load') {
        return [log('WARN', `Carga anormal detectada na ${finding.lineName}.`)];
      }

      return [log('SCAN', `Resposta normal registrada na ${finding.lineName}.`)];
    }),
  ];
}

function confirmationEvidence(input: OfflineScanInput, result: OfflineScanResult['confirmation']): Evidence[] {
  if (result.confirmationState === 'confirmed') {
    return [
      evidence(`${input.id}-confirmation-proof`, 'success', 'Veredito confirmado por prova elétrica.', 'strong'),
    ];
  }

  return result.missingProofs.slice(0, 2).map((proof, index) =>
    evidence(`${input.id}-missing-proof-${index}`, 'info', `Prova necessária: ${proof}`, 'weak'),
  );
}

function findingHeadline(result: OfflineScanResult, input: OfflineScanInput): string {
  const line = result.lineFindings[0];
  const component = result.componentFindings.find((finding) => finding.componentType !== 'unknown_ic') ?? result.componentFindings[0];
  const status = verdictStatusFromState(result.confirmation.confirmationState);

  if (result.confirmation.confirmationState === 'confirmed') {
    const componentDefects: Partial<Record<ComponentType, string>> = {
      capacitor: 'CAPACITOR CERÂMICO EM CURTO',
      mosfet: 'MOSFET D-S EM CURTO',
      diode: 'DIODO EM CURTO',
      inductor: 'BOBINA ABERTA',
      ldo: 'LDO/CI EM CURTO',
    };
    const defect = component ? componentDefects[component.componentType] : undefined;
    if (defect) return verdictHeadline(status, defect);
    if (hasAny(sourceText(input), ['linha normalizou', 'curto sumiu', 'normalizou apos isolar', 'normalizou após isolar'])) {
      return verdictHeadline(status, 'LINHA NORMALIZOU APÓS ISOLAMENTO');
    }
    if (line?.status === 'open_path' || line?.status === 'no_return_signal') return verdictHeadline(status, 'CAMINHO ABERTO');
    return verdictHeadline(status, line?.lineName.toUpperCase() || 'PROVA ELÉTRICA REGISTRADA');
  }
  return verdictHeadline(status);
}

function buildSummary(result: OfflineScanResult): string {
  const status = verdictStatusFromState(result.confirmation.confirmationState);
  const detail = status === 'confirmed'
    ? `Prova: ${result.confirmation.reasons[0] ?? 'fechamento elétrico registrado.'}`
    : `Prova necessária: ${result.confirmation.missingProofs[0] ?? 'executar teste elétrico de fechamento.'}`;
  return verdictSummary(status, detail);
}

export function runOfflineScan(input: OfflineScanInput): OfflineScanResult {
  const injection = analyzeInjectionResponse(input);
  const lineFindings = evaluateLineFindings(input, injection.findings);
  const component = runComponentDiagnosis(input, lineFindings, injection.findings);
  const connector = runConnectorScan(input);
  const lineEvidences = lineFindingEvidences(input, lineFindings);
  const lineTests = lineFindingTests(input, lineFindings);
  const lineLogs = lineFindingLogs(input, lineFindings);
  const preConfirmationEvidences = uniqueById([
    ...lineEvidences,
    ...injection.evidences,
    ...component.evidences,
    ...connector.evidences,
  ]);
  const confirmation = runConfirmationEngine({
    input,
    evidences: preConfirmationEvidences,
    lineFindings,
    componentFindings: component.componentFindings,
    injectionFindings: injection.findings,
  });
  const draft: OfflineScanResult = {
    lineFindings,
    componentFindings: component.componentFindings,
    confirmation,
    evidences: [],
    nextTests: [],
    logs: [],
    headline: '',
    summary: '',
  };
  const evidences = uniqueById([...preConfirmationEvidences, ...confirmationEvidence(input, confirmation)]);
  const nextTests = uniqueById([
    ...lineTests,
    ...injection.nextTests,
    ...component.nextTests,
    ...connector.nextTests,
    ...confirmation.nextConfirmationTests,
  ]).sort((left, right) => left.priority - right.priority);
  const logs = [
    ...connector.logs,
    ...lineLogs,
    ...injection.logs,
    ...component.logs,
    ...(confirmation.confirmationState === 'confirmed'
      ? [log('AI', 'Veredito confirmado por prova elétrica.')]
      : confirmation.missingProofs.length > 0
        ? [log('TEST', 'Sem veredito fechado. Prova necessária para confirmar.')]
        : [log('SCAN', 'Resposta elétrica normal registrada como referência.')]),
  ];
  const result: OfflineScanResult = {
    ...draft,
    evidences,
    nextTests,
    logs,
  };

  result.headline = findingHeadline(result, input);
  result.summary = buildSummary(result);

  return result;
}
