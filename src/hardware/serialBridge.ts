import { parseHardwareFrame } from './hardwareProtocol';
import { detectPlatformCapabilities } from './platformCapabilities';
import type { HardwareCommand, HardwareFrame } from './hardwareTypes';

type NitroSerialPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
};

type NitroSerialApi = {
  requestPort: () => Promise<NitroSerialPort>;
};

type NavigatorWithSerial = Navigator & {
  serial?: NitroSerialApi;
};

export type SerialBridgeStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected' | 'error';

export type SerialBridgeState = {
  supported: boolean;
  connected: boolean;
  status: SerialBridgeStatus;
  message: string;
};

export type SerialCommandResult = {
  sent: boolean;
  payload: string;
  message: string;
};

export type SerialFrameHandler = (frame: HardwareFrame) => void;
export type SerialErrorHandler = (error: Error) => void;
export type StopSerialReading = () => Promise<void>;

let activePort: NitroSerialPort | null = null;
let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let serialBuffer = '';

function serialApi(): NitroSerialApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as NavigatorWithSerial).serial;
}

function friendlySerialError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotFoundError') return 'Seleção de porta cancelada pelo usuário.';
  if (name === 'SecurityError') return 'O navegador bloqueou o acesso serial. Verifique HTTPS e permissões.';
  if (name === 'NetworkError') return 'Não foi possível abrir a porta. Verifique cabo, uso por outro programa e permissões do sistema.';
  return error instanceof Error ? error.message : 'Falha desconhecida na conexão serial.';
}

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function getSerialBridgeState(): SerialBridgeState {
  const capabilities = detectPlatformCapabilities();
  const supported = isSerialSupported() && capabilities.isSecureContext;
  if (!supported) {
    return {
      supported,
      connected: false,
      status: 'unavailable',
      message: 'Conexão direta indisponível neste navegador',
    };
  }
  return {
    supported,
    connected: activePort !== null,
    status: activePort ? 'connected' : 'disconnected',
    message: activePort ? 'Nitro Box conectada via Web Serial.' : 'Serial disponível. Selecione a porta da Nitro Box.',
  };
}

// Web Serial só é acionado por gesto explícito; nunca solicitamos uma porta ao carregar a aplicação.
export async function connectSerial(baudRate = 115200): Promise<SerialBridgeState> {
  const api = serialApi();
  const capabilities = detectPlatformCapabilities();
  if (!isSerialSupported() || !capabilities.isSecureContext || !api) return getSerialBridgeState();
  if (activePort) return getSerialBridgeState();

  try {
    const selectedPort = await api.requestPort();
    await selectedPort.open({ baudRate });
    activePort = selectedPort;
    serialBuffer = '';
    return getSerialBridgeState();
  } catch (error) {
    activePort = null;
    return {
      supported: true,
      connected: false,
      status: 'error',
      message: friendlySerialError(error),
    };
  }
}

export async function disconnectSerial(): Promise<SerialBridgeState> {
  try {
    if (activeReader) await activeReader.cancel();
  } catch {
    // A porta pode ter sido removida fisicamente; o fechamento continua abaixo.
  } finally {
    activeReader?.releaseLock();
    activeReader = null;
  }

  try {
    await activePort?.close();
  } catch {
    // O estado local ainda precisa ser limpo quando o sistema já encerrou a porta.
  }

  activePort = null;
  serialBuffer = '';
  const supported = isSerialSupported();
  return {
    supported,
    connected: false,
    status: supported ? 'disconnected' : 'unavailable',
    message: supported ? 'Nitro Box desconectada.' : 'Conexão direta indisponível neste navegador',
  };
}

export async function readSerialFrame(raw?: unknown, timeoutMs = 3000): Promise<HardwareFrame | null> {
  if (raw !== undefined) return parseHardwareFrame(raw);
  return new Promise<HardwareFrame | null>((resolve, reject) => {
    let stop: StopSerialReading = async () => undefined;
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      void stop().then(() => resolve(null));
    }, timeoutMs);
    stop = readSerialFrames(
      (frame) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeout);
        void stop().then(() => resolve(frame));
      },
      (error) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeout);
        void stop().then(() => reject(error));
      },
    );
    if (!activeReader && !settled) {
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(null);
    }
  });
}

export function readSerialFrames(onFrame: SerialFrameHandler, onError: SerialErrorHandler): StopSerialReading {
  if (!activePort?.readable || activeReader) {
    queueMicrotask(() => onError(new Error('Nitro Box não conectada ou leitura serial já ativa.')));
    return async () => undefined;
  }

  const reader = activePort.readable.getReader();
  const decoder = new TextDecoder();
  let stopped = false;
  activeReader = reader;

  const readingTask = (async () => {
    try {
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) {
          if (!stopped) onError(new Error('Conexão serial encerrada pela Nitro Box.'));
          break;
        }
        serialBuffer += decoder.decode(value, { stream: true });

        let lineBreak = serialBuffer.indexOf('\n');
        while (lineBreak >= 0) {
          const frameLine = serialBuffer.slice(0, lineBreak).trim();
          serialBuffer = serialBuffer.slice(lineBreak + 1);
          lineBreak = serialBuffer.indexOf('\n');
          if (!frameLine) continue;

          try {
            onFrame(parseHardwareFrame(frameLine));
          } catch (error) {
            const detail = error instanceof Error ? error.message : 'conteúdo não reconhecido';
            onError(new Error(`Frame JSON inválido recebido: ${detail}`));
          }
        }
      }
    } catch (error) {
      if (!stopped) onError(error instanceof Error ? error : new Error('Leitura serial interrompida.'));
    } finally {
      if (activeReader === reader) activeReader = null;
      reader.releaseLock();
    }
  })();

  return async () => {
    stopped = true;
    try {
      await reader.cancel();
    } catch {
      // A desconexão física pode cancelar a leitura antes do software.
    }
    await readingTask;
  };
}

export async function sendHardwareCommand(command: HardwareCommand): Promise<SerialCommandResult> {
  const payload = `${JSON.stringify(command)}\n`;
  if (!activePort?.writable) {
    return { sent: false, payload, message: 'Comando preparado; nenhuma Nitro Box conectada.' };
  }

  const writer = activePort.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode(payload));
    return { sent: true, payload, message: `Comando ${command.command} enviado à Nitro Box.` };
  } catch (error) {
    return { sent: false, payload, message: friendlySerialError(error) };
  } finally {
    writer.releaseLock();
  }
}
