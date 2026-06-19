import { useMemo, useState } from 'react';
import {
  analyzeConsoleInput,
  consoleTestModeOptions,
  createDefaultConsoleInput,
  loadLgConsoleCase,
  type ConsoleAnalysis,
  type ConsoleScanInput,
} from '../engine/consoleAdapter';
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

export function NitroConsole() {
  const [input, setInput] = useState<ConsoleScanInput>(lgCaseInput);
  const [analysis, setAnalysis] = useState<ConsoleAnalysis>(() => loadLgConsoleCase());
  const [activityKey, setActivityKey] = useState(1);
  const modeLabel = useMemo(
    () => consoleTestModeOptions.find((option) => option.value === input.testMode)?.label ?? 'Scan offline',
    [input.testMode],
  );

  function commitAnalysis(nextAnalysis: ConsoleAnalysis) {
    setAnalysis(nextAnalysis);
    setActivityKey((current) => current + 1);
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

  return (
    <main className="nitro-console-app">
      <div className="nitro-console-grid" aria-hidden="true" />
      <div className="nitro-console-shell">
        <NitroTopBar onNewAnalysis={startNewAnalysis} />

        <div className="nitro-console-main">
          <section className="nitro-console-stage" aria-label="Núcleo, telemetria e diagnóstico">
            <div className="nitro-signal-stage">
              <WaveScope state={analysis.confirmationState} signalLabel={modeLabel} activityKey={activityKey} />
              <NitroCorePanel
                confidence={analysis.confidence}
                events={analysis.result.logs.length}
                health={analysis.result.healthScore}
                state={analysis.confirmationState}
                activityKey={activityKey}
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

