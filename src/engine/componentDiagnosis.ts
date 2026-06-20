import { componentFailureSignatures } from '../data/componentFailureSignatures';
import type { ComponentFinding, ComponentFindingStatus, ComponentType } from '../types/components';
import type { ConfirmationState } from '../types/confirmation';
import type { DiagnosticLog, Evidence, NextTest } from '../types/diagnostics';
import type { LineFinding, OfflineScanInput } from '../types/offlineScan';
import type { InjectionResponseFinding } from './injectionResponseAnalyzer';

export type ComponentDiagnosisResult = {
  componentFindings: ComponentFinding[];
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
      input.context,
      input.componentLabel,
      input.componentType,
      input.confirmationProof,
    ].join(' '),
  );
}

function hasAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => source.includes(normalizeText(pattern)));
}

function nextTest(id: string, title: string, description: string, priority: number): NextTest {
  return {
    id,
    title,
    description,
    priority,
    safetyNote: priority === 1 ? 'Confirmar com placa desligada e injeção limitada quando aplicável.' : undefined,
  };
}

function evidence(id: string, level: Evidence['level'], text: string, strength: Evidence['strength'] = 'medium'): Evidence {
  return {
    id,
    level,
    text,
    source: 'runComponentDiagnosis',
    relatedRule: 'component-diagnosis',
    strength,
  };
}

function log(level: DiagnosticLog['level'], message: string): DiagnosticLog {
  return {
    level,
    message,
    source: 'runComponentDiagnosis',
  };
}

function inferComponentType(source: string, explicit?: ComponentType): ComponentType | undefined {
  if (explicit) return explicit;
  if (hasAny(source, ['mosfet', 'd-s', 'dreno source', 'dreno-source'])) return 'mosfet';
  if (hasAny(source, ['capacitor', 'cap ceramico', 'cap cerâmico'])) return 'capacitor';
  if (hasAny(source, ['diodo', 'tvs'])) return 'diode';
  if (hasAny(source, ['bobina', 'indutor', 'l304'])) return 'inductor';
  if (hasAny(source, ['ldo'])) return 'ldo';
  if (hasAny(source, ['pwm'])) return 'pwm_controller';
  if (hasAny(source, ['buck'])) return 'buck_controller';
  if (hasAny(source, ['spi flash', 'firmware spi', 'spi'])) return 'spi_flash';
  if (hasAny(source, ['cpu', 'processador'])) return 'cpu';

  return undefined;
}

function inferLabel(input: OfflineScanInput, componentType: ComponentType): string {
  if (input.componentLabel?.trim()) return input.componentLabel.trim();

  const labels: Record<ComponentType, string> = {
    capacitor: 'capacitor na linha',
    mosfet: 'MOSFET associado',
    diode: 'diodo associado',
    resistor: 'resistor associado',
    inductor: input.node.toLowerCase().includes('l304') ? 'L304' : 'bobina associada',
    ldo: 'LDO associado',
    buck_controller: 'controlador buck',
    pwm_controller: 'controlador PWM',
    spi_flash: 'SPI Flash',
    cpu: 'CPU',
    unknown_ic: 'componente associado',
  };

  return labels[componentType];
}

function statusFor(componentType: ComponentType, confirmed: boolean, source: string): ComponentFindingStatus {
  if (confirmed) return 'isolated_fault';
  if (componentType === 'inductor' || hasAny(source, ['caminho aberto', 'retorno ausente', 'sem continuidade'])) return 'open_path';
  if (hasAny(source, ['aquecimento', 'aqueceu'])) return 'thermal_response';
  if (componentType === 'diode') return 'abnormal_junction';
  if (hasAny(source, ['curto', 'baixa impedancia', 'baixa impedância', 'd-s baixo', 'ds baixo'])) return 'short_detected';

  return 'inconclusive';
}

function confirmationFor(triggered: boolean, correlated: boolean, confirmed: boolean, source: string): ConfirmationState {
  if (confirmed) return 'confirmed';
  if (triggered && correlated && hasAny(source, ['corrente alta', 'aquecimento localizado', 'aqueceu', 'aquecimento', 'retorno atenuado', 'd-s baixo', 'ds baixo'])) return 'strong_indication';
  if (triggered && correlated) return 'correlated';
  return triggered ? 'detected' : 'correlated';
}

function confidenceFor(state: ConfirmationState): number {
  if (state === 'confirmed') return 96;
  if (state === 'strong_indication') return 82;
  if (state === 'correlated') return 66;
  return 48;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function runComponentDiagnosis(
  input: OfflineScanInput,
  lineFindings: LineFinding[],
  injectionFindings: InjectionResponseFinding[],
): ComponentDiagnosisResult {
  const source = sourceText(input);
  const inferredComponentType = inferComponentType(source, input.componentType);
  const lineIsShort = lineFindings.some((finding) => finding.status === 'low_impedance' || finding.status === 'short_detected');
  const hasHighCurrent = injectionFindings.some((finding) => finding.status === 'high_current_low_voltage');
  const hasNoReturn = injectionFindings.some((finding) => finding.status === 'no_return');
  const augmentedSource = `${source} ${lineIsShort ? ' linha em curto baixa impedancia' : ''} ${hasHighCurrent ? ' corrente alta' : ''} ${hasNoReturn ? ' retorno ausente caminho aberto' : ''}`;
  const findings: ComponentFinding[] = [];
  const evidences: Evidence[] = [];
  const nextTests: NextTest[] = [];
  const logs: DiagnosticLog[] = [];

  componentFailureSignatures.forEach((signature) => {
    const typeMatches = inferredComponentType === signature.componentType || (!inferredComponentType && hasAny(augmentedSource, signature.triggerPatterns));
    const triggered = typeMatches && hasAny(augmentedSource, signature.triggerPatterns);
    const correlated = triggered && (hasAny(augmentedSource, signature.correlatedPatterns) || lineIsShort || hasHighCurrent || hasNoReturn);
    const confirmed = triggered && hasAny(augmentedSource, signature.confirmationPatterns);

    if (!triggered && !correlated && !confirmed) {
      return;
    }

    const confirmationState = confirmationFor(triggered, correlated, confirmed, augmentedSource);
    const componentLabel = inferLabel(input, signature.componentType);
    const status = statusFor(signature.componentType, confirmed, augmentedSource);
    const componentFinding: ComponentFinding = {
      id: `${input.id}-${signature.id}`,
      componentType: signature.componentType,
      componentLabel,
      lineName: input.node || 'linha analisada',
      status,
      confidence: confidenceFor(confirmationState),
      confirmationState,
      evidences: [
        `${signature.title}: ${componentLabel} correlacionado com ${input.node || 'linha analisada'}.`,
        ...signature.suspects.slice(0, 2),
      ],
      nextTests: signature.nextTests.map((test, index) =>
        nextTest(`${input.id}-${signature.id}-test-${index}`, test, `${signature.title}. ${test}`, index + 1),
      ),
    };

    findings.push(componentFinding);
    evidences.push(
      evidence(
        `${input.id}-${signature.id}-ev`,
        confirmationState === 'confirmed' ? 'success' : confirmationState === 'strong_indication' ? 'critical' : 'warning',
        `${signature.title}: ${componentLabel} correlacionado com ${input.node || 'linha analisada'}.`,
        confirmationState === 'detected' ? 'medium' : 'strong',
      ),
    );
    nextTests.push(...componentFinding.nextTests);
    logs.push(log(confirmationState === 'confirmed' ? 'AI' : 'WARN', `Diagnóstico de componente: ${signature.title}.`));
  });

  if (findings.length === 0 && inferredComponentType && (lineIsShort || hasHighCurrent || hasNoReturn)) {
    const confirmationState: ConfirmationState = hasHighCurrent && lineIsShort ? 'strong_indication' : 'correlated';
    const componentLabel = inferLabel(input, inferredComponentType);

    findings.push({
      id: `${input.id}-generic-component-finding`,
      componentType: inferredComponentType,
      componentLabel,
      lineName: input.node || 'linha analisada',
      status: lineIsShort ? 'short_detected' : hasNoReturn ? 'open_path' : 'inconclusive',
      confidence: confidenceFor(confirmationState),
      confirmationState,
      evidences: [`${componentLabel} correlacionado com resposta anormal na ${input.node || 'linha analisada'}.`],
      nextTests: [
        nextTest(`${input.id}-generic-isolate`, 'Isolar componente indicado.', 'Separar o componente e repetir a leitura da linha.', 1),
        nextTest(`${input.id}-generic-before-after`, 'Comparar antes/depois.', 'Registrar a mudança elétrica após isolamento.', 2),
      ],
    });
    evidences.push(evidence(`${input.id}-generic-component-ev`, 'warning', `${componentLabel} correlacionado com resposta anormal na ${input.node || 'linha analisada'}.`, 'medium'));
    logs.push(log('WARN', `${componentLabel} correlacionado com resposta anormal.`));
  }

  return {
    componentFindings: uniqueById(findings),
    evidences: uniqueById(evidences),
    nextTests: uniqueById(nextTests),
    logs,
  };
}
