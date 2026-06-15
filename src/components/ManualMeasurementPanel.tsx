import { ClipboardList, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { lgCj87DiagnosticCase } from '../data/diagnosticCases';
import type { DiagnosticSession } from '../types/diagnostics';
import type { MeasurementInput, MeasurementType } from '../types/measurements';

type ManualMeasurementPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (session: DiagnosticSession) => void;
};

type MeasurementForm = {
  label: string;
  type: MeasurementType;
  value: string;
  unit: string;
  node: string;
  component: string;
  context: string;
};

type MeasurementPreset = {
  title: string;
  measurement: Omit<MeasurementInput, 'id' | 'timestamp'>;
};

const typeOptions: Array<{ value: MeasurementType; label: string }> = [
  { value: 'voltage', label: 'Tensão' },
  { value: 'current', label: 'Corrente' },
  { value: 'resistance', label: 'Resistência' },
  { value: 'signal', label: 'Sinal lógico' },
  { value: 'temperature', label: 'Temperatura' },
  { value: 'state', label: 'Estado' },
];

const typeLabels: Record<MeasurementType, string> = {
  voltage: 'Tensão',
  current: 'Corrente',
  resistance: 'Resistência',
  signal: 'Sinal lógico',
  temperature: 'Temperatura',
  state: 'Estado',
};

const unitByType: Record<MeasurementType, string> = {
  voltage: 'V',
  current: 'A',
  resistance: 'Ω',
  signal: 'lógico',
  temperature: '°C',
  state: 'estado',
};

const unitOptions = ['V', 'A', 'Ω', '°C', 'lógico', 'estado'];

const initialForm: MeasurementForm = {
  label: '',
  type: 'voltage',
  value: '',
  unit: 'V',
  node: '',
  component: '',
  context: '',
};

const presets: MeasurementPreset[] = [
  {
    title: '5 V presente',
    measurement: {
      label: '5 V standby',
      type: 'voltage',
      value: '5 V',
      unit: 'V',
      node: '5V_STBY',
      component: 'Fonte/Principal',
      context: 'standby presente',
    },
  },
  {
    title: '12 V ausente',
    measurement: {
      label: 'Trilho de 12 V inicial',
      type: 'voltage',
      value: '0 V',
      unit: 'V',
      node: '12V',
      component: 'Fonte/Principal',
      context: 'power on ausente',
    },
  },
  {
    title: '14 V presente',
    measurement: {
      label: '14 V entrada',
      type: 'voltage',
      value: '14 V',
      unit: 'V',
      node: '14V',
      component: 'Fonte/Principal',
      context: 'entrada presente',
    },
  },
  {
    title: '3,3 V presente',
    measurement: {
      label: 'Linha lógica de 3,3 V',
      type: 'voltage',
      value: '3,3 V',
      unit: 'V',
      node: '3V3',
      component: 'Placa principal',
      context: 'linha presente',
    },
  },
  {
    title: '1,2 V presente',
    measurement: {
      label: 'Linha principal de 1,2 V',
      type: 'voltage',
      value: '1,2 V',
      unit: 'V',
      node: '1V2',
      component: 'CPU',
      context: 'linha presente',
    },
  },
  {
    title: 'SPI VCC presente',
    measurement: {
      label: 'SPI VCC',
      type: 'voltage',
      value: '3,3 V',
      unit: 'V',
      node: 'SPI_VCC',
      component: 'SPI Flash',
      context: 'alimentação SPI presente',
    },
  },
  {
    title: 'RESET ausente',
    measurement: {
      label: 'RESET da CPU',
      type: 'signal',
      value: 'ausente',
      unit: 'lógico',
      node: 'RESET',
      component: 'CPU',
      context: 'power on',
    },
  },
  {
    title: 'CLOCK ausente',
    measurement: {
      label: 'CLOCK da CPU',
      type: 'signal',
      value: 'ausente',
      unit: 'lógico',
      node: 'CLOCK',
      component: 'CPU',
      context: 'power on',
    },
  },
  {
    title: 'ENABLE ausente',
    measurement: {
      label: 'Buck ENABLE',
      type: 'signal',
      value: 'ausente',
      unit: 'lógico',
      node: 'ENABLE',
      component: 'PWM',
      context: 'power on',
    },
  },
  {
    title: 'PFC_PCTL ausente',
    measurement: {
      label: 'Comando PFC_PCTL',
      type: 'signal',
      value: 'ausente',
      unit: 'lógico',
      node: 'PFC_PCTL',
      component: 'Placa principal',
      context: 'sequência normal',
    },
  },
  {
    title: 'PFC_PCTL forçado',
    measurement: {
      label: 'Trilho de 12 V com PFC_PCTL forçado',
      type: 'voltage',
      value: '12 V',
      unit: 'V',
      node: '12V',
      component: 'Fonte/Principal',
      context: 'PFC_PCTL forçado',
    },
  },
  {
    title: 'resistência baixa',
    measurement: {
      label: 'Resistência 12 V para GND',
      type: 'resistance',
      value: '0,6 ohm',
      unit: 'Ω',
      node: '12V para GND',
      component: 'Linha 12V',
      context: 'placa desligada',
    },
  },
  {
    title: 'corrente alta em injeção',
    measurement: {
      label: 'Corrente em injeção no trilho',
      type: 'current',
      value: '2,4 A',
      unit: 'A',
      node: '12V',
      component: 'Linha 12V',
      context: 'injeção com corrente alta',
    },
  },
];

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function createMeasurement(
  measurement: Omit<MeasurementInput, 'id' | 'timestamp'>,
  index: number,
): MeasurementInput {
  const base = slug(`${measurement.node ?? measurement.label}-${measurement.context ?? ''}`) || 'medicao';

  return {
    ...measurement,
    id: `manual-${base}-${Date.now()}-${index}`,
    timestamp: new Date().toISOString(),
  };
}

function buildSession(measurements: MeasurementInput[]): DiagnosticSession {
  return {
    id: `manual-session-${Date.now()}`,
    title: 'Sessão manual de bancada',
    deviceCategory: 'Entrada manual',
    symptoms: measurements.length > 0
      ? measurements.map((measurement) => `${measurement.node ?? measurement.label}: ${measurement.value}`)
      : ['medições insuficientes'],
    measurements,
    selectedCase: 'manual',
    createdAt: new Date().toISOString(),
  };
}

function displayValue(measurement: MeasurementInput): string {
  const value = String(measurement.value ?? 'n/d').trim();

  if (!measurement.unit || value.toLowerCase().includes(String(measurement.unit).toLowerCase())) {
    return value;
  }

  return `${value} ${measurement.unit}`;
}

export function ManualMeasurementPanel({ isOpen, onClose, onAnalyze }: ManualMeasurementPanelProps) {
  const [form, setForm] = useState<MeasurementForm>(initialForm);
  const [measurements, setMeasurements] = useState<MeasurementInput[]>([]);
  const canAdd = form.value.trim().length > 0 || form.node.trim().length > 0;
  const countLabel = useMemo(
    () => `${measurements.length} ${measurements.length === 1 ? 'medição' : 'medições'}`,
    [measurements.length],
  );

  if (!isOpen) {
    return null;
  }

  function updateForm<K extends keyof MeasurementForm>(key: K, value: MeasurementForm[K]) {
    setForm((current) => {
      if (key === 'type') {
        return { ...current, type: value as MeasurementType, unit: unitByType[value as MeasurementType] };
      }

      return { ...current, [key]: value };
    });
  }

  function addMeasurement() {
    if (!canAdd) {
      return;
    }

    const label = form.label.trim() || `${typeLabels[form.type]} ${form.node.trim() || form.value.trim()}`;
    const measurement = createMeasurement(
      {
        label,
        type: form.type,
        value: form.value.trim() || 'n/d',
        unit: form.unit,
        node: form.node.trim(),
        component: form.component.trim(),
        context: form.context.trim(),
      },
      measurements.length,
    );

    setMeasurements((current) => [...current, measurement]);
    setForm((current) => ({
      ...initialForm,
      type: current.type,
      unit: current.unit,
      component: current.component,
      context: current.context,
    }));
  }

  function addPreset(preset: MeasurementPreset) {
    setMeasurements((current) => [...current, createMeasurement(preset.measurement, current.length)]);
  }

  function removeMeasurement(id: string) {
    setMeasurements((current) => current.filter((measurement) => measurement.id !== id));
  }

  function analyzeMeasurements() {
    onAnalyze(buildSession(measurements));
  }

  function loadLgCase() {
    setMeasurements(lgCj87DiagnosticCase.measurements);
    onAnalyze(lgCj87DiagnosticCase);
  }

  return (
    <div className="manual-panel-backdrop" role="presentation">
      <aside className="manual-panel" aria-label="Modo Manual">
        <header className="manual-panel-header">
          <div>
            <span>Modo Manual</span>
            <strong>Entrada de medições</strong>
          </div>
          <button type="button" aria-label="Fechar modo manual" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="manual-panel-body">
          <section className="manual-form-grid" aria-label="Cadastrar medição manual">
            <label>
              <span>Nome da medição</span>
              <input
                value={form.label}
                onChange={(event) => updateForm('label', event.target.value)}
                placeholder="Ex.: Trilho de 12 V"
              />
            </label>

            <label>
              <span>Tipo</span>
              <select value={form.type} onChange={(event) => updateForm('type', event.target.value as MeasurementType)}>
                {typeOptions.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Valor</span>
              <input
                value={form.value}
                onChange={(event) => updateForm('value', event.target.value)}
                placeholder="5,1 V / ausente / OL"
              />
            </label>

            <label>
              <span>Unidade</span>
              <select value={form.unit} onChange={(event) => updateForm('unit', event.target.value)}>
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Nó/Ponto medido</span>
              <input
                value={form.node}
                onChange={(event) => updateForm('node', event.target.value)}
                placeholder="12V, SPI_VCC, RESET"
              />
            </label>

            <label>
              <span>Componente relacionado</span>
              <input
                value={form.component}
                onChange={(event) => updateForm('component', event.target.value)}
                placeholder="L304, CPU, PWM"
              />
            </label>

            <label className="manual-form-wide">
              <span>Contexto</span>
              <input
                value={form.context}
                onChange={(event) => updateForm('context', event.target.value)}
                placeholder="standby, power on, comando forçado, injeção"
              />
            </label>
          </section>

          <div className="manual-action-row">
            <button type="button" onClick={addMeasurement} disabled={!canAdd}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar medição
            </button>
            <button type="button" onClick={() => setMeasurements([])}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Limpar medições
            </button>
          </div>

          <section className="manual-presets" aria-label="Presets rápidos de medições">
            <div>
              <span>Presets rápidos</span>
              <strong>{countLabel}</strong>
            </div>
            <div className="manual-preset-grid">
              {presets.map((preset) => (
                <button key={preset.title} type="button" onClick={() => addPreset(preset)}>
                  {preset.title}
                </button>
              ))}
            </div>
          </section>

          <section className="manual-measurement-list" aria-label="Medições inseridas">
            {measurements.length === 0 ? (
              <p className="manual-empty-state">Nenhuma medição inserida.</p>
            ) : (
              measurements.map((measurement) => (
                <article key={measurement.id}>
                  <div>
                    <strong>{typeLabels[measurement.type]}</strong>
                    <span>{measurement.node || measurement.label}</span>
                  </div>
                  <p>
                    <b>{displayValue(measurement)}</b>
                    <span>{measurement.component || 'sem componente'}</span>
                    <em>{measurement.context || 'sem contexto'}</em>
                  </p>
                  <button type="button" aria-label={`Remover ${measurement.label}`} onClick={() => removeMeasurement(measurement.id)}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </article>
              ))
            )}
          </section>
        </div>

        <footer className="manual-panel-footer">
          <button type="button" onClick={loadLgCase}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Carregar caso LG CJ87
          </button>
          <button type="button" onClick={analyzeMeasurements}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Analisar com Nitro
          </button>
          <button type="button" onClick={() => setForm(initialForm)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Resetar campos
          </button>
        </footer>
      </aside>
    </div>
  );
}
