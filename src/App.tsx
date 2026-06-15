import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ArchitectureHero } from './components/ArchitectureHero';
import { ManualMeasurementPanel } from './components/ManualMeasurementPanel';
import { runDiagnosticScenario, runDiagnosticSession } from './engine/behaviorEngine';
import { defaultScenarioId, diagnosticScenarios } from './engine/diagnosticScenarios';
import type { DiagnosticSession } from './types/diagnostics';
import type { DiagnosticResult, DiagnosticScenario } from './engine/types';

function scenarioFromSession(session: DiagnosticSession): DiagnosticScenario {
  return {
    id: session.id,
    name: session.title,
    boardName: session.deviceCategory,
    description: session.symptoms[0] ?? 'Sessão manual de bancada',
    measurements: [],
    boardLines: [],
  };
}

// App module: presents the Nitro Scan radial system architecture powered by the behavior engine.
export default function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenarioId);
  const [isManualOpen, setIsManualOpen] = useState(() => new URLSearchParams(window.location.search).get('manual') === '1');
  const [manualResult, setManualResult] = useState<DiagnosticResult | null>(null);
  const [manualScenario, setManualScenario] = useState<DiagnosticScenario | null>(null);
  const selectedScenario =
    diagnosticScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? diagnosticScenarios[0];
  const diagnosticResult = useMemo(() => runDiagnosticScenario(selectedScenario), [selectedScenario]);
  const visibleResult = manualResult ?? diagnosticResult;
  const visibleScenario = manualScenario ?? selectedScenario;

  function selectScenario(scenarioId: string) {
    setManualResult(null);
    setManualScenario(null);
    setSelectedScenarioId(scenarioId);
  }

  function analyzeManualSession(session: DiagnosticSession) {
    setManualResult(runDiagnosticSession(session));
    setManualScenario(scenarioFromSession(session));
  }

  return (
    <main className="app-shell min-h-screen overflow-hidden p-3 text-slate-100 sm:p-4">
      <div className="pointer-events-none absolute inset-0 circuit-backdrop" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1540px]">
        <button
          className={`manual-mode-toggle${manualResult ? ' manual-mode-active' : ''}`}
          type="button"
          onClick={() => setIsManualOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>Modo Manual</span>
        </button>
        <ArchitectureHero
          scenario={visibleScenario}
          result={visibleResult}
          scenarios={diagnosticScenarios}
          selectedScenarioId={manualResult ? 'manual' : selectedScenarioId}
          onSelect={selectScenario}
        />
        <ManualMeasurementPanel
          isOpen={isManualOpen}
          onClose={() => setIsManualOpen(false)}
          onAnalyze={analyzeManualSession}
        />
      </div>
    </main>
  );
}
