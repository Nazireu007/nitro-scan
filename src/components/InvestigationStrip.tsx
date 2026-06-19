import { ListChecks } from 'lucide-react';
import type { NextTest } from '../types/diagnostics';

type InvestigationStripProps = {
  tests: NextTest[];
};

const statuses = ['EM ANÁLISE', 'NA BANCADA', 'PENDENTE', 'PENDENTE'] as const;

export function InvestigationStrip({ tests }: InvestigationStripProps) {
  return (
    <section className="console-strip investigation-strip" aria-label="Plano de investigação">
      <header className="console-strip-heading">
        <div>
          <ListChecks aria-hidden="true" />
          <h2>Próximos passos</h2>
        </div>
        <span>{tests.length}</span>
      </header>

      <div className="console-strip-scroll">
        {tests.length > 0 ? tests.slice(0, 8).map((test, index) => (
          <article className="investigation-line" key={test.id}>
            <span className={`investigation-state investigation-state-${index === 0 ? 'active' : index === 1 ? 'bench' : 'pending'}`}>
              {statuses[index % statuses.length]}
            </span>
            <p>{test.title}</p>
          </article>
        )) : <p className="console-empty-line">Nenhum teste sugerido.</p>}
      </div>
    </section>
  );
}

