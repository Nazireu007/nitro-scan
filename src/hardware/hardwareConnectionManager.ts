import { canExecuteCommand } from './hardwareSafety';
import { createEmergencyStopCommand, createHeartbeatCommand, createPingCommand } from './hardwareProtocol';
import {
  connectSerial,
  disconnectSerial,
  getSerialBridgeState,
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
  heartbeatActive?: boolean;
};

export type HardwareCommunicationTestResult = {
  ok: boolean;
  message: string;
  frame?: HardwareFrame;
};

export type HardwareConnectionManager = ReturnType<typeof createHardwareConnectionManager>;

export function createHardwareConnectionManager() {
  const initialBridge = getSerialBridgeState();
  let state: HardwareConnectionState = {
    status: initialBridge.supported ? 'disconnected' : 'unsupported',
    framesReceived: 0,
    heartbeatActive: false,
  };
  let stopReading: StopSerialReading | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatSending = false;
  const frameHandlers = new Set<(frame: HardwareFrame) => void>();
  const errorHandlers = new Set<(error: Error) => void>();
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
    update({ status: 'error', lastError: error.message });
    errorHandlers.forEach((handler) => handler(error));
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
      portLabel: 'Nitro Box / Web Serial',
      connectedAt: new Date().toISOString(),
      lastError: undefined,
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
    frameHandlers.add(onFrame);
    if (onError) errorHandlers.add(onError);
    if (stopReading) return { ...state };
    update({ status: 'reading', lastError: undefined });
    stopReading = readSerialFrames(
      dispatchFrame,
      dispatchError,
    );
    return { ...state };
  }

  async function stopReadingNow(): Promise<HardwareConnectionState> {
    if (stopReading) await stopReading();
    stopReading = null;
    frameHandlers.clear();
    errorHandlers.clear();
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

    const frame = await waitForFrame((candidate) => candidate.event === 'pong', 2000);
    if (frame?.event === 'pong') {
      return { ok: true, message: 'Nitro Box respondeu: online.', frame };
    }

    return { ok: false, message: 'Nitro Box não respondeu ao ping dentro do tempo esperado.' };
  }

  function startHeartbeat(onLog?: (message: string) => void): HardwareConnectionState {
    if (heartbeatTimer || !isConnected()) return { ...state };

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
