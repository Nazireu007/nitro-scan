import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircuitBoard,
  ClipboardCheck,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  Microscope,
  RadioTower,
  ScrollText,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { ArchitectureConnections } from './ArchitectureConnections';
import { DiagnosticFlowConnections } from './DiagnosticFlowConnections';
import type { DiagnosticResult, DiagnosticScenario, EngineLog } from '../engine/types';

type ArchitectureHeroProps = {
  scenario: DiagnosticScenario;
  result: DiagnosticResult;
  scenarios: DiagnosticScenario[];
  selectedScenarioId: string;
  onSelect: (scenarioId: string) => void;
};

type PanelProps = {
  title: string;
  icon: LucideIcon;
  className: string;
  children: ReactNode;
  hideTitlebar?: boolean;
};

type FlowStep = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

const nitroCoreImage = `${import.meta.env.BASE_URL}nitro-core-chip.webp`;

const investigationStatuses = ['EM ANÁLISE', 'PENDENTE', 'NA BANCADA', 'CONCLUÍDO'] as const;
const investigationStatusClasses = ['state-active', 'state-pending', 'state-bench', 'state-done'] as const;

function decimalComma(value: string): string {
  return value.replace('.', ',');
}

function normalizeTechnicalText(value: string): string {
  return value
    .replace(/\bn\/a\b/gi, 'n/d')
    .replace(/(\d+(?:[.,]\d+)?)\s*ohms?\b/gi, (_, amount: string) => `${decimalComma(amount)} Ω`)
    .replace(/(\d+(?:[.,]\d+)?)\s*VA\b/g, (_, amount: string) => `${decimalComma(amount)} VA`)
    .replace(/(\d+(?:[.,]\d+)?)\s*V\b/g, (_, amount: string) => `${decimalComma(amount)} V`)
    .replace(/(\d+(?:[.,]\d+)?)\s*A\b/g, (_, amount: string) => `${decimalComma(amount)} A`)
    .replace(/(\d+(?:[.,]\d+)?)\s*C\b/g, (_, amount: string) => `${decimalComma(amount)} °C`)
    .replace(/Clock \/ Reset/g, 'Clock/Reset')
    .replace(/Clock\/reset/g, 'Clock/Reset');
}

function metricValue(result: DiagnosticResult, label: string): string {
  const value = result.monitorMetrics.find((metric) => metric.label === label)?.value ?? 'n/a';

  return translateMetricValue(value);
}

function clip(value: string, max = 96): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function averageConfidence(result: DiagnosticResult): number {
  if (result.suspects.length === 0) {
    return result.healthPercentage;
  }

  const total = result.suspects.reduce((sum, suspect) => sum + suspect.probability, 0);

  return Math.round(total / result.suspects.length);
}

function ringStyle(value: number): CSSProperties {
  return {
    '--ring-angle': `${Math.max(0, Math.min(100, value)) * 3.6}deg`,
  } as CSSProperties;
}

function fillStyle(value: number, delay = 0): CSSProperties {
  return {
    '--fill-value': `${Math.max(6, Math.min(100, value))}%`,
    '--fill-delay': `${delay}s`,
  } as CSSProperties;
}

function statusFromIndex(index: number): string {
  return investigationStatuses[index % investigationStatuses.length];
}

function statusClass(index: number): string {
  return investigationStatusClasses[index % investigationStatusClasses.length];
}

function translateDiagnosticText(value: string): string {
  const exactTranslations: Record<string, string> = {
    'Power supply classified as functional under forced-command test.':
      'Fonte classificada como funcional no teste com comando forçado.',
    'Main board is not initializing the boot/control sequence.':
      'A placa principal não está inicializando a sequência de boot/controle.',
    'Probable short detected on the measured rail.':
      'Curto provável detectado no trilho medido.',
    'Low resistance and/or high current with collapsing voltage indicates a probable short on the rail.':
      'Baixa resistência e/ou corrente alta com queda de tensão indicam curto provável no trilho.',
    'SPI VCC exists while CPU remains cold, so corrupted firmware or missing SPI transaction is plausible.':
      'A alimentação SPI está presente, mas a CPU permanece fria; firmware corrompido ou ausência de transação SPI é uma hipótese plausível.',
    '3.3V and 1.2V are present, but CPU thermal response is cold and PFC_PCTL is not released.':
      'As linhas de 3,3 V e 1,2 V estão presentes, mas a CPU permanece fria e o PFC_PCTL não é liberado.',
    '12V is absent at first, then rises when PFC_PCTL is forced. The power stage can generate the rail.':
      'O trilho de 12 V está ausente inicialmente, mas aparece quando o PFC_PCTL é forçado. O estágio de potência consegue gerar o trilho.',
    'Clock/reset chain requires direct probing.':
      'A cadeia de Clock/Reset exige medição direta.',
    'Secondary rails are blocked by missing command':
      'Trilhos secundários bloqueados por comando ausente.',
    'A missing clock or stuck reset can prevent the CPU from executing firmware.':
      'Clock ausente ou reset travado pode impedir a CPU de executar o firmware.',
    'Insufficient evidence for a high-confidence classification.':
      'Evidência insuficiente para uma classificação de alta confiança.',
    'The captured measurements match a known diagnostic pattern.':
      'As medições capturadas correspondem a um padrão de diagnóstico conhecido.',
    'At least one secondary rail is inactive while a required enable/control command is absent.':
      'Ao menos um trilho secundário está inativo enquanto um comando obrigatório de enable/controle está ausente.',
    'Shorted Rail': 'Trilho em curto',
    'Firmware SPI': 'Firmware SPI',
    'Boot/Control Logic': 'Lógica de boot/controle',
    'CPU Boot Failure': 'Falha de inicialização da CPU',
    'LG CJ87 Boot Failure': 'Falha de boot/controle LG CJ87',
    'Logic rails present with cold CPU': 'Trilhos lógicos presentes com CPU fria',
    'Buck converter no output': 'Conversor Buck sem saída',
    'Linear regulator no output': 'Regulador linear sem saída',
  };
  const translated = exactTranslations[value];

  if (translated) {
    return normalizeTechnicalText(translated);
  }

  return normalizeTechnicalText(value
    .replace(/Buck output resistance/g, 'Resistência de saída do Buck')
    .replace(/Buck input current/g, 'Corrente de entrada do Buck')
    .replace(/Buck Converter/g, 'Conversor Buck')
    .replace(/Buck VIN/g, 'VIN do Buck')
    .replace(/Buck ENABLE/g, 'ENABLE do Buck')
    .replace(/Buck VOUT/g, 'VOUT do Buck')
    .replace(/LDO output resistance/g, 'Resistência de saída do LDO')
    .replace(/LDO input current/g, 'Corrente de entrada do LDO')
    .replace(/LDO Regulator/g, 'Regulador LDO')
    .replace(/LDO input/g, 'Entrada do LDO')
    .replace(/LDO enable/g, 'Enable do LDO')
    .replace(/LDO output/g, 'Saída do LDO')
    .replace(/L304 output resistance/g, 'Resistência de saída L304')
    .replace(/L304 switching activity/g, 'Atividade de chaveamento L304')
    .replace(/Board current draw/g, 'Corrente da placa')
    .replace(/CPU thermal response/g, 'Resposta térmica da CPU')
    .replace(/PFC_PCTL command/g, 'Comando PFC_PCTL')
    .replace(/SPI VCC/g, 'VCC da SPI')
    .replace(/ and /g, ' e ')
    .replace(/, but /g, ', mas ')
    .replace(/ are valid/g, ' estão válidos')
    .replace(/ is valid/g, ' está válido')
    .replace(/ is absent/g, ' está ausente')
    .replace(/Shorted Rail/g, 'Trilho em curto')
    .replace(/Firmware SPI/g, 'Firmware SPI')
    .replace(/Boot\/Control Logic/g, 'Lógica de boot/controle')
    .replace(/CPU Boot Failure/g, 'Falha de inicialização da CPU')
    .replace(/Power supply/g, 'Fonte de alimentação')
    .replace(/Core rails/g, 'Trilhos principais')
    .replace(/Secondary rails/g, 'Trilhos secundários')
    .replace(/secondary rail/g, 'trilho secundário')
    .replace(/source rail/g, 'trilho de origem')
    .replace(/main board/g, 'placa principal')
    .replace(/Main board/g, 'A placa principal')
    .replace(/boot\/control sequence/g, 'sequência de boot/controle')
    .replace(/not initializing/g, 'não está inicializando')
    .replace(/not issuing/g, 'não está emitindo')
    .replace(/is the strongest match/g, 'é a hipótese mais forte')
    .replace(/is the primary suspect/g, 'é o principal suspeito')
    .replace(/suspected/g, 'suspeito')
    .replace(/detected/g, 'detectado')
    .replace(/absent/g, 'ausente')
    .replace(/present/g, 'presente')
    .replace(/valid/g, 'válido')
    .replace(/missing/g, 'ausente')
    .replace(/inactive/g, 'inativo')
    .replace(/required/g, 'obrigatório')
    .replace(/enable\/control command/g, 'comando de enable/controle')
    .replace(/current/g, 'corrente')
    .replace(/voltage/g, 'tensão')
    .replace(/resistance/g, 'resistência')
    .replace(/rail/g, 'trilho')
    .replace(/CPU remains cold/g, 'CPU permanece fria')
    .replace(/low-resistance or current-collapse criteria/g, 'critérios de baixa resistência ou colapso por corrente'));
}

function translateActionText(value: string): string {
  const exactTranslations: Record<string, string> = {
    'Trace why the main board is not releasing PFC_PCTL during normal boot.':
      'Rastrear por que a placa principal não libera PFC_PCTL durante a inicialização normal.',
    'Probe crystal/clock activity at the CPU.':
      'Medir a atividade do cristal/clock na CPU.',
    'Check reset line release during power-on.':
      'Verificar a liberação da linha de reset ao energizar.',
    'Read or reflash the SPI firmware image.':
      'Ler ou regravar a imagem de firmware SPI.',
    'Capture SPI CLK/CS/MOSI/MISO activity during startup.':
      'Capturar atividade SPI CLK/CS/MOSI/MISO durante a partida.',
    'Measure oscillator output and reset release with an oscilloscope.':
      'Medir a saída do oscilador e a liberação do reset com osciloscópio.',
    'Follow enable source back to the controller pin.':
      'Rastrear a origem do enable até o pino do controlador.',
    'Compare power-sequence timing against the service schematic.':
      'Comparar o tempo da sequência de alimentação com o esquema de serviço.',
    'Capture additional voltage, resistance and control-signal measurements.':
      'Capturar medições adicionais de tensão, resistência e sinais de controle.',
    'Inject limited current and inspect thermal response.':
      'Injetar corrente limitada e inspecionar a resposta térmica.',
    'Isolate downstream capacitors and loads from the collapsed rail.':
      'Isolar capacitores e cargas posteriores do trilho em queda.',
    'Measure the resistance again after removing suspicious loads.':
      'Medir a resistência novamente após remover cargas suspeitas.',
    'Measure resistance again after removing suspect load sections.':
      'Medir a resistência novamente após isolar seções de carga suspeitas.',
  };
  const translated = exactTranslations[value];

  if (translated) {
    return normalizeTechnicalText(translated);
  }

  return normalizeTechnicalText(value
    .replace(/^Check (.+) feedback path, switching\/regulation pin and output capacitor ESR\.$/, 'Verificar caminho de feedback de $1, pino de chaveamento/regulação e ESR do capacitor de saída.')
    .replace(/Buck Converter/g, 'Conversor Buck')
    .replace(/LDO Regulator/g, 'Regulador LDO')
    .replace(/L304 Secondary Rail/g, 'Trilho secundário L304')
    .replace(/Trace/g, 'Rastrear')
    .replace(/Probe/g, 'Medir')
    .replace(/Check/g, 'Verificar')
    .replace(/Capture/g, 'Capturar')
    .replace(/Measure/g, 'Medir')
    .replace(/Read or reflash/g, 'Ler ou regravar')
    .replace(/main board/g, 'placa principal')
    .replace(/during normal boot/g, 'durante a inicialização normal')
    .replace(/during startup/g, 'durante a partida')
    .replace(/firmware image/g, 'imagem de firmware')
    .replace(/reset line release/g, 'liberação da linha de reset')
    .replace(/crystal\/clock activity/g, 'atividade do cristal/clock')
    .replace(/power-on/g, 'energização')
    .replace(/additional voltage, resistance and control-signal measurements/g, 'medições adicionais de tensão, resistência e sinais de controle'));
}

function translateLogMessage(value: string): string {
  const exactTranslations: Record<string, string> = {
    'PFC_PCTL forced -> 12V rail active': 'PFC_PCTL forçado -> trilho de 12 V ativo',
    'Power supply classified as functional': 'Fonte classificada como funcional',
    'Main board not releasing enable signals': 'Placa principal não libera sinais de enable',
    'Probable short detected on target rail': 'Curto provável detectado no trilho alvo',
    'Clock/reset anomaly detected': 'Anomalia de Clock/Reset detectada',
    '3.3V rail detected': 'Trilho de 3,3 V detectado',
    '1.2V core rail detected': 'Trilho principal de 1,2 V detectado',
    '5.1VA Standby detected': 'Trilho de 5,1 VA em espera detectado',
    '5.1VA standby detected': 'Trilho de 5,1 VA em espera detectado',
    '14VA Input detected': 'Entrada de 14 VA detectada',
    'PFC command absent': 'Comando PFC ausente',
    'Firmware SPI suspected': 'Firmware SPI suspeito',
  };
  const translated = exactTranslations[value];

  if (translated) {
    return normalizeTechnicalText(translated);
  }

  return normalizeTechnicalText(value
    .replace(/Buck output resistance/g, 'Resistência de saída do Buck')
    .replace(/Buck input current/g, 'Corrente de entrada do Buck')
    .replace(/Buck Converter/g, 'Conversor Buck')
    .replace(/Buck VIN/g, 'VIN do Buck')
    .replace(/Buck ENABLE/g, 'ENABLE do Buck')
    .replace(/Buck VOUT/g, 'VOUT do Buck')
    .replace(/LDO output resistance/g, 'Resistência de saída do LDO')
    .replace(/LDO input current/g, 'Corrente de entrada do LDO')
    .replace(/LDO Regulator/g, 'Regulador LDO')
    .replace(/LDO input/g, 'Entrada do LDO')
    .replace(/LDO enable/g, 'Enable do LDO')
    .replace(/LDO output/g, 'Saída do LDO')
    .replace(/L304 output resistance/g, 'Resistência de saída L304')
    .replace(/L304 switching activity/g, 'Atividade de chaveamento L304')
    .replace(/Board current draw/g, 'Corrente da placa')
    .replace(/CPU thermal response/g, 'Resposta térmica da CPU')
    .replace(/PFC_PCTL command/g, 'Comando PFC_PCTL')
    .replace(/SPI VCC/g, 'VCC da SPI')
    .replace(/Target rail voltage/g, 'Tensão do trilho alvo')
    .replace(/target rail/g, 'trilho alvo')
    .replace(/Injected current/g, 'Corrente injetada')
    .replace(/Rail resistance/g, 'Resistência do trilho')
    .replace(/5\.1VA Standby/g, 'Trilho de 5,1 VA em espera')
    .replace(/5\.1VA standby/g, 'Trilho de 5,1 VA em espera')
    .replace(/Standby/g, 'Espera')
    .replace(/standby/g, 'espera')
    .replace(/14VA Input/g, 'Entrada de 14 VA')
    .replace(/12V rail initial/g, 'Trilho de 12 V inicial')
    .replace(/12V rail after PFC_PCTL forced/g, 'Trilho de 12 V após PFC_PCTL forçado')
    .replace(/3\.3V logic rail/g, 'Trilho lógico de 3,3 V')
    .replace(/1\.2V core rail/g, 'Trilho principal de 1,2 V')
    .replace(/Power supply/g, 'Fonte')
    .replace(/Main board/g, 'Placa principal')
    .replace(/Boot\/Control Logic/g, 'Lógica de boot/controle')
    .replace(/CPU Boot Failure/g, 'Falha de inicialização da CPU')
    .replace(/Shorted Rail/g, 'Trilho em curto')
    .replace(/Firmware SPI/g, 'Firmware SPI')
    .replace(/active under forced command/g, 'ativo sob comando forçado')
    .replace(/not releasing enable signals/g, 'não libera sinais de enable')
    .replace(/classified as functional/g, 'classificada como funcional')
    .replace(/valid/g, 'válido')
    .replace(/inactive/g, 'inativo')
    .replace(/low/g, 'baixo')
    .replace(/high/g, 'alto')
    .replace(/suspected/g, 'suspeito')
    .replace(/detected/g, 'detectado')
    .replace(/absent/g, 'ausente')
    .replace(/active/g, 'ativo')
    .replace(/rail/g, 'trilho'));
}

function translateMetricLabel(value: string): string {
  const labels: Record<string, string> = {
    'Detected Voltage': 'Tensão detectada',
    'Current Draw': 'Corrente',
    'Estimated Resistance': 'Resistência estimada',
    'Short Status': 'Status de curto',
  };

  return labels[value] ?? value;
}

function translateMetricValue(value: string): string {
  const values: Record<string, string> = {
    'No hard short': 'Sem curto',
    'Probable short': 'Curto provável',
  };

  return normalizeTechnicalText(values[value] ?? value);
}

function terminalLineText(value: string): string {
  const text = translateDiagnosticText(value).trim();

  if (/:\s*\d+%$/.test(text)) {
    return `${text}.`;
  }

  return text;
}

function logTime(index: number): string {
  const totalSeconds = 20 * 60 + 13 + index * 7;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `10:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function logTag(level: EngineLog['level']): string {
  const tags: Record<EngineLog['level'], string> = {
    AI: 'IA',
    FAIL: 'ALERTA',
    INFO: 'MEDIÇÃO',
    SCAN: 'MEDIÇÃO',
    TEST: 'TESTE',
    WARN: 'ALERTA',
  };

  return tags[level] ?? level;
}

function logTagClass(level: EngineLog['level']): string {
  const classes: Record<EngineLog['level'], string> = {
    AI: 'log-tag-ai',
    FAIL: 'log-tag-warn',
    INFO: 'log-tag-scan',
    SCAN: 'log-tag-scan',
    TEST: 'log-tag-test',
    WARN: 'log-tag-warn',
  };

  return classes[level] ?? 'log-tag-scan';
}

function Panel({ title, icon: Icon, className, children, hideTitlebar = false }: PanelProps) {
  return (
    <section className={`visual-panel ${className}`}>
      {!hideTitlebar && (
        <div className="panel-titlebar">
          <span>{title}</span>
          <Icon className="h-4 w-4" aria-hidden="true" />
          <i />
          <i />
          <i />
        </div>
      )}
      {children}
    </section>
  );
}

function CommandConnections() {
  return (
    <svg className="command-connections" viewBox="0 0 1600 1120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="wireCyan" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="0.38" stopColor="#22d3ee" stopOpacity="0.92" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="wireViolet" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a855f7" stopOpacity="0" />
          <stop offset="0.52" stopColor="#a855f7" stopOpacity="0.86" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.2" />
        </linearGradient>
        <filter id="wireGlow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="wireArrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
          <path d="M0,0 L8,4 L0,8 Z" fill="#22d3ee" opacity="0.8" />
        </marker>
      </defs>
      <path className="wire wire-strong" d="M800 570 V382" markerEnd="url(#wireArrow)" />
      <path className="wire wire-violet" d="M694 632 C528 576 438 456 360 342" />
      <path className="wire" d="M908 626 C1015 560 1168 426 1300 306" markerEnd="url(#wireArrow)" />
      <path className="wire wire-violet" d="M946 698 C1034 664 1176 660 1274 690" />
      <path className="wire" d="M662 704 C490 682 394 696 302 738" />
      <path className="wire wire-violet" d="M686 780 C500 842 426 888 292 900" />
      <path className="wire" d="M800 790 C798 866 724 910 696 936" markerEnd="url(#wireArrow)" />
      <path className="wire wire-violet" d="M916 776 C1014 826 1154 878 1320 914" />
      <path className="wire wire-soft" d="M662 596 H520 V440 H402" />
      <path className="wire wire-soft wire-violet" d="M938 594 H1082 V430 H1218" />
      <path className="wire wire-soft" d="M640 748 H456 V794 H310" />
      <path className="wire wire-soft wire-violet" d="M960 746 H1138 V798 H1310" />
      <path className="wire wire-trunk" d="M800 798 V1066" />
      <circle className="wire-node" cx="800" cy="570" r="5" />
      <circle className="wire-node" cx="800" cy="382" r="4" />
      <circle className="wire-node" cx="360" cy="342" r="4" />
      <circle className="wire-node" cx="1300" cy="306" r="4" />
      <circle className="wire-node" cx="1274" cy="690" r="4" />
      <circle className="wire-node" cx="302" cy="738" r="4" />
      <circle className="wire-node" cx="292" cy="900" r="4" />
      <circle className="wire-node" cx="696" cy="936" r="4" />
      <circle className="wire-node" cx="1320" cy="914" r="4" />
    </svg>
  );
}

function SystemMonitorPanel({ result }: { result: DiagnosticResult }) {
  return (
    <Panel className="monitor-panel" title="MONITOR DO SISTEMA" icon={Activity}>
      <div className="monitor-ring" style={ringStyle(result.healthPercentage)}>
        <strong>{result.healthPercentage}%</strong>
        <span>integridade</span>
      </div>

      <div className="monitor-line-chart" aria-hidden="true">
        <svg viewBox="0 0 260 86" preserveAspectRatio="none">
          <polyline
            className="chart-line chart-line-base"
            points="0,66 18,58 34,64 52,38 70,48 88,28 106,52 124,42 142,55 160,34 178,48 196,36 214,54 232,42 260,26"
          />
          <polyline
            className="chart-line chart-line-pulse"
            points="0,66 18,58 34,64 52,38 70,48 88,28 106,52 124,42 142,55 160,34 178,48 196,36 214,54 232,42 260,26"
          />
        </svg>
      </div>

      <div className="monitor-readouts">
        {result.monitorMetrics.slice(1, 5).map((metric, index) => (
          <p key={metric.label}>
            <span>{translateMetricLabel(metric.label)}</span>
            <strong>{translateMetricValue(metric.value)}</strong>
            <i style={fillStyle(92 - index * 15, index * 0.12)} />
          </p>
        ))}
      </div>
    </Panel>
  );
}

function ArchitecturePanel({ result, scenario }: { result: DiagnosticResult; scenario: DiagnosticScenario }) {
  const strongest = result.suspects[0]?.name ?? 'Classificador universal';

  return (
    <Panel className="architecture-panel" title="" icon={CircuitBoard} hideTitlebar>
      <div className="architecture-map">
        <ArchitectureConnections />

        <article className="arch-box arch-input">
          <Gauge className="h-6 w-6" aria-hidden="true" />
          <strong>Entrada de medições</strong>
          <span>{metricValue(result, 'Detected Voltage')} / {metricValue(result, 'Current Draw')}</span>
        </article>

        <article className="arch-box arch-engine">
          <BrainCircuit className="h-7 w-7" aria-hidden="true" />
          <strong>Motor de comportamento</strong>
          <span>{clip(translateDiagnosticText(strongest), 34)}</span>
        </article>

        <article className="arch-box arch-diagnostic">
          <GitBranch className="h-6 w-6" aria-hidden="true" />
          <strong>Diagnóstico probabilístico</strong>
          <span>{result.suspects.length} hipóteses ativas</span>
        </article>

        <article className="arch-box arch-cases">
          <Microscope className="h-5 w-5" aria-hidden="true" />
          <strong>Casos reais</strong>
          <span>{translateDiagnosticText(scenario.name)}</span>
        </article>

        <article className="arch-box arch-library">
          <Database className="h-5 w-5" aria-hidden="true" />
          <strong>Biblioteca universal</strong>
          <span>Buck, LDO, SPI, CPU</span>
        </article>

        <article className="arch-box arch-signatures">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <strong>Regras / assinaturas</strong>
          <span>6 padrões correlacionados</span>
        </article>

        <article className="arch-box arch-history">
          <Workflow className="h-5 w-5" aria-hidden="true" />
          <strong>Fluxo de dados / histórico</strong>
          <span>{result.logs.length} eventos processados</span>
        </article>
      </div>
    </Panel>
  );
}

function FlowDataPanel() {
  const steps: FlowStep[] = [
    { label: 'Técnico / Bancada', detail: 'entrada real', icon: Microscope },
    { label: 'Medições', detail: 'tensão, corrente, resistência', icon: Gauge },
    { label: 'Motor', detail: 'normalização e regras', icon: BrainCircuit },
    { label: 'Hipóteses', detail: 'probabilidade técnica', icon: GitBranch },
    { label: 'Evidências', detail: 'sinais consolidados', icon: ShieldCheck },
  ];

  return (
    <Panel className="flow-panel" title="FLUXO DE DIAGNÓSTICO" icon={Workflow}>
      <div className="flow-pipeline">
        <div className="flow-pipeline-inner">
          <DiagnosticFlowConnections />
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div className="flow-step" key={step.label}>
                <span className="flow-port flow-port-top" aria-hidden="true" />
                <span className="flow-port flow-port-bottom" aria-hidden="true" />
                <div>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function NitroCorePanel({ result }: { result: DiagnosticResult }) {
  const confidence = averageConfidence(result);

  return (
    <div className="nitro-core-panel" aria-label="Núcleo Nitro">
      <motion.div
        className="nitro-core-stage"
        initial={{ opacity: 0, y: 34, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.72, ease: 'easeOut', delay: 0.12 }}
      >
        <div className="core-halo" aria-hidden="true" />
        <div className="core-grid-lines" aria-hidden="true" />
        <img className="chip-reference-image" src={nitroCoreImage} alt="" aria-hidden="true" />
        <svg className="core-circuit-overlay" viewBox="0 0 620 520" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="coreTraceCyan" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="0.34" stopColor="#22d3ee" stopOpacity="0.86" />
              <stop offset="1" stopColor="#a855f7" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="coreTraceViolet" x1="1" x2="0" y1="0" y2="0">
              <stop offset="0" stopColor="#a855f7" stopOpacity="0" />
              <stop offset="0.42" stopColor="#a855f7" stopOpacity="0.64" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <path className="core-trace core-trace-left" d="M34 206 H128 V238 H234" />
          <path className="core-trace core-trace-right" d="M586 206 H492 V238 H386" />
          <path className="core-trace core-trace-left core-trace-low" d="M58 330 H168 V300 H244" />
          <path className="core-trace core-trace-right core-trace-low" d="M562 330 H452 V300 H376" />
          <path className="core-wave core-wave-left" d="M28 270 C78 242 116 298 166 270 S244 242 292 270" />
          <path className="core-wave core-wave-right" d="M592 270 C542 242 504 298 454 270 S376 242 328 270" />
          <circle className="core-trace-node" cx="234" cy="238" r="4" />
          <circle className="core-trace-node" cx="386" cy="238" r="4" />
          <circle className="core-trace-node" cx="244" cy="300" r="3.5" />
          <circle className="core-trace-node" cx="376" cy="300" r="3.5" />
        </svg>
        <div className="core-static-rails" aria-hidden="true">
          <span className="rail rail-left" />
          <span className="rail rail-right" />
          <span className="rail rail-up" />
          <span className="rail rail-down" />
          <span className="rail rail-left-low" />
          <span className="rail rail-right-low" />
        </div>
        <div className="core-energy-links" aria-hidden="true">
          <span className="core-link core-link-up" />
          <span className="core-link core-link-left" />
          <span className="core-link core-link-right" />
        </div>
        <div className="core-identity">
          <BrainCircuit className="h-7 w-7" aria-hidden="true" />
          <strong>NÚCLEO NITRO</strong>
          <small>Núcleo de comportamento</small>
        </div>
        <div className="core-microstats">
          <span>{confidence}% confiança</span>
          <span>{result.logs.length} eventos</span>
        </div>
      </motion.div>
    </div>
  );
}

function EvidencePanel({ result }: { result: DiagnosticResult }) {
  const terminalLines = [
    ...(result.conclusions.length > 0 ? result.conclusions : [result.summary]),
    ...result.suspects.map((suspect) => `${suspect.name}: ${suspect.probability}%`),
    ...result.evidence.map((evidence) => evidence.detail),
  ].map(terminalLineText);

  return (
    <Panel className="evidence-panel" title="EVIDÊNCIAS TÉCNICAS" icon={SquareTerminal}>
      <div className="terminal-output">
        {terminalLines.map((line, index) => (
          <p key={`${line}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <code>{line}</code>
          </p>
        ))}
      </div>
    </Panel>
  );
}

function KnowledgePanel() {
  const signatures = [
    ['Conversor Buck', 'POTÊNCIA', 'ativa'],
    ['LDO', 'REG', 'ativa'],
    ['Memória Flash SPI', 'DADOS', 'observada'],
    ['Inicialização da CPU', 'BOOT', 'ativa'],
    ['Curto-circuito', 'CURTO', 'indexada'],
    ['Clock/Reset', 'LÓGICA', 'ativa'],
  ];

  return (
    <Panel className="knowledge-panel" title="BIBLIOTECA UNIVERSAL" icon={BookOpen}>
      <div className="signature-table">
        {signatures.map(([name, type, state]) => (
          <p key={name}>
            <span>{name}</span>
            <strong>{type}</strong>
            <em>{state}</em>
          </p>
        ))}
      </div>
    </Panel>
  );
}

function InvestigationPanel({ result }: { result: DiagnosticResult }) {
  const fallbackTests = [
    'Confirmar VIN',
    'Verificar enable',
    'Medir VOUT',
    'Conferir clock',
    'Revisar reset',
    'Testar firmware SPI',
  ];
  const tests = (result.nextTests.length > 0 ? result.nextTests : fallbackTests).map(translateActionText);

  return (
    <Panel className="investigation-panel" title="PLANO DE INVESTIGAÇÃO" icon={ClipboardCheck}>
      <div className="investigation-list">
        {tests.map((test, index) => (
          <p className={statusClass(index)} key={`${test}-${index}`}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{test}</span>
            <strong>{statusFromIndex(index)}</strong>
          </p>
        ))}
      </div>
    </Panel>
  );
}

function AnalyticsPanel({ result, scenarios }: { result: DiagnosticResult; scenarios: DiagnosticScenario[] }) {
  const confidence = averageConfidence(result);
  const analytics = [
    { label: 'Casos repetidos', value: scenarios.length, fill: 58 },
    { label: 'Assinaturas definitivas', value: 6, fill: 78 },
    { label: 'Eventos detectados', value: result.logs.length, fill: 68 },
    { label: 'Confiança média', value: `${confidence}%`, fill: confidence },
  ];

  return (
    <Panel className="analytics-panel" title="ANÁLISE" icon={BarChart3}>
      <div className="analytics-cards">
        {analytics.map((item, index) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <i style={fillStyle(item.fill, index * 0.1)} />
          </div>
        ))}
      </div>
      <div className="analytics-line" aria-hidden="true">
        <svg viewBox="0 0 360 116" preserveAspectRatio="none">
          <polyline
            className="chart-line chart-line-base"
            points="0,86 36,70 72,82 108,50 144,62 180,44 216,54 252,32 288,42 324,26 360,18"
          />
          <polyline
            className="chart-line chart-line-pulse chart-line-pulse-soft"
            points="0,86 36,70 72,82 108,50 144,62 180,44 216,54 252,32 288,42 324,26 360,18"
          />
        </svg>
      </div>
      <div className="analytics-bottom">
        <div className="analytics-donut" style={ringStyle(confidence)}>
          <strong>{confidence}%</strong>
        </div>
        <p>
          <span>Diagnósticos gerados</span>
          <strong>{result.suspects.length}</strong>
        </p>
        <p>
          <span>Saúde operacional</span>
          <strong>{result.healthPercentage}%</strong>
        </p>
      </div>
    </Panel>
  );
}

function LogsPanel({ logs }: { logs: EngineLog[] }) {
  return (
    <Panel className="logs-panel" title="REGISTROS AO VIVO" icon={ScrollText}>
      <div className="live-log-lines">
        {logs.map((log, index) => (
          <p key={`${log.level}-${log.message}-${index}`}>
            <time>{logTime(index)}</time>
            <strong className={logTagClass(log.level)}>{logTag(log.level)}</strong>
            <code>{translateLogMessage(log.message)}</code>
            <em>{log.level === 'WARN' || log.level === 'FAIL' ? '400' : '200'}</em>
          </p>
        ))}
      </div>
    </Panel>
  );
}

function BottomDock({ scenarios, selectedScenarioId, onSelect }: Pick<ArchitectureHeroProps, 'scenarios' | 'selectedScenarioId' | 'onSelect'>) {
  const dockItems = [
    { label: 'Diagnóstico', icon: BrainCircuit },
    { label: 'Biblioteca', icon: Layers3 },
    { label: 'Casos', icon: Microscope },
    { label: 'Relatórios', icon: FileText },
    { label: 'Aprendizado', icon: Sparkles },
    { label: 'Monitoramento', icon: Activity },
  ];

  return (
    <nav className="bottom-dock" aria-label="Módulos principais">
      {dockItems.map((item, index) => {
        const Icon = item.icon;
        const scenario = scenarios[index % scenarios.length];
        const isActive = scenario?.id === selectedScenarioId && item.label === 'Casos';

        return (
          <button
            className={isActive ? 'dock-active' : ''}
            key={item.label}
            type="button"
            onClick={() => {
              if (item.label === 'Casos' && scenario) {
                onSelect(scenario.id);
              }
            }}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function ArchitectureHero({
  scenario,
  result,
  scenarios,
  selectedScenarioId,
  onSelect,
}: ArchitectureHeroProps) {
  return (
    <motion.section
      className="command-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      <div className="hologrid" aria-hidden="true" />
      <div className="energy-halos" aria-hidden="true" />
      <div className="data-particles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} />
        ))}
      </div>

      <div className="command-canvas">
        <div className="command-brand">
          <CircuitBoard className="h-8 w-8" aria-hidden="true" />
          <div>
            <h1>NITRO SCAN</h1>
            <p>Plataforma Universal de Inteligência Comportamental</p>
          </div>
          <span>
            <RadioTower className="h-4 w-4" aria-hidden="true" />
            núcleo online
          </span>
        </div>

        <CommandConnections />
        <SystemMonitorPanel result={result} />
        <ArchitecturePanel result={result} scenario={scenario} />
        <FlowDataPanel />
        <NitroCorePanel result={result} />
        <EvidencePanel result={result} />
        <KnowledgePanel />
        <InvestigationPanel result={result} />
        <AnalyticsPanel result={result} scenarios={scenarios} />
        <LogsPanel logs={result.logs} />
        <BottomDock scenarios={scenarios} selectedScenarioId={selectedScenarioId} onSelect={onSelect} />
      </div>
    </motion.section>
  );
}
