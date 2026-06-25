import { useEffect, useMemo, useRef, useState } from 'react';
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

function logMessage(log: DiagnosticLog): string {
  return log.count && log.count > 1 ? `${log.message} (x${log.count})` : log.message;
}

export function LiveLogStrip({ logs, analyzedAt }: LiveLogStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickToEnd, setStickToEnd] = useState(true);
  const visibleLogs = useMemo(() => logs.slice(-120), [logs]);

  useEffect(() => {
    if (!stickToEnd) return;
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }, [stickToEnd, visibleLogs.length, analyzedAt]);

  function updateScrollState() {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    const distanceToEnd = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    setStickToEnd(distanceToEnd < 12);
  }

  function scrollToEnd() {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
    setStickToEnd(true);
  }

  return (
    <section className="console-strip live-log-strip" aria-label="Registros ao vivo">
      <header className="console-strip-heading">
        <div>
          <TerminalSquare aria-hidden="true" />
          <h2>Registros ao vivo</h2>
        </div>
        {!stickToEnd && visibleLogs.length > 0 ? (
          <button className="live-log-jump-button" type="button" onClick={scrollToEnd}>
            Ir para o fim
          </button>
        ) : (
          <span>LIVE</span>
        )}
      </header>

      <div className="console-strip-scroll" ref={scrollRef} onScroll={updateScrollState}>
        {visibleLogs.length > 0 ? visibleLogs.map((log, index) => (
          <article className={`live-log-line live-log-${logStatus(log.level).toLowerCase()}`} key={`${log.message}-${log.count ?? 1}-${index}`}>
            <time>{logTime(analyzedAt, index)}</time>
            <b>{log.level}</b>
            <p>{logMessage(log)}</p>
            <span>{logStatus(log.level)}</span>
          </article>
        )) : <p className="console-empty-line">Aguardando atividade do motor.</p>}
      </div>
    </section>
  );
}
