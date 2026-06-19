import { TerminalSquare } from 'lucide-react';
import type { DiagnosticLog } from '../types/diagnostics';

type LiveLogStripProps = {
  logs: DiagnosticLog[];
  analyzedAt: string;
};

function logTime(analyzedAt: string, index: number): string {
  const date = new Date(analyzedAt);
  date.setSeconds(date.getSeconds() + index);

  return date.toLocaleTimeString('pt-BR', { hour12: false });
}

function logStatus(level: DiagnosticLog['level']): 'OK' | 'ALERTA' {
  return level === 'WARN' || level === 'FAIL' ? 'ALERTA' : 'OK';
}

export function LiveLogStrip({ logs, analyzedAt }: LiveLogStripProps) {
  return (
    <section className="console-strip live-log-strip" aria-label="Registros ao vivo">
      <header className="console-strip-heading">
        <div>
          <TerminalSquare aria-hidden="true" />
          <h2>Registros ao vivo</h2>
        </div>
        <span>LIVE</span>
      </header>

      <div className="console-strip-scroll">
        {logs.length > 0 ? logs.slice(-10).map((log, index) => (
          <article className={`live-log-line live-log-${logStatus(log.level).toLowerCase()}`} key={`${log.message}-${index}`}>
            <time>{logTime(analyzedAt, index)}</time>
            <b>{log.level}</b>
            <p>{log.message}</p>
            <span>{logStatus(log.level)}</span>
          </article>
        )) : <p className="console-empty-line">Aguardando atividade do motor.</p>}
      </div>
    </section>
  );
}

