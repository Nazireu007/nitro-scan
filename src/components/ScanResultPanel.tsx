import { AlertTriangle, CheckCircle2, Crosshair, Search } from 'lucide-react';
import type { ConsoleAnalysis } from '../engine/consoleAdapter';
import { verdictLabels, type VerdictStatus } from '../engine/verdictPresentation';

type ScanResultPanelProps = {
  analysis: ConsoleAnalysis;
};

function StateIcon({ status }: { status: VerdictStatus }) {
  if (status === 'confirmed') return <CheckCircle2 aria-hidden="true" />;
  if (status === 'blocked') return <AlertTriangle aria-hidden="true" />;
  if (status === 'line_failure') return <Crosshair aria-hidden="true" />;

  return <Search aria-hidden="true" />;
}

export function ScanResultPanel({ analysis }: ScanResultPanelProps) {
  const readings = analysis.verdictStatus === 'confirmed'
    ? analysis.result.evidences
        .filter((item) => item.level === 'success' || item.strength === 'strong')
        .slice(0, 3)
        .map((item) => ({ id: item.id, text: item.text, score: 100 }))
    : analysis.result.nextTests.slice(0, 3).map((item) => ({
        id: item.id,
        text: `Prova necessária: ${item.title}`,
        score: Math.max(30, 90 - (item.priority - 1) * 20),
      }));

  return (
    <section className={`scan-result-panel scan-result-${analysis.verdictStatus}`} aria-label="Resultado do diagnóstico">
      <header>
        <span className="scan-result-state">
          <StateIcon status={analysis.verdictStatus} />
          {verdictLabels[analysis.verdictStatus]}
        </span>
        <span className="scan-result-case">{analysis.session.title}</span>
      </header>

      <h2>{analysis.headline}</h2>
      <p>{analysis.result.summary}</p>

      <div className="scan-verdict-readings" aria-label="Provas e pendências">
        {readings.length > 0 ? (
          readings.map((reading) => (
            <div key={reading.id}>
              <span>{reading.text}</span>
              <i aria-hidden="true"><b style={{ width: `${reading.score}%` }} /></i>
              <strong>{reading.score}%</strong>
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
