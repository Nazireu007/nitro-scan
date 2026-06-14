import { useMemo, useState } from 'react';
import { ArchitectureHero } from './components/ArchitectureHero';
import { runDiagnosticScenario } from './engine/behaviorEngine';
import { defaultScenarioId, diagnosticScenarios } from './engine/diagnosticScenarios';

// App module: presents the Nitro Scan radial system architecture powered by the mock engine.
export default function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenarioId);
  const selectedScenario =
    diagnosticScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? diagnosticScenarios[0];
  const diagnosticResult = useMemo(() => runDiagnosticScenario(selectedScenario), [selectedScenario]);

  return (
    <main className="app-shell min-h-screen overflow-hidden p-3 text-slate-100 sm:p-4">
      <div className="pointer-events-none absolute inset-0 circuit-backdrop" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1540px]">
        <ArchitectureHero
          scenario={selectedScenario}
          result={diagnosticResult}
          scenarios={diagnosticScenarios}
          selectedScenarioId={selectedScenarioId}
          onSelect={setSelectedScenarioId}
        />
      </div>
    </main>
  );
}
