import { motion } from 'framer-motion';
import { Activity, ScanLine, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { DiagnosticResult, EvidenceSeverity } from '../engine/types';

const severityClass: Record<EvidenceSeverity, string> = {
  OK: 'evidence-ok',
  WARN: 'evidence-warn',
  FAIL: 'evidence-fail',
  INFO: 'evidence-info',
};

const severityIcon = {
  OK: ShieldCheck,
  WARN: ShieldAlert,
  FAIL: ShieldAlert,
  INFO: Activity,
};

type EvidencePanelProps = {
  result: DiagnosticResult;
};

// EvidencePanel module: displays rule matches, conclusions, and recommended next tests.
export function EvidencePanel({ result }: EvidencePanelProps) {
  return (
    <motion.section
      className="panel-glass evidence-panel p-4"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: 'easeOut', delay: 0.16 }}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">Rule Trace</p>
          <h2 className="panel-title">Technical Evidence</h2>
        </div>
        <span className="engine-chip">{result.boardName}</span>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-3">
          {result.evidence.map((item, index) => {
            const Icon = severityIcon[item.severity];

            return (
              <motion.article
                className="evidence-card"
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.24 + index * 0.05 }}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`evidence-badge ${severityClass[item.severity]}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.severity}</span>
                  </div>
                  <div className="min-w-0">
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="evidence-side">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-acid" aria-hidden="true" />
              <h3>Conclusions</h3>
            </div>
            <ul className="evidence-list">
              {result.conclusions.map((conclusion) => (
                <li key={conclusion}>{conclusion}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-ion" aria-hidden="true" />
              <h3>Next Tests</h3>
            </div>
            <ul className="evidence-list">
              {result.nextTests.map((test) => (
                <li key={test}>{test}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
