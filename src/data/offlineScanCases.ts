import type { OfflineScanInput } from '../types/offlineScan';

export type OfflineScanCase = {
  id: string;
  title: string;
  input: OfflineScanInput;
  expectedState: string;
};

export const offlineScanCases: OfflineScanCase[] = [
  {
    id: 'line-3v3-short',
    title: 'Linha 3,3 V em curto',
    expectedState: 'DETECTADO ou FORTE INDÍCIO',
    input: {
      id: 'case-line-3v3-short',
      testMode: 'line_to_gnd',
      testOrigin: 'probe',
      node: '3,3 V',
      response: '0,6 Ω',
      unit: 'Ω',
      context: 'placa desligada; pré-scan para GND',
    },
  },
  {
    id: 'high-current-injection',
    title: 'Corrente alta em injeção',
    expectedState: 'CORRELACIONADO/FORTE INDÍCIO',
    input: {
      id: 'case-high-current-injection',
      testMode: 'low_injection',
      testOrigin: 'probe',
      node: 'linha alvo',
      response: 'corrente alta',
      unit: 'A',
      context: 'injeção limitada',
      injectionVoltage: '0,5 V',
      measuredCurrent: '0,85 A',
    },
  },
  {
    id: 'signal-absent-point-b',
    title: 'Sinal ausente no ponto B',
    expectedState: 'Caminho aberto',
    input: {
      id: 'case-signal-absent-point-b',
      testMode: 'sine_wave',
      testOrigin: 'signal_flex',
      node: 'ponto B',
      response: 'sinal ausente no ponto B',
      unit: 'lógico',
      context: 'onda 1 kHz aplicada no ponto A',
      signalFrequency: '1 kHz',
      readChannel: 'Ponto B',
    },
  },
  {
    id: 'line-normalized-after-isolation',
    title: 'Linha normalizou após isolar componente',
    expectedState: 'CONFIRMADO',
    input: {
      id: 'case-line-normalized-after-isolation',
      testMode: 'confirmation',
      testOrigin: 'probe',
      node: 'linha 5 V',
      response: 'linha normalizou após isolar componente',
      unit: 'estado',
      context: 'prova elétrica de fechamento',
      confirmationState: 'confirmed',
    },
  },
  {
    id: 'mosfet-ds-low',
    title: 'MOSFET D-S baixo',
    expectedState: 'FORTE INDÍCIO',
    input: {
      id: 'case-mosfet-ds-low',
      testMode: 'component_test',
      testOrigin: 'probe',
      node: 'entrada VIN',
      response: 'MOSFET D-S baixo com linha em curto',
      unit: 'Ω',
      context: 'teste de componente',
      componentType: 'mosfet',
      componentLabel: 'MOSFET de entrada',
    },
  },
  {
    id: 'heated-capacitor',
    title: 'Capacitor aqueceu',
    expectedState: 'FORTE INDÍCIO/CONFIRMADO conforme prova de isolamento',
    input: {
      id: 'case-heated-capacitor',
      testMode: 'low_injection',
      testOrigin: 'probe',
      node: 'linha 1,2 V',
      response: 'capacitor aqueceu na injeção',
      unit: 'estado',
      context: 'injeção limitada; aquecimento localizado',
      injectionVoltage: '0,5 V',
      componentType: 'capacitor',
      componentLabel: 'capacitor na linha',
    },
  },
];
