import { canExecuteCommand } from './hardwareSafety';
import {
  connectSerial,
  disconnectSerial,
  getSerialBridgeState,
  readSerialFrame,
  readSerialFrames,
  sendHardwareCommand,
  type SerialCommandResult,
  type StopSerialReading,
} from './serialBridge';
import type { HardwareCommand, HardwareFrame } from './hardwareTypes';

export type HardwareConnectionStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'reading' | 'error';

export type HardwareConnectionState = {
  status: HardwareConnectionStatus;
  portLabel?: string;
  lastFrame?: HardwareFrame;
  lastError?: string;
  connectedAt?: string;
  framesReceived: number;
};

export type HardwareConnectionManager = ReturnType<typeof createHardwareConnectionManager>;

export function createHardwareConnectionManager() {
  const initialBridge = getSerialBridgeState();
  let state: HardwareConnectionState = {
    status: initialBridge.supported ? 'disconnected' : 'unsupported',
    framesReceived: 0,
  };
  let stopReading: StopSerialReading | null = null;

  function update(values: Partial<HardwareConnectionState>): HardwareConnectionState {
    state = { ...state, ...values };
    return { ...state };
  }

  async function connect(): Promise<HardwareConnectionState> {
    update({ status: 'connecting', lastError: undefined });
    const bridge = await connectSerial();
    if (!bridge.connected) {
      return update({
        status: bridge.supported ? 'error' : 'unsupported',
        lastError: bridge.message,
      });
    }
    return update({
      status: 'connected',
      portLabel: 'Nitro Probe / Web Serial',
      connectedAt: new Date().toISOString(),
      lastError: undefined,
    });
  }

  async function disconnect(): Promise<HardwareConnectionState> {
    await stopReadingNow();
    const bridge = await disconnectSerial();
    return update({
      status: bridge.supported ? 'disconnected' : 'unsupported',
      portLabel: undefined,
      connectedAt: undefined,
      lastError: undefined,
    });
  }

  async function sendCommand(command: HardwareCommand): Promise<SerialCommandResult> {
    if (!canExecuteCommand(command, state.lastFrame)) {
      return {
        sent: false,
        payload: `${JSON.stringify(command)}\n`,
        message: 'Comando bloqueado pelas regras de segurança do Nitro.',
      };
    }
    const result = await sendHardwareCommand(command);
    if (!result.sent) update({ lastError: result.message });
    return result;
  }

  function startReading(onFrame: (frame: HardwareFrame) => void, onError?: (error: Error) => void): HardwareConnectionState {
    if (stopReading) return { ...state };
    update({ status: 'reading', lastError: undefined });
    stopReading = readSerialFrames(
      (frame) => {
        update({ lastFrame: frame, framesReceived: state.framesReceived + 1 });
        onFrame(frame);
      },
      (error) => {
        update({ status: 'error', lastError: error.message });
        onError?.(error);
      },
    );
    return { ...state };
  }

  async function stopReadingNow(): Promise<HardwareConnectionState> {
    if (stopReading) await stopReading();
    stopReading = null;
    if (state.status === 'reading') update({ status: 'connected' });
    return { ...state };
  }

  async function readFrame(): Promise<HardwareFrame | null> {
    update({ status: 'reading', lastError: undefined });
    try {
      const frame = await readSerialFrame();
      if (frame) update({ lastFrame: frame, framesReceived: state.framesReceived + 1 });
      update({ status: 'connected' });
      return frame;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao receber frame serial.';
      update({ status: 'error', lastError: message });
      throw error;
    }
  }

  function getState(): HardwareConnectionState {
    return { ...state };
  }

  return {
    connect,
    disconnect,
    sendCommand,
    startReading,
    stopReading: stopReadingNow,
    readFrame,
    getState,
  };
}
