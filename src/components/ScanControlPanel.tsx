import type { FormEvent } from 'react';
import { AlertTriangle, ChevronDown, CircuitBoard, ClipboardList, Eraser, Play, Power, PowerOff, Radio, ShieldCheck, SlidersHorizontal, Usb, Zap } from 'lucide-react';
import {
  consoleTestModeOptions,
  consoleTestOriginOptions,
  consoleUnitOptions,
  type ConsoleScanInput,
} from '../engine/consoleAdapter';
import type { MeasurementTestMode, MeasurementTestOrigin } from '../types/measurements';
import type { ComponentType } from '../types/components';
import { hardwareSimulationOptions, type HardwareSimulationScenario } from '../hardware/hardwareSimulator';
import { NitroSelect } from './NitroSelect';

type ScanControlPanelProps = {
  input: ConsoleScanInput;
  onChange: (input: ConsoleScanInput) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onLoadCase: () => void;
  onSimulateHardware: (scenario: HardwareSimulationScenario) => void;
  hardwareStatus: string;
  hardwareNotice: string;
  serialGuidance: string;
  serialSupported: boolean;
  serialConnected: boolean;
  scanRunning: boolean;
  onToggleSerial: () => void;
  onTestCommunication: () => void;
  onTestCutoffClose: () => void;
  onTestCutoffOpen: () => void;
  onOneClickScan: () => void;
  onEmergencyStop: () => void;
};

const attenuationOptions: Array<{ value: '' | 'baixa' | 'média' | 'alta'; label: string }> = [
  { value: '', label: 'Não informada' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'média', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

const componentTypeOptions: Array<{ value: ComponentType | ''; label: string }> = [
  { value: '', label: 'Não informado' },
  { value: 'mosfet', label: 'MOSFET' },
  { value: 'capacitor', label: 'Capacitor' },
  { value: 'diode', label: 'Diodo' },
  { value: 'inductor', label: 'Bobina/Indutor' },
  { value: 'ldo', label: 'LDO' },
  { value: 'resistor', label: 'Resistor' },
  { value: 'pwm_controller', label: 'Controlador PWM' },
  { value: 'buck_controller', label: 'Controlador Buck' },
  { value: 'spi_flash', label: 'SPI Flash' },
  { value: 'cpu', label: 'CPU' },
  { value: 'unknown_ic', label: 'CI não identificado' },
];

export function ScanControlPanel({
  input,
  onChange,
  onAnalyze,
  onClear,
  onLoadCase,
  onSimulateHardware,
  hardwareStatus,
  hardwareNotice,
  serialGuidance,
  serialSupported,
  serialConnected,
  scanRunning,
  onToggleSerial,
  onTestCommunication,
  onTestCutoffClose,
  onTestCutoffOpen,
  onOneClickScan,
  onEmergencyStop,
}: ScanControlPanelProps) {
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
        <section className="hardware-runtime-panel" aria-label="Conexão com Nitro Box" aria-live="polite">
          <div className="hardware-runtime-status">
            <i aria-hidden="true" />
            <span>Hardware: {hardwareStatus}</span>
          </div>
          <div className="hardware-runtime-actions">
            <button type="button" onClick={onOneClickScan} disabled={scanRunning}>
              <Zap aria-hidden="true" />
              {scanRunning ? 'SCAN EM ANDAMENTO' : 'INICIAR SCAN DA PLACA'}
            </button>
            <button className="hardware-emergency-button" type="button" onClick={onEmergencyStop}>
              <AlertTriangle aria-hidden="true" />
              Parada
            </button>
            <button type="button" onClick={onTestCommunication} disabled={!serialConnected}>
              <Radio aria-hidden="true" />
              Testar comunicação
            </button>
            <button type="button" onClick={onTestCutoffClose} disabled={!serialConnected}>
              <Power aria-hidden="true" />
              Testar Corte ON
            </button>
            <button type="button" onClick={onTestCutoffOpen} disabled={!serialConnected}>
              <PowerOff aria-hidden="true" />
              Testar Corte OFF
            </button>
            <button type="button" onClick={onToggleSerial} disabled={!serialSupported}>
              <Usb aria-hidden="true" />
              {serialSupported
                ? serialConnected ? 'Desconectar Nitro Box' : 'Conectar Nitro Box'
                : 'Conexão direta indisponível neste navegador'}
            </button>
          </div>
          <p>{hardwareNotice}</p>
          {!serialConnected && <small>{serialGuidance}</small>}
        </section>

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

        <label className="scan-full-field">
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

        <label className="scan-full-field">
          <span>Contexto</span>
          <input
            value={input.context}
            onChange={(event) => update('context', event.target.value)}
            placeholder="Ex.: pré-scan, injeção 0,5 V"
          />
        </label>

        <details className="technical-details-panel">
          <summary>
            <SlidersHorizontal aria-hidden="true" />
            <span>Detalhes técnicos</span>
            <ChevronDown className="technical-details-chevron" aria-hidden="true" />
          </summary>
          <div className="technical-details-grid">
            <label>
              <span>Tensão de injeção</span>
              <input value={input.injectionVoltage ?? ''} onChange={(event) => update('injectionVoltage', event.target.value)} placeholder="Ex.: 0,5 V" />
            </label>
            <label>
              <span>Corrente medida</span>
              <input value={input.measuredCurrent ?? ''} onChange={(event) => update('measuredCurrent', event.target.value)} placeholder="Ex.: 0,82 A" />
            </label>
            <label>
              <span>Frequência</span>
              <input value={input.signalFrequency ?? ''} onChange={(event) => update('signalFrequency', event.target.value)} placeholder="Ex.: 1 kHz" />
            </label>
            <label>
              <span>Retorno</span>
              <input value={input.returnAmplitude ?? ''} onChange={(event) => update('returnAmplitude', event.target.value)} placeholder="Ex.: 18%" />
            </label>
            <label>
              <span>Atenuação</span>
              <NitroSelect<'' | 'baixa' | 'média' | 'alta'>
                ariaLabel="Atenuação"
                value={(input.attenuation as '' | 'baixa' | 'média' | 'alta' | undefined) ?? ''}
                options={attenuationOptions}
                onChange={(value) => update('attenuation', value || undefined)}
              />
            </label>
            <label>
              <span>Componente</span>
              <input value={input.componentLabel ?? ''} onChange={(event) => update('componentLabel', event.target.value)} placeholder="Ex.: Q301, C412, L304" />
            </label>
            <label>
              <span>Tipo de componente</span>
              <NitroSelect<ComponentType | ''>
                ariaLabel="Tipo de componente"
                value={input.componentType ?? ''}
                options={componentTypeOptions}
                onChange={(value) => update('componentType', value || undefined)}
              />
            </label>
            <label>
              <span>Canal A</span>
              <input value={input.probeA ?? ''} onChange={(event) => update('probeA', event.target.value)} placeholder="Ex.: VIN" />
            </label>
            <label>
              <span>Canal B</span>
              <input value={input.probeB ?? ''} onChange={(event) => update('probeB', event.target.value)} placeholder="Ex.: retorno" />
            </label>
            <label>
              <span>Canal C</span>
              <input value={input.probeC ?? ''} onChange={(event) => update('probeC', event.target.value)} placeholder="Ex.: GND" />
            </label>
            <label className="technical-proof-field">
              <span>Prova de confirmação</span>
              <input value={input.confirmationProof ?? ''} onChange={(event) => update('confirmationProof', event.target.value)} placeholder="Ex.: linha normalizou após isolar componente" />
            </label>
          </div>
        </details>

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
