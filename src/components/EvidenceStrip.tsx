import { FileCheck2 } from 'lucide-react';
import type { Evidence } from '../types/diagnostics';

type EvidenceStripProps = {
  evidences: Evidence[];
};

export function EvidenceStrip({ evidences }: EvidenceStripProps) {
  return (
    <section className="console-strip evidence-strip" aria-label="Evidências técnicas">
      <header className="console-strip-heading">
        <div>
          <FileCheck2 aria-hidden="true" />
          <h2>Evidências</h2>
        </div>
        <span>{evidences.length}</span>
      </header>

      <div className="console-strip-scroll">
        {evidences.length > 0 ? evidences.slice(0, 10).map((evidence, index) => (
          <article className={`evidence-line evidence-${evidence.level}`} key={evidence.id}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <p>{evidence.text}</p>
          </article>
        )) : <p className="console-empty-line">Nenhuma evidência registrada.</p>}
      </div>
    </section>
  );
}

