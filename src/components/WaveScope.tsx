import { Activity } from 'lucide-react';
import type { ConfirmationState } from '../types/measurements';

type WaveScopeProps = {
  state: ConfirmationState;
  signalLabel: string;
  activityKey: number;
};

export function WaveScope({ state, signalLabel, activityKey }: WaveScopeProps) {
  return (
    <section className={`wave-scope wave-scope-${state}`} aria-label="Telemetria de sinal e resposta">
      <header className="wave-scope-header">
        <div>
          <Activity aria-hidden="true" />
          <span>Telemetria offline</span>
        </div>
        <strong>{signalLabel}</strong>
      </header>

      <div className="wave-scope-grid" aria-hidden="true">
        <svg key={activityKey} viewBox="0 0 720 220" preserveAspectRatio="none">
          <defs>
            <filter id="scopeGlow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <line className="scope-baseline" x1="0" y1="110" x2="720" y2="110" />
          <g className="scope-wave-track scope-wave-primary" filter="url(#scopeGlow)">
            <path d="M0 110 C25 110 30 54 56 54 S88 166 116 166 S150 78 180 78 S214 142 244 142 S278 94 306 94 S338 128 366 128 S400 44 430 44 S462 176 492 176 S524 86 552 86 S584 134 612 134 S646 110 720 110" />
            <path d="M720 110 C745 110 750 54 776 54 S808 166 836 166 S870 78 900 78 S934 142 964 142 S998 94 1026 94 S1058 128 1086 128 S1120 44 1150 44 S1182 176 1212 176 S1244 86 1272 86 S1304 134 1332 134 S1366 110 1440 110" />
          </g>
          <g className="scope-wave-track scope-wave-return">
            <path d="M0 126 C38 126 44 96 72 96 S110 146 142 146 S178 108 210 108 S248 138 280 138 S316 116 350 116 S388 132 420 132 S458 102 492 102 S530 142 564 142 S602 118 636 118 S674 126 720 126" />
            <path d="M720 126 C758 126 764 96 792 96 S830 146 862 146 S898 108 930 108 S968 138 1000 138 S1036 116 1070 116 S1108 132 1140 132 S1178 102 1212 102 S1250 142 1284 142 S1322 118 1356 118 S1394 126 1440 126" />
          </g>
          <line className="scope-cursor" x1="510" y1="18" x2="510" y2="202" />
        </svg>
      </div>

      <footer className="wave-scope-footer">
        <span><i className="scope-key scope-key-primary" />Sinal injetado</span>
        <span><i className="scope-key scope-key-return" />Resposta capturada</span>
        <b>CH A / CH B</b>
      </footer>
    </section>
  );
}

