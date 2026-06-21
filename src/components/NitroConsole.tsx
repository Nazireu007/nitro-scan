import { useMemo, useState } from 'react';
import {
  analyzeConsoleInput,
  analyzeHardwareConsoleFrame,
  consoleTestModeOptions,
  consoleInputFromHardwareFrame,
  createDefaultConsoleInput,
  loadLgConsoleCase,
  type ConsoleAnalysis,
  type ConsoleScanInput,
} from '../engine/consoleAdapter';
import { createHardwareConnectionManager } from '../hardware/hardwareConnectionManager';
import { simulateHardwareScenario, type HardwareSimulationScenario } from '../hardware/hardwareSimulator';
import { createEmergencyStopCommand } from '../hardware/hardwareProtocol';
import { runOneClickBoardScan, type OneClickScanStep } from '../hardware/oneClickScanRunner';
import { detectPlatformCapabilities, directSerialGuidance } from '../hardware/platformCapabilities';
import type { HardwareScanMode } from '../hardware/hardwareTypes';
import { parseNumericValue } from '../utils/electrical';
import { EvidenceStrip } from './EvidenceStrip';
import { InvestigationStrip } from './InvestigationStrip';
import { LiveLogStrip } from './LiveLogStrip';
import { NitroCorePanel } from './NitroCorePanel';
import { NitroTopBar } from './NitroTopBar';
import { ScanControlPanel } from './ScanControlPanel';
import { ScanResultPanel } from './ScanResultPanel';
import { WaveScope } from './WaveScope';
import '../styles/nitro-console.css';

function lgCaseInput(): ConsoleScanInput {
  return {
    testMode: 'offline_scan',
    testOrigin: 'power_connector',
    node: 'PFC_PCTL / 12 V',
    response: '12 V após comando forçado',
    unit: 'estado',
    context: 'LG CJ87; placa desligada; sequência de boot/controle',
  };
}

function hardwareScanMode(input: ConsoleScanInput): HardwareScanMode {
  const modes: Record<ConsoleScanInput['testMode'], HardwareScanMode> = {
    offline_scan: 'one_point_scan',
    line_to_gnd: 'line_to_gnd',
    low_injection: 'low_injection',
    sine_wave: 'sine_response',
    connector_response: 'connector_response',
    component_test: 'component_check',
    confirmation: 'confirmation',
  };
  return modes[input.testMode];
}

function stepLabel(step: OneClickScanStep): string {
  const labels: Record<OneClickScanStep, string> = {
    idle: 'Aguardando início',
    ground_check: 'Verificando GND',
    pre_scan: 'Executando pré-scan',
    impedance_scan: 'Medindo impedância',
    low_injection: 'Executando injeção baixa',
    sine_response: 'Capturando resposta senoidal',
    response_analysis: 'Analisando resposta',
    component_correlation: 'Correlacionando componentes',
    confirmation_check: 'Verificando confirmação',
    completed: 'Scan da placa concluído',
    blocked: 'Scan bloqueado',
    emergency_stop: 'Parada de emergência',
  };
  return labels[step];
}

export function NitroConsole() {
  const [input, setInput] = useState<ConsoleScanInput>(lgCaseInput);
  const [analysis, setAnalysis] = useState<ConsoleAnalysis>(() => loadLgConsoleCase());
  const capabilities = useMemo(() => detectPlatformCapabilities(), []);
  const connectionManager = useMemo(() => createHardwareConnectionManager(), []);
  const [connectionState, setConnectionState] = useState(() => connectionManager.getState());
  const [usingSimulator, setUsingSimulator] = useState(capabilities.recommendedMode === 'simulator');
  const [simulationScenario, setSimulationScenario] = useState<HardwareSimulationScenario>('normal_line');
  const [scanRunning, setScanRunning] = useState(false);
  const [hardwareNotice, setHardwareNotice] = useState(
    capabilities.recommendedMode === 'serial'
      ? 'Aguardando conexão ou scan simulado.'
      : 'Modo simulador pronto para scan da placa.',
  );
  const modeLabel = useMemo(
    () => consoleTestModeOptions.find((option) => option.value === input.testMode)?.label ?? 'Scan offline',
    [input.testMode],
  );

  function commitAnalysis(nextAnalysis: ConsoleAnalysis) {
    setAnalysis(nextAnalysis);
  }

  function analyze() {
    commitAnalysis(analyzeConsoleInput(input));
  }

  function startNewAnalysis() {
    const cleanInput = createDefaultConsoleInput();
    setInput(cleanInput);
    commitAnalysis(analyzeConsoleInput(cleanInput));
  }

  function clearInput() {
    setInput(createDefaultConsoleInput());
  }

  function loadLgCase() {
    setInput(lgCaseInput());
    commitAnalysis(loadLgConsoleCase());
  }

  function simulateHardware(scenario: HardwareSimulationScenario) {
    const frame = simulateHardwareScenario(scenario);
    setInput(consoleInputFromHardwareFrame(frame));
    commitAnalysis(analyzeHardwareConsoleFrame(frame));
    setUsingSimulator(true);
    setSimulationScenario(scenario);
    setHardwareNotice('Frame simulado processado localmente pelo Nitro.');
  }

  async function toggleSerialConnection() {
    const connected = connectionState.status === 'connected' || connectionState.status === 'reading';
    setHardwareNotice(connected ? 'Encerrando conexão com Nitro Box...' : 'Aguardando seleção da porta serial...');
    const nextState = connected ? await connectionManager.disconnect() : await connectionManager.connect();
    setConnectionState(nextState);
    setUsingSimulator(false);
    setHardwareNotice(nextState.lastError ?? (nextState.status === 'connected' ? 'Nitro Box conectada via Web Serial.' : directSerialGuidance(capabilities)));
  }

  async function oneClickScan() {
    if (scanRunning) return;
    setScanRunning(true);
    const serialConnected = connectionState.status === 'connected' || connectionState.status === 'reading';

    try {
      const result = await runOneClickBoardScan({
        source: serialConnected ? 'serial' : 'simulator',
        scenario: simulationScenario,
        inputPoint: input.node.trim() || 'VIN',
        scanMode: hardwareScanMode(input),
        maxVoltage: parseNumericValue(input.injectionVoltage ?? null) ?? 0.5,
        limitCurrent: 0.05,
        frequency: parseNumericValue(input.signalFrequency ?? null) ?? 1000,
        onStep: (step) => setHardwareNotice(stepLabel(step)),
        sendCommand: (command) => connectionManager.sendCommand(command),
        readFrame: () => connectionManager.readFrame(),
      });

      if (result.finalFrame) {
        setInput(consoleInputFromHardwareFrame(result.finalFrame));
        const nextAnalysis = analyzeHardwareConsoleFrame(result.finalFrame);
        nextAnalysis.result.logs = [...nextAnalysis.result.logs, ...result.logs];
        if (result.step === 'completed' && nextAnalysis.result.hypotheses.some((item) => item.title === 'Resposta elétrica normal')) {
          nextAnalysis.headline = 'SCAN DA PLACA CONCLUÍDO — ENTRADA NORMAL';
        }
        commitAnalysis(nextAnalysis);
      }

      setUsingSimulator(!serialConnected);
      setConnectionState(connectionManager.getState());
      setHardwareNotice(result.step === 'completed' ? 'Scan da placa concluído.' : result.blockedReason ?? stepLabel(result.step));
    } catch (error) {
      setHardwareNotice(error instanceof Error ? error.message : 'Falha inesperada no protocolo One-Click Scan.');
    } finally {
      setScanRunning(false);
    }
  }

  async function emergencyStop() {
    const result = await connectionManager.sendCommand(createEmergencyStopCommand(input.node.trim() || 'VIN'));
    setHardwareNotice(result.sent ? 'Parada de emergência enviada à Nitro Box.' : result.message);
    setConnectionState(connectionManager.getState());
  }

  const serialConnected = connectionState.status === 'connected' || connectionState.status === 'reading';
  const serialSupported = connectionState.status !== 'unsupported';
  const hardwareStatus = serialConnected
    ? 'Nitro Box conectada'
    : capabilities.isMobile
      ? 'Modo mobile / simulação ativa'
      : usingSimulator
        ? 'Simulador'
        : serialSupported
          ? 'Serial disponível'
          : 'Serial indisponível neste navegador';

  return (
    <main className="nitro-console-app">
      <div className="nitro-console-grid" aria-hidden="true" />
      <div className="nitro-console-shell">
        <NitroTopBar onNewAnalysis={startNewAnalysis} />

        <div className="nitro-console-main">
          <section className="nitro-console-stage" aria-label="Núcleo, telemetria e diagnóstico">
            <div className="nitro-signal-stage">
              <WaveScope state={analysis.confirmationState} signalLabel={modeLabel} />
              <NitroCorePanel
                confidence={analysis.confidence}
                events={analysis.result.logs.length}
                health={analysis.result.healthScore}
                status={analysis.verdictStatus}
              />
            </div>
            <ScanResultPanel analysis={analysis} />
          </section>

          <ScanControlPanel
            input={input}
            onChange={setInput}
            onAnalyze={analyze}
            onClear={clearInput}
            onLoadCase={loadLgCase}
            onSimulateHardware={simulateHardware}
            hardwareStatus={hardwareStatus}
            hardwareNotice={hardwareNotice}
            serialGuidance={directSerialGuidance(capabilities)}
            serialSupported={serialSupported}
            serialConnected={serialConnected}
            scanRunning={scanRunning}
            onToggleSerial={toggleSerialConnection}
            onOneClickScan={oneClickScan}
            onEmergencyStop={emergencyStop}
          />
        </div>

        <div className="nitro-console-strips">
          <EvidenceStrip evidences={analysis.result.evidences} />
          <InvestigationStrip tests={analysis.result.nextTests} />
          <LiveLogStrip logs={analysis.result.logs} analyzedAt={analysis.analyzedAt} />
        </div>
      </div>
    </main>
  );
}
