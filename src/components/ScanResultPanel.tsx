import { AlertTriangle, CheckCircle2, Crosshair, Search } from 'lucide-react';
import type { ConsoleAnalysis } from '../engine/consoleAdapter';
import type { ConfirmationState } from '../types/measurements';

type ScanResultPanelProps = {
  analysis: ConsoleAnalysis;
};

const stateLabels: Record<ConfirmationState, string> = {
  detected: 'DETECTADO',
  correlated: 'CORRELACIONADO',
  strong_indication: 'FORTE INDÍCIO',
  confirmed: 'CONFIRMADO',
};

function StateIcon({ state }: { state: ConfirmationState }) {
  if (state === 'confirmed') return <CheckCircle2 aria-hidden="true" />;
  if (state === 'strong_indication') return <AlertTriangle aria-hidden="true" />;
  if (state === 'correlated') return <Crosshair aria-hidden="true" />;

  return <Search aria-hidden="true" />;
}

export function ScanResultPanel({ analysis }: ScanResultPanelProps) {
  const hypotheses = analysis.result.hypotheses
    .filter((hypothesis) => hypothesis.id !== 'source_functional')
    .slice(0, 3);

  return (
    <section className={`scan-result-panel scan-result-${analysis.confirmationState}`} aria-label="Resultado do diagnóstico">
      <header>
        <span className="scan-result-state">
          <StateIcon state={analysis.confirmationState} />
          {stateLabels[analysis.confirmationState]}
        </span>
        <span className="scan-result-case">{analysis.session.title}</span>
      </header>

      <h2>{analysis.headline}</h2>
      <p>{analysis.result.summary}</p>

      <div className="scan-hypothesis-list" aria-label="Hipóteses principais">
        {hypotheses.length > 0 ? (
          hypotheses.map((hypothesis) => (
            <div key={hypothesis.id}>
              <span>{hypothesis.title}</span>
              <i aria-hidden="true"><b style={{ width: `${hypothesis.confidence}%` }} /></i>
              <strong>{hypothesis.confidence}%</strong>
            </div>
          ))
        ) : (
          <div className="scan-empty-result">
            <span>Aguardando leitura conclusiva</span>
            <strong>0%</strong>
          </div>
        )}
      </div>
    </section>
  );
}

