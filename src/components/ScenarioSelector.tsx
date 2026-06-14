import { motion } from 'framer-motion';
import { CircuitBoard, ScanSearch } from 'lucide-react';
import type { DiagnosticScenario } from '../engine/types';

type ScenarioSelectorProps = {
  scenarios: DiagnosticScenario[];
  selectedScenarioId: string;
  onSelect: (scenarioId: string) => void;
};

// ScenarioSelector module: switches the mock diagnostic input feeding the behavior engine.
export function ScenarioSelector({ scenarios, selectedScenarioId, onSelect }: ScenarioSelectorProps) {
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0];

  return (
    <motion.section
      className="panel-glass scenario-selector p-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="icon-shell">
            <ScanSearch className="h-5 w-5 text-ion" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Nitro Behavior Engine</p>
            <h2 className="panel-title">{selectedScenario.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{selectedScenario.description}</p>
          </div>
        </div>

        <div className="scenario-buttons" role="list" aria-label="Diagnostic scenarios">
          {scenarios.map((scenario) => {
            const active = scenario.id === selectedScenarioId;

            return (
              <button
                className={`scenario-button ${active ? 'scenario-button-active' : ''}`}
                key={scenario.id}
                type="button"
                onClick={() => onSelect(scenario.id)}
              >
                <CircuitBoard className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{scenario.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
