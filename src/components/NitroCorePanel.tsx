import { Activity, Gauge, Radio, ShieldCheck } from 'lucide-react';
import type { ConfirmationState } from '../types/measurements';

type NitroCorePanelProps = {
  confidence: number;
  events: number;
  health: number;
  state: ConfirmationState;
  activityKey: number;
};

const stateLabels: Record<ConfirmationState, string> = {
  detected: 'Detectado',
  correlated: 'Correlacionado',
  strong_indication: 'Forte indício',
  confirmed: 'Confirmado',
};

export function NitroCorePanel({ confidence, events, health, state, activityKey }: NitroCorePanelProps) {
  return (
    <section className={`console-core-panel nitro-core-${state}`} aria-label="Núcleo Nitro">
      <div className="nitro-core-visual" key={activityKey}>
        <span className="nitro-core-orbit nitro-core-orbit-a" aria-hidden="true" />
        <span className="nitro-core-orbit nitro-core-orbit-b" aria-hidden="true" />
        <img src={`${import.meta.env.BASE_URL}nitro-core-chip.webp`} alt="Núcleo de processamento Nitro" />
        <div className="nitro-core-title">
          <span>NÚCLEO</span>
          <strong>NITRO</strong>
          <small>Behavior Engine V1</small>
        </div>
      </div>

      <div className="nitro-core-metrics">
        <div>
          <Gauge aria-hidden="true" />
          <span>Confiança</span>
          <strong>{confidence}%</strong>
        </div>
        <div>
          <Activity aria-hidden="true" />
          <span>Eventos</span>
          <strong>{events}</strong>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" />
          <span>Saúde</span>
          <strong>{health}%</strong>
        </div>
        <div>
          <Radio aria-hidden="true" />
          <span>Estado</span>
          <strong>{stateLabels[state]}</strong>
        </div>
      </div>
    </section>
  );
}
