import type { FormEvent } from 'react';
import { ChevronDown, CircuitBoard, ClipboardList, Eraser, Play, ShieldCheck } from 'lucide-react';
import {
  consoleTestModeOptions,
  consoleTestOriginOptions,
  consoleUnitOptions,
  type ConsoleScanInput,
} from '../engine/consoleAdapter';
import type { MeasurementTestMode, MeasurementTestOrigin } from '../types/measurements';
import { hardwareSimulationOptions, type HardwareSimulationScenario } from '../hardware/hardwareSimulator';
import { NitroSelect } from './NitroSelect';

type ScanControlPanelProps = {
  input: ConsoleScanInput;
  onChange: (input: ConsoleScanInput) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onLoadCase: () => void;
  onSimulateHardware: (scenario: HardwareSimulationScenario) => void;
};

export function ScanControlPanel({ input, onChange, onAnalyze, onClear, onLoadCase, onSimulateHardware }: ScanControlPanelProps) {
  const canAnalyze = input.node.trim().length > 0 || input.response.trim().length > 0;

  function update<K extends keyof ConsoleScanInput>(key: K, value: ConsoleScanInput[K]) {
    onChange({ ...input, [key]: value });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canAnalyze) onAnalyze();
  }

  return (
    <aside className="scan-control-panel" aria-label="Controle de scan offline">
      <header className="console-panel-heading">
        <div>
          <span>Operação</span>
          <h2>Scan offline</h2>
        </div>
        <span className="scan-safety-state">
          <ShieldCheck aria-hidden="true" />
          Placa desligada
        </span>
      </header>

      <form className="scan-control-form" onSubmit={submit}>
        <label>
          <span>Modo de teste</span>
          <NitroSelect<MeasurementTestMode>
            ariaLabel="Modo de teste"
            value={input.testMode}
            options={consoleTestModeOptions}
            onChange={(value) => update('testMode', value)}
          />
        </label>

        <label>
          <span>Origem do teste</span>
          <NitroSelect<MeasurementTestOrigin>
            ariaLabel="Origem do teste"
            value={input.testOrigin}
            options={consoleTestOriginOptions}
            onChange={(value) => update('testOrigin', value)}
          />
        </label>

        <label>
          <span>Nó/Ponto</span>
          <input
            value={input.node}
            onChange={(event) => update('node', event.target.value)}
            placeholder="Ex.: 12 V, VBUS, SPI_VCC"
          />
        </label>

        <div className="scan-response-row">
          <label>
            <span>Valor/Resposta</span>
            <input
              value={input.response}
              onChange={(event) => update('response', event.target.value)}
              placeholder="Ex.: 0,6 Ω, OL, retorno 20%"
            />
          </label>
          <label className="scan-unit-field">
            <span>Unidade</span>
            <NitroSelect
              ariaLabel="Unidade"
              value={input.unit}
              options={consoleUnitOptions}
              onChange={(value) => update('unit', value)}
            />
          </label>
        </div>

        <label>
          <span>Contexto</span>
          <input
            value={input.context}
            onChange={(event) => update('context', event.target.value)}
            placeholder="Ex.: pré-scan, injeção 0,5 V"
          />
        </label>

        <button className="nitro-button nitro-button-primary scan-analyze-button" type="submit" disabled={!canAnalyze}>
          <Play aria-hidden="true" />
          Analisar com Nitro
        </button>

        <div className="scan-secondary-actions">
          <button className="nitro-button nitro-button-quiet" type="button" onClick={onClear}>
            <Eraser aria-hidden="true" />
            Limpar
          </button>
          <button className="nitro-button nitro-button-quiet" type="button" onClick={onLoadCase}>
            <ClipboardList aria-hidden="true" />
            Caso LG CJ87
          </button>
        </div>

        <details className="hardware-simulator-panel">
          <summary>
            <CircuitBoard aria-hidden="true" />
            <span>Simular hardware</span>
            <ChevronDown className="hardware-simulator-chevron" aria-hidden="true" />
          </summary>
          <div className="hardware-simulator-actions">
            {hardwareSimulationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSimulateHardware(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </details>
      </form>
    </aside>
  );
}
