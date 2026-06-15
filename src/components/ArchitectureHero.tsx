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
};

type FlowStep = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

const nitroCoreImage = `${import.meta.env.BASE_URL}nitro-core-chip.webp`;

function metricValue(result: DiagnosticResult, label: string): string {
  return result.monitorMetrics.find((metric) => metric.label === label)?.value ?? 'n/a';
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
  return ['em analise', 'pendente', 'concluido'][index % 3];
}

function statusClass(index: number): string {
  return ['state-active', 'state-pending', 'state-done'][index % 3];
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
      'As linhas de 3,3V e 1,2V estão presentes, mas a CPU permanece fria e o PFC_PCTL não é liberado.',
    '12V is absent at first, then rises when PFC_PCTL is forced. The power stage can generate the rail.':
      'O 12V está ausente inicialmente, mas aparece quando o PFC_PCTL é forçado. O estágio de potência consegue gerar o trilho.',
    'Clock/reset chain requires direct probing.':
      'A cadeia de clock/reset exige medição direta.',
    'Secondary rails are blocked by missing command':
      'Trilhos secundários bloqueados por comando ausente.',
    'A missing clock or stuck reset can prevent the CPU from executing firmware.':
      'Clock ausente ou reset travado pode impedir a CPU de executar o firmware.',
    'Insufficient evidence for a high-confidence classification.':
      'Evidência insuficiente para uma classificação de alta confiança.',
    'The captured measurements match a known diagnostic pattern.':
      'As medições capturadas correspondem a um padrão de diagnóstico conhecido.',
    'Shorted Rail': 'Trilho em curto',
    'Firmware SPI': 'Firmware SPI',
    'Boot/Control Logic': 'Lógica de boot/controle',
    'CPU Boot Failure': 'Falha de inicialização da CPU',
  };
  const translated = exactTranslations[value];

  if (translated) {
    return translated;
  }

  return value
    .replace(/Shorted Rail/g, 'Trilho em curto')
    .replace(/Firmware SPI/g, 'Firmware SPI')
    .replace(/Boot\/Control Logic/g, 'Lógica de boot/controle')
    .replace(/CPU Boot Failure/g, 'Falha de inicialização da CPU')
    .replace(/Power supply/g, 'Fonte de alimentação')
    .replace(/main board/g, 'placa principal')
    .replace(/Main board/g, 'A placa principal')
    .replace(/boot\/control sequence/g, 'sequência de boot/controle')
    .replace(/not initializing/g, 'não está inicializando')
    .replace(/is the strongest match/g, 'é a hipótese mais forte')
    .replace(/is the primary suspect/g, 'é o principal suspeito')
    .replace(/suspected/g, 'suspeito')
    .replace(/detected/g, 'detectado')
    .replace(/absent/g, 'ausente')
    .replace(/present/g, 'presente')
    .replace(/valid/g, 'válido')
    .replace(/missing/g, 'ausente')
    .replace(/current/g, 'corrente')
    .replace(/voltage/g, 'tensão')
    .replace(/resistance/g, 'resistência')
    .replace(/rail/g, 'trilho')
    .replace(/CPU remains cold/g, 'CPU permanece fria')
    .replace(/low-resistance or current-collapse criteria/g, 'critérios de baixa resistência ou colapso por corrente');
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

  return values[value] ?? value;
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
    FAIL: 'AVISAR',
    INFO: 'DIGITALIZAR',
    SCAN: 'DIGITALIZAR',
    TEST: 'TESTE',
    WARN: 'AVISAR',
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

function Panel({ title, icon: Icon, className, children }: PanelProps) {
  return (
    <section className={`visual-panel ${className}`}>
      <div className="panel-titlebar">
        <span>{title}</span>
        <Icon className="h-4 w-4" aria-hidden="true" />
        <i />
        <i />
        <i />
      </div>
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
          <polyline points="0,66 18,58 34,64 52,38 70,48 88,28 106,52 124,42 142,55 160,34 178,48 196,36 214,54 232,42 260,26" />
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
    <Panel className="architecture-panel" title="ARQUITETURA OPERACIONAL DO NITRO" icon={CircuitBoard}>
      <div className="architecture-map">
        <svg className="architecture-wires" viewBox="0 0 720 310" preserveAspectRatio="none" aria-hidden="true">
          <path d="M94 78 H278" />
          <path d="M360 78 H536" />
          <path d="M566 120 V208 H466" />
          <path d="M156 120 V208 H276" />
          <path d="M360 126 V186" />
          <path d="M360 238 V294" />
          <path d="M156 256 H566" />
        </svg>

        <article className="arch-box arch-input">
          <Gauge className="h-6 w-6" aria-hidden="true" />
          <strong>Entrada de medições</strong>
          <span>{metricValue(result, 'Detected Voltage')} / {metricValue(result, 'Current Draw')}</span>
        </article>

        <article className="arch-box arch-engine">
          <BrainCircuit className="h-7 w-7" aria-hidden="true" />
          <strong>Motor de comportamento</strong>
          <span>{clip(strongest, 34)}</span>
        </article>

        <article className="arch-box arch-diagnostic">
          <GitBranch className="h-6 w-6" aria-hidden="true" />
          <strong>Diagnóstico probabilístico</strong>
          <span>{result.suspects.length} hipóteses ativas</span>
        </article>

        <article className="arch-box arch-cases">
          <Microscope className="h-5 w-5" aria-hidden="true" />
          <strong>Casos reais</strong>
          <span>{scenario.name}</span>
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
    { label: 'Engine', detail: 'normalização e regras', icon: BrainCircuit },
    { label: 'Hipóteses', detail: 'probabilidade técnica', icon: GitBranch },
    { label: 'Evidências', detail: 'sinais consolidados', icon: ShieldCheck },
  ];

  return (
    <Panel className="flow-panel" title="FLUXO DE DIAGNÓSTICO" icon={Workflow}>
      <div className="flow-pipeline">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <div className="flow-step" key={step.label}>
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
        <div className="core-static-rails" aria-hidden="true">
          <span className="rail rail-left" />
          <span className="rail rail-right" />
          <span className="rail rail-up" />
          <span className="rail rail-down" />
          <span className="rail rail-left-low" />
          <span className="rail rail-right-low" />
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
  ].map(translateDiagnosticText);

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
    ['Buck Converter', 'POWER', 'ativa'],
    ['LDO', 'REG', 'ativa'],
    ['SPI Flash', 'DATA', 'observada'],
    ['Inicialização CPU', 'BOOT', 'ativa'],
    ['Curto-circuito', 'SHORT', 'indexada'],
    ['Clock / Reset', 'LOGIC', 'ativa'],
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
  const tests = result.nextTests.length > 0 ? result.nextTests : fallbackTests;

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
          <polyline points="0,86 36,70 72,82 108,50 144,62 180,44 216,54 252,32 288,42 324,26 360,18" />
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
            <code>{log.message}</code>
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
            <p>Universal Behavior Intelligence Platform</p>
          </div>
          <span>
            <RadioTower className="h-4 w-4" aria-hidden="true" />
            core online
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
