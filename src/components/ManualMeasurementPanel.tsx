import { ClipboardList, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { lgCj87DiagnosticCase } from '../data/diagnosticCases';
import type { DiagnosticSession } from '../types/diagnostics';
import type {
  ConfirmationState,
  MeasurementInput,
  MeasurementTestMode,
  MeasurementTestOrigin,
  MeasurementType,
} from '../types/measurements';
import { NitroSelect } from './NitroSelect';

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
  testMode: MeasurementTestMode;
  testOrigin: MeasurementTestOrigin;
  injectionVoltage: string;
  measuredCurrent: string;
  signalFrequency: string;
  returnAmplitude: string;
  attenuation: string;
  readChannel: string;
  confirmationState: ConfirmationState | '';
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

const testModeOptions: Array<{ value: MeasurementTestMode; label: string }> = [
  { value: 'offline_scan', label: 'Scan offline' },
  { value: 'line_to_gnd', label: 'Linha para GND' },
  { value: 'low_injection', label: 'Injeção baixa' },
  { value: 'sine_wave', label: 'Onda senoidal' },
  { value: 'connector_response', label: 'Resposta por conector' },
  { value: 'component_test', label: 'Teste de componente' },
  { value: 'confirmation', label: 'Confirmação' },
];

const testOriginOptions: Array<{ value: MeasurementTestOrigin; label: string }> = [
  { value: 'probe', label: 'Ponta de prova' },
  { value: 'dc_jack', label: 'DC Jack' },
  { value: 'usb_c_charge', label: 'USB-C / conector de carga' },
  { value: 'battery_connector', label: 'Conector de bateria' },
  { value: 'power_connector', label: 'Conector de fonte' },
  { value: 'signal_flex', label: 'Flat / conector de sinal' },
  { value: 'other_board_connector', label: 'Outro conector da placa' },
];

const confirmationOptions: Array<{ value: ConfirmationState | ''; label: string }> = [
  { value: '', label: 'Sem confirmação' },
  { value: 'detected', label: 'Detectado' },
  { value: 'correlated', label: 'Correlacionado' },
  { value: 'strong_indication', label: 'Forte indício' },
  { value: 'confirmed', label: 'Confirmado' },
];

const typeLabels: Record<MeasurementType, string> = {
  voltage: 'Tensão',
  current: 'Corrente',
  resistance: 'Resistência',
  signal: 'Sinal lógico',
  temperature: 'Temperatura',
  state: 'Estado',
};

const testModeLabels: Record<MeasurementTestMode, string> = {
  offline_scan: 'Scan offline',
  line_to_gnd: 'Linha para GND',
  low_injection: 'Injeção baixa',
  sine_wave: 'Onda senoidal',
  connector_response: 'Resposta por conector',
  component_test: 'Teste de componente',
  confirmation: 'Confirmação',
};

const confirmationLabels: Record<ConfirmationState, string> = {
  detected: 'Detectado',
  correlated: 'Correlacionado',
  strong_indication: 'Forte indício',
  confirmed: 'Confirmado',
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
const unitSelectOptions = unitOptions.map((unit) => ({ value: unit, label: unit }));

const initialForm: MeasurementForm = {
  label: '',
  type: 'resistance',
  value: '',
  unit: 'Ω',
  node: '',
  component: '',
  context: '',
  testMode: 'offline_scan',
  testOrigin: 'probe',
  injectionVoltage: '',
  measuredCurrent: '',
  signalFrequency: '',
  returnAmplitude: '',
  attenuation: '',
  readChannel: '',
  confirmationState: '',
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
      testMode: 'offline_scan',
      testOrigin: 'probe',
      confirmationState: 'detected',
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
      testMode: 'offline_scan',
      testOrigin: 'probe',
      confirmationState: 'detected',
    },
  },
  {
    title: '12 V normal presente',
    measurement: {
      label: 'Trilho de 12 V normal',
      type: 'voltage',
      value: '12 V',
      unit: 'V',
      node: '12V',
      component: 'Fonte/Principal',
      context: 'power on presente',
      testMode: 'confirmation',
      testOrigin: 'power_connector',
      confirmationState: 'confirmed',
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
      testMode: 'offline_scan',
      testOrigin: 'probe',
      confirmationState: 'detected',
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
      testMode: 'offline_scan',
      testOrigin: 'signal_flex',
      confirmationState: 'correlated',
    },
  },
  {
    title: 'CLOCK presente',
    measurement: {
      label: 'CLOCK da CPU',
      type: 'signal',
      value: 'presente',
      unit: 'lógico',
      node: 'CLOCK',
      component: 'CPU',
      context: 'power on',
      testMode: 'sine_wave',
      testOrigin: 'probe',
      signalFrequency: '1 kHz',
      readChannel: 'Ponta B',
      confirmationState: 'detected',
    },
  },
  {
    title: 'LINHA EM CURTO',
    measurement: {
      label: 'Linha em curto para GND',
      type: 'resistance',
      value: '0,6 Ω',
      unit: 'Ω',
      node: 'linha para GND',
      component: 'Linha principal',
      context: 'placa desligada; pré-scan detectou baixa impedância para GND',
      testMode: 'line_to_gnd',
      testOrigin: 'probe',
      confirmationState: 'strong_indication',
    },
  },
  {
    title: 'BAIXA IMPEDÂNCIA',
    measurement: {
      label: 'Baixa impedância no trilho',
      type: 'resistance',
      value: '1,4 Ω',
      unit: 'Ω',
      node: 'trilho para GND',
      component: 'Linha medida',
      context: 'pré-scan com placa desligada',
      testMode: 'line_to_gnd',
      testOrigin: 'probe',
      confirmationState: 'detected',
    },
  },
  {
    title: 'RESPOSTA AUSENTE',
    measurement: {
      label: 'Resposta ausente no retorno',
      type: 'signal',
      value: 'ausente',
      unit: 'lógico',
      node: 'RETORNO',
      component: 'Conector da placa',
      context: 'sem retorno após estímulo seguro',
      testMode: 'connector_response',
      testOrigin: 'other_board_connector',
      returnAmplitude: 'ausente',
      readChannel: 'Ponta B',
      confirmationState: 'correlated',
    },
  },
  {
    title: 'RETORNO ATENUADO',
    measurement: {
      label: 'Retorno atenuado no canal B',
      type: 'signal',
      value: 'presente',
      unit: 'lógico',
      node: 'PONTO_B',
      component: 'Conector da placa',
      context: 'retorno fraco após injeção segura',
      testMode: 'connector_response',
      testOrigin: 'other_board_connector',
      returnAmplitude: '20%',
      attenuation: 'alta',
      readChannel: 'Ponta B',
      confirmationState: 'correlated',
    },
  },
  {
    title: 'SINAL PRESENTE NO PONTO B',
    measurement: {
      label: 'Sinal presente no ponto B',
      type: 'signal',
      value: 'presente',
      unit: 'lógico',
      node: 'PONTO_B',
      component: 'Linha de sinal',
      context: 'resposta capturada no canal B',
      testMode: 'sine_wave',
      testOrigin: 'probe',
      signalFrequency: '1 kHz',
      returnAmplitude: '80%',
      readChannel: 'Ponta B',
      confirmationState: 'detected',
    },
  },
  {
    title: 'SINAL AUSENTE NO PONTO B',
    measurement: {
      label: 'Sinal ausente no ponto B',
      type: 'signal',
      value: 'ausente',
      unit: 'lógico',
      node: 'PONTO_B',
      component: 'Linha de sinal',
      context: 'sem resposta capturada no canal B',
      testMode: 'sine_wave',
      testOrigin: 'probe',
      signalFrequency: '1 kHz',
      returnAmplitude: 'ausente',
      readChannel: 'Ponta B',
      confirmationState: 'correlated',
    },
  },
  {
    title: 'INJEÇÃO 0,5 V',
    measurement: {
      label: 'Injeção segura de 0,5 V',
      type: 'voltage',
      value: '0,5 V',
      unit: 'V',
      node: 'linha alvo',
      component: 'Linha medida',
      context: 'injeção baixa com corrente limitada',
      testMode: 'low_injection',
      testOrigin: 'probe',
      injectionVoltage: '0,5 V',
      measuredCurrent: '0,12 A',
      confirmationState: 'detected',
    },
  },
  {
    title: 'CORRENTE ALTA',
    measurement: {
      label: 'Corrente alta em injeção baixa',
      type: 'current',
      value: '1,8 A',
      unit: 'A',
      node: 'linha alvo',
      component: 'Linha medida',
      context: 'injeção baixa com consumo elevado',
      testMode: 'low_injection',
      testOrigin: 'probe',
      injectionVoltage: '0,5 V',
      measuredCurrent: '1,8 A',
      confirmationState: 'strong_indication',
    },
  },
  {
    title: 'CAMINHO ABERTO',
    measurement: {
      label: 'Caminho aberto na linha',
      type: 'resistance',
      value: 'OL',
      unit: 'Ω',
      node: 'linha alvo',
      component: 'Trilha / conector',
      context: 'prova elétrica indica caminho aberto',
      testMode: 'connector_response',
      testOrigin: 'other_board_connector',
      confirmationState: 'strong_indication',
    },
  },
  {
    title: 'MOSFET D-S BAIXO',
    measurement: {
      label: 'MOSFET D-S baixo',
      type: 'resistance',
      value: '0,4 Ω',
      unit: 'Ω',
      node: 'D-S',
      component: 'MOSFET',
      context: 'teste de componente com baixa resistência entre dreno e source',
      testMode: 'component_test',
      testOrigin: 'probe',
      confirmationState: 'strong_indication',
    },
  },
  {
    title: 'DIODO CONDUZ NOS DOIS SENTIDOS',
    measurement: {
      label: 'Diodo conduz nos dois sentidos',
      type: 'state',
      value: 'presente',
      unit: 'estado',
      node: 'DIODO',
      component: 'Diodo',
      context: 'condução detectada nos dois sentidos',
      testMode: 'component_test',
      testOrigin: 'probe',
      confirmationState: 'strong_indication',
    },
  },
  {
    title: 'CAPACITOR AQUECEU NA INJEÇÃO',
    measurement: {
      label: 'Capacitor aqueceu na injeção',
      type: 'temperature',
      value: '58 °C',
      unit: '°C',
      node: 'linha alvo',
      component: 'Capacitor',
      context: 'capacitor aqueceu na injeção 0,5 V',
      testMode: 'low_injection',
      testOrigin: 'probe',
      injectionVoltage: '0,5 V',
      measuredCurrent: '0,80 A',
      confirmationState: 'confirmed',
    },
  },
  {
    title: 'LINHA NORMALIZOU APÓS ISOLAR COMPONENTE',
    measurement: {
      label: 'Linha normalizou após isolar componente',
      type: 'resistance',
      value: '24 Ω',
      unit: 'Ω',
      node: 'linha alvo',
      component: 'Componente isolado',
      context: 'linha normalizou após isolar componente',
      testMode: 'confirmation',
      testOrigin: 'probe',
      confirmationState: 'confirmed',
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
  const base = slug(`${measurement.node ?? measurement.label}-${measurement.context ?? ''}`) || 'scan';

  return {
    ...measurement,
    testMode: measurement.testMode ?? 'offline_scan',
    testOrigin: measurement.testOrigin ?? 'probe',
    id: `scan-${base}-${Date.now()}-${index}`,
    timestamp: new Date().toISOString(),
  };
}

function buildSession(measurements: MeasurementInput[]): DiagnosticSession {
  return {
    id: `scan-offline-session-${Date.now()}`,
    title: 'Sessão de scan offline',
    deviceCategory: 'Modo Scan Offline',
    symptoms: measurements.length > 0
      ? measurements.map((measurement) => `${measurement.node ?? measurement.label}: ${measurement.value}`)
      : ['medições insuficientes'],
    measurements,
    selectedCase: 'scan-offline',
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

function responseSummary(measurement: MeasurementInput): string {
  return [
    measurement.injectionVoltage ? `inj. ${measurement.injectionVoltage}` : '',
    measurement.measuredCurrent ? `corr. ${measurement.measuredCurrent}` : '',
    measurement.signalFrequency ? measurement.signalFrequency : '',
    measurement.returnAmplitude ? `ret. ${measurement.returnAmplitude}` : '',
    measurement.attenuation ? `at. ${measurement.attenuation}` : '',
    measurement.readChannel,
  ]
    .filter(Boolean)
    .join(' / ');
}

function compactModeLabel(measurement: MeasurementInput): string {
  return measurement.testMode ? testModeLabels[measurement.testMode] : 'Scan offline';
}

export function ManualMeasurementPanel({ isOpen, onClose, onAnalyze }: ManualMeasurementPanelProps) {
  const [form, setForm] = useState<MeasurementForm>(initialForm);
  const [measurements, setMeasurements] = useState<MeasurementInput[]>([]);
  const canAdd =
    form.value.trim().length > 0 ||
    form.node.trim().length > 0 ||
    form.injectionVoltage.trim().length > 0 ||
    form.returnAmplitude.trim().length > 0;
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

    const label = form.label.trim() || `${typeLabels[form.type]} ${form.node.trim() || form.value.trim() || form.testMode}`;
    const contextParts = [
      form.context.trim(),
      form.injectionVoltage.trim() ? `injeção ${form.injectionVoltage.trim()}` : '',
      form.returnAmplitude.trim() ? `retorno ${form.returnAmplitude.trim()}` : '',
      form.attenuation.trim() ? `atenuação ${form.attenuation.trim()}` : '',
      form.readChannel.trim() ? `canal ${form.readChannel.trim()}` : '',
    ].filter(Boolean);
    const measurement = createMeasurement(
      {
        label,
        type: form.type,
        value: form.value.trim() || form.returnAmplitude.trim() || form.injectionVoltage.trim() || 'n/d',
        unit: form.unit,
        node: form.node.trim(),
        component: form.component.trim(),
        context: contextParts.join('; '),
        testMode: form.testMode,
        testOrigin: form.testOrigin,
        injectionVoltage: form.injectionVoltage.trim(),
        measuredCurrent: form.measuredCurrent.trim(),
        signalFrequency: form.signalFrequency.trim(),
        returnAmplitude: form.returnAmplitude.trim(),
        attenuation: form.attenuation.trim(),
        readChannel: form.readChannel.trim(),
        confirmationState: form.confirmationState || undefined,
      },
      measurements.length,
    );

    setMeasurements((current) => [...current, measurement]);
    setForm((current) => ({
      ...initialForm,
      testMode: current.testMode,
      testOrigin: current.testOrigin,
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
      <aside className="manual-panel" aria-label="Modo Scan Offline">
        <header className="manual-panel-header">
          <div>
            <span>MODO SCAN OFFLINE</span>
            <strong>Entrada de scan, injeção e resposta elétrica</strong>
          </div>
          <button type="button" aria-label="Fechar modo scan offline" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="manual-panel-body">
          <section className="manual-section" aria-label="Entrada principal do scan">
            <div className="manual-section-heading">
              <span>Entrada principal</span>
            </div>
            <div className="manual-form-grid">
              <label>
                <span>Nome da medição</span>
                <input
                  value={form.label}
                  onChange={(event) => updateForm('label', event.target.value)}
                  placeholder="Ex.: Linha 12 V, VBUS USB-C, B+ bateria"
                />
              </label>

              <label>
                <span>Tipo</span>
                <NitroSelect
                  ariaLabel="Tipo"
                  value={form.type}
                  options={typeOptions}
                  onChange={(value) => updateForm('type', value)}
                />
              </label>

              <label>
                <span>Valor</span>
                <input
                  value={form.value}
                  onChange={(event) => updateForm('value', event.target.value)}
                  placeholder="Ex.: 0,6 Ω, 5,1 V, OL, ausente, retorno 20%"
                />
              </label>

              <label>
                <span>Unidade</span>
                <NitroSelect
                  ariaLabel="Unidade"
                  value={form.unit}
                  options={unitSelectOptions}
                  onChange={(value) => updateForm('unit', value)}
                />
              </label>

              <label>
                <span>Nó/Ponto</span>
                <input
                  value={form.node}
                  onChange={(event) => updateForm('node', event.target.value)}
                  placeholder="Ex.: 12 V, SPI_VCC, RESET, VBUS, B+"
                />
              </label>

              <label>
                <span>Componente relacionado</span>
                <input
                  value={form.component}
                  onChange={(event) => updateForm('component', event.target.value)}
                  placeholder="Ex.: L304, CPU, MOSFET, LDO, conector USB-C"
                />
              </label>

              <label className="manual-form-wide">
                <span>Contexto</span>
                <input
                  value={form.context}
                  onChange={(event) => updateForm('context', event.target.value)}
                  placeholder="Ex.: placa desligada, pré-scan, injeção 0,5 V, onda 1 kHz"
                />
              </label>
            </div>
          </section>

          <section className="manual-section" aria-label="Origem e modo de teste">
            <div className="manual-section-heading">
              <span>Origem e modo de teste</span>
            </div>
            <div className="manual-form-grid">
              <label>
                <span>Modo de teste</span>
                <NitroSelect
                  ariaLabel="Modo de teste"
                  value={form.testMode}
                  options={testModeOptions}
                  onChange={(value) => updateForm('testMode', value)}
                />
              </label>

              <label>
                <span>Origem do teste</span>
                <NitroSelect
                  ariaLabel="Origem do teste"
                  value={form.testOrigin}
                  options={testOriginOptions}
                  onChange={(value) => updateForm('testOrigin', value)}
                />
              </label>

              <label className="manual-form-wide">
                <span>Estado de confirmação</span>
                <NitroSelect
                  ariaLabel="Estado de confirmação"
                  value={form.confirmationState}
                  options={confirmationOptions}
                  onChange={(value) => updateForm('confirmationState', value)}
                />
              </label>
            </div>
          </section>

          <section className="manual-section" aria-label="Resposta do scan">
            <div className="manual-section-heading">
              <span>Resposta do scan</span>
              <strong>opcional</strong>
            </div>
            <div className="manual-form-grid">
              <label>
                <span>Tensão de injeção</span>
                <input
                  value={form.injectionVoltage}
                  onChange={(event) => updateForm('injectionVoltage', event.target.value)}
                  placeholder="Ex.: 0,3 V, 0,5 V, 1 V"
                />
              </label>

              <label>
                <span>Corrente medida</span>
                <input
                  value={form.measuredCurrent}
                  onChange={(event) => updateForm('measuredCurrent', event.target.value)}
                  placeholder="Ex.: 0,12 A, 0,80 A"
                />
              </label>

              <label>
                <span>Frequência do sinal</span>
                <input
                  value={form.signalFrequency}
                  onChange={(event) => updateForm('signalFrequency', event.target.value)}
                  placeholder="Ex.: 100 Hz, 1 kHz, 10 kHz"
                />
              </label>

              <label>
                <span>Retorno / amplitude</span>
                <input
                  value={form.returnAmplitude}
                  onChange={(event) => updateForm('returnAmplitude', event.target.value)}
                  placeholder="Ex.: 80%, 20%, ausente"
                />
              </label>

              <label>
                <span>Atenuação</span>
                <input
                  value={form.attenuation}
                  onChange={(event) => updateForm('attenuation', event.target.value)}
                  placeholder="Ex.: baixa, média, alta"
                />
              </label>

              <label>
                <span>Canal de leitura</span>
                <input
                  value={form.readChannel}
                  onChange={(event) => updateForm('readChannel', event.target.value)}
                  placeholder="Ex.: Ponta B, Ponta C, retorno no conector"
                />
              </label>
            </div>
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

          <section className="manual-presets" aria-label="Predefinições rápidas de scan offline">
            <div>
              <span>Predefinições rápidas</span>
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

          <section className="manual-measurement-list" aria-label="Medições e scans adicionados">
            {measurements.length === 0 ? (
              <p className="manual-empty-state">Nenhuma medição inserida.</p>
            ) : (
              measurements.map((measurement) => {
                const response = responseSummary(measurement);

                return (
                  <article key={measurement.id}>
                    <div>
                      <strong>{typeLabels[measurement.type]}</strong>
                      <span>{measurement.node || measurement.label}</span>
                    </div>
                    <p>
                      <b>{displayValue(measurement)}</b>
                      <span>{compactModeLabel(measurement)}</span>
                      <em>{measurement.confirmationState ? confirmationLabels[measurement.confirmationState] : measurement.context || 'sem contexto'}</em>
                      {response ? <i>{response}</i> : null}
                    </p>
                    <button type="button" aria-label={`Remover ${measurement.label}`} onClick={() => removeMeasurement(measurement.id)}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </article>
                );
              })
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
