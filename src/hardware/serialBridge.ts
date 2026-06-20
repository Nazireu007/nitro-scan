import { parseHardwareFrame } from './hardwareProtocol';
import type { HardwareCommand, HardwareFrame } from './hardwareTypes';

export type SerialBridgeState = {
  supported: boolean;
  connected: boolean;
  message: string;
};

export type SerialCommandResult = {
  sent: boolean;
  payload: string;
  message: string;
};

let connected = false;

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

// A permissão e a porta Web Serial serão ativadas quando o Nitro Probe estiver pronto.
export async function connectSerial(): Promise<SerialBridgeState> {
  connected = false;
  const supported = isSerialSupported();
  return {
    supported,
    connected,
    message: supported
      ? 'Ponte Web Serial preparada; conexão permanece desativada nesta fase.'
      : 'Web Serial não está disponível neste navegador.',
  };
}

export async function disconnectSerial(): Promise<SerialBridgeState> {
  connected = false;
  return { supported: isSerialSupported(), connected, message: 'Ponte serial desconectada.' };
}

export async function readSerialFrame(raw?: unknown): Promise<HardwareFrame | null> {
  if (raw === undefined) return null;
  return parseHardwareFrame(raw);
}

export async function sendHardwareCommand(command: HardwareCommand): Promise<SerialCommandResult> {
  const payload = JSON.stringify(command);
  return {
    sent: false,
    payload,
    message: connected ? 'Envio serial ainda não habilitado.' : 'Comando preparado; nenhum hardware conectado.',
  };
}
