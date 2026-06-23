import { canExecuteCommand } from './hardwareSafety';
import { createEmergencyStopCommand, createHeartbeatCommand, createPingCommand } from './hardwareProtocol';
import {
  connectSerial,
  disconnectSerial,
  getSerialBridgeState,
  readSerialFrames,
  sendHardwareCommand,
  type SerialCommandResult,
  type SerialDebugHandler,
  type StopSerialReading,
} from './serialBridge';
import type { HardwareCommand, HardwareFrame } from './hardwareTypes';

export type HardwareConnectionStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'reading' | 'error';

export const NITRO_PING_TIMEOUT_MESSAGE = 'Nitro Box não respondeu ao ping dentro do tempo esperado.';
const NITRO_BOOT_DELAY_MS = 2000;
const NITRO_PING_TIMEOUT_MS = 3000;

export type HardwareConnectionState = {
  status: HardwareConnectionStatus;
  portLabel?: string;
  lastFrame?: HardwareFrame;
  lastError?: string;
  connectedAt?: string;
  framesReceived: number;
  heartbeatActive?: boolean;
  handshakeConfirmed?: boolean;
};

export type HardwareCommunicationTestResult = {
  ok: boolean;
  message: string;
  frame?: HardwareFrame;
};

export type HardwareConnectOptions = {
  onFrame?: (frame: HardwareFrame) => void;
  onError?: (error: Error) => void;
  onLog?: (message: string) => void;
  onDebug?: SerialDebugHandler;
};

export function isNitroBoxPongFrame(frame: HardwareFrame): boolean {
  return frame.event === 'pong' && frame.hardware === 'Nitro Box' && frame.status === 'online';
}

export type HardwareConnectionManager = ReturnType<typeof createHardwareConnectionManager>;

export function createHardwareConnectionManager() {
  const initialBridge = getSerialBridgeState();
  let state: HardwareConnectionState = {
    status: initialBridge.supported ? 'disconnected' : 'unsupported',
    framesReceived: 0,
    heartbeatActive: false,
    handshakeConfirmed: false,
  };
  let stopReading: StopSerialReading | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatSending = false;
  const frameHandlers = new Set<(frame: HardwareFrame) => void>();
  const errorHandlers = new Set<(error: Error) => void>();
  const debugHandlers = new Set<SerialDebugHandler>();
  const frameQueue: HardwareFrame[] = [];
  const pendingFrameWaiters = new Set<{
    predicate: (frame: HardwareFrame) => boolean;
    resolve: (frame: HardwareFrame | null) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  function update(values: Partial<HardwareConnectionState>): HardwareConnectionState {
    state = { ...state, ...values };
    return { ...state };
  }

  function isConnected(): boolean {
    return state.status === 'connected' || state.status === 'reading';
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function dispatchFrame(frame: HardwareFrame): void {
    update({ lastFrame: frame, framesReceived: state.framesReceived + 1 });

    let consumed = false;
    pendingFrameWaiters.forEach((waiter) => {
      if (!waiter.predicate(frame)) return;
      pendingFrameWaiters.delete(waiter);
      clearTimeout(waiter.timeout);
      consumed = true;
      waiter.resolve(frame);
    });

    if (!consumed) {
      frameQueue.push(frame);
      if (frameQueue.length > 20) frameQueue.shift();
    }

    frameHandlers.forEach((handler) => handler(frame));
  }

  function dispatchError(error: Error): void {
    void stopHeartbeat();
    update({ status: 'error', lastError: error.message });
    errorHandlers.forEach((handler) => handler(error));
  }

  function dispatchDebug(message: string): void {
    debugHandlers.forEach((handler) => handler(message));
  }

  function queuedFrame(predicate: (frame: HardwareFrame) => boolean): HardwareFrame | null {
    const index = frameQueue.findIndex(predicate);
    if (index < 0) return null;
    const [frame] = frameQueue.splice(index, 1);
    return frame ?? null;
  }

  function waitForFrame(
    predicate: (frame: HardwareFrame) => boolean = () => true,
    timeoutMs = 3000,
  ): Promise<HardwareFrame | null> {
    const queued = queuedFrame(predicate);
    if (queued) return Promise.resolve(queued);

    if (!stopReading && isConnected()) startReading(() => undefined);

    return new Promise((resolve) => {
      const waiter = {
        predicate,
        resolve,
        timeout: setTimeout(() => {
          pendingFrameWaiters.delete(waiter);
          resolve(null);
        }, timeoutMs),
      };
      pendingFrameWaiters.add(waiter);
    });
  }

  function addRuntimeHandlers(options: HardwareConnectOptions = {}): void {
    if (options.onFrame) frameHandlers.add(options.onFrame);
    if (options.onError) errorHandlers.add(options.onError);
    if (options.onDebug) debugHandlers.add(options.onDebug);
  }

  async function connect(options: HardwareConnectOptions = {}): Promise<HardwareConnectionState> {
    addRuntimeHandlers(options);
    update({ status: 'connecting', lastError: undefined, handshakeConfirmed: false });
    const bridge = await connectSerial();
    if (!bridge.connected) {
      return update({
        status: bridge.supported ? 'error' : 'unsupported',
        lastError: bridge.message,
        handshakeConfirmed: false,
      });
    }

    options.onLog?.('Porta serial aberta.');
    startReading(options.onFrame ?? (() => undefined), options.onError, options.onDebug);
    options.onLog?.('Aguardando Nitro Box inicializar.');
    await delay(NITRO_BOOT_DELAY_MS);

    options.onLog?.('Comando ping enviado.');
    const pingResult = await sendHardwareCommand(createPingCommand());
    if (!pingResult.sent) {
      await disconnect();
      return update({
        status: 'error',
        lastError: pingResult.message,
        handshakeConfirmed: false,
      });
    }

    const pongFrame = await waitForFrame(isNitroBoxPongFrame, NITRO_PING_TIMEOUT_MS);
    if (!pongFrame) {
      await disconnect();
      return update({
        status: 'error',
        lastError: NITRO_PING_TIMEOUT_MESSAGE,
        handshakeConfirmed: false,
      });
    }

    options.onLog?.('Nitro Box respondeu: online.');
    return update({
      status: 'connected',
      portLabel: 'Nitro Box / Web Serial',
      connectedAt: new Date().toISOString(),
      lastError: undefined,
      lastFrame: pongFrame,
      handshakeConfirmed: true,
    });
  }

  async function disconnect(): Promise<HardwareConnectionState> {
    await stopHeartbeat();
    await stopReadingNow();
    const bridge = await disconnectSerial();
    return update({
      status: bridge.supported ? 'disconnected' : 'unsupported',
      portLabel: undefined,
      connectedAt: undefined,
      lastError: undefined,
      heartbeatActive: false,
      handshakeConfirmed: false,
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

  function startReading(
    onFrame: (frame: HardwareFrame) => void,
    onError?: (error: Error) => void,
    onDebug?: SerialDebugHandler,
  ): HardwareConnectionState {
    frameHandlers.add(onFrame);
    if (onError) errorHandlers.add(onError);
    if (onDebug) debugHandlers.add(onDebug);
    if (stopReading) return { ...state };
    update({ status: 'reading', lastError: undefined });
    stopReading = readSerialFrames(
      dispatchFrame,
      dispatchError,
      dispatchDebug,
    );
    return { ...state };
  }

  async function stopReadingNow(): Promise<HardwareConnectionState> {
    if (stopReading) await stopReading();
    stopReading = null;
    frameHandlers.clear();
    errorHandlers.clear();
    debugHandlers.clear();
    pendingFrameWaiters.forEach((waiter) => {
      clearTimeout(waiter.timeout);
      waiter.resolve(null);
    });
    pendingFrameWaiters.clear();
    if (state.status === 'reading') update({ status: 'connected' });
    return { ...state };
  }

  async function readFrame(): Promise<HardwareFrame | null> {
    update({ status: 'reading', lastError: undefined });
    try {
      const frame = await waitForFrame((candidate) => (
        !candidate.event ||
        candidate.event === 'command_blocked' ||
        candidate.event === 'heartbeat_timeout' ||
        candidate.event === 'emergency_stop_ack'
      ));
      update({ status: 'connected' });
      return frame;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao receber frame serial.';
      update({ status: 'error', lastError: message });
      throw error;
    }
  }

  async function testCommunication(): Promise<HardwareCommunicationTestResult> {
    if (!isConnected()) {
      return { ok: false, message: 'Nitro Box não conectada.' };
    }

    const result = await sendCommand(createPingCommand());
    if (!result.sent) return { ok: false, message: result.message };

    const frame = await waitForFrame(isNitroBoxPongFrame, NITRO_PING_TIMEOUT_MS);
    if (frame && isNitroBoxPongFrame(frame)) {
      return { ok: true, message: 'Nitro Box respondeu: online.', frame };
    }

    return { ok: false, message: NITRO_PING_TIMEOUT_MESSAGE };
  }

  function startHeartbeat(onLog?: (message: string) => void): HardwareConnectionState {
    if (heartbeatTimer || !isConnected() || !state.handshakeConfirmed) return { ...state };

    const sendHeartbeat = async () => {
      if (heartbeatSending) return;
      heartbeatSending = true;
      const result = await sendHardwareCommand(createHeartbeatCommand());
      heartbeatSending = false;

      if (result.sent) {
        onLog?.('Heartbeat enviado.');
        return;
      }

      update({ lastError: result.message });
      onLog?.('Heartbeat expirado.');
      await sendHardwareCommand(createEmergencyStopCommand());
      onLog?.('Corte de segurança acionado.');
      await stopHeartbeat();
      update({ status: 'error' });
    };

    update({ heartbeatActive: true });
    void sendHeartbeat();
    heartbeatTimer = setInterval(() => {
      void sendHeartbeat();
    }, 500);
    onLog?.('Heartbeat iniciado.');
    return { ...state };
  }

  async function stopHeartbeat(): Promise<HardwareConnectionState> {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    heartbeatSending = false;
    return update({ heartbeatActive: false });
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
    testCommunication,
    startHeartbeat,
    stopHeartbeat,
    getState,
  };
}
