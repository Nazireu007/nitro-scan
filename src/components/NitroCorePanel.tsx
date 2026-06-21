import { Activity, Gauge, Radio, ShieldCheck } from 'lucide-react';
import type { VerdictStatus } from '../engine/verdictPresentation';

type NitroCorePanelProps = {
  confidence: number;
  events: number;
  health: number;
  status: VerdictStatus;
};

const stateLabels: Record<VerdictStatus, string> = {
  open: 'Sem veredito',
  line_failure: 'Falha na linha',
  confirmed: 'Veredito fechado',
  blocked: 'Teste bloqueado',
};

export function NitroCorePanel({ confidence, events, health, status }: NitroCorePanelProps) {
  return (
    <section className={`console-core-panel nitro-core-${status}`} aria-label="Núcleo Nitro">
      <div className="nitro-core-visual">
        <span className="nitro-core-halo" aria-hidden="true" />
        <span className="nitro-core-orbit nitro-core-orbit-a" aria-hidden="true" />
        <span className="nitro-core-orbit nitro-core-orbit-b" aria-hidden="true" />
        <svg className="nitro-core-module" viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="nitroCoreTrace" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#22dfff" stopOpacity="0.04" />
              <stop offset="0.42" stopColor="#22dfff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ff2bd6" stopOpacity="0.42" />
            </linearGradient>
            <linearGradient id="nitroCoreShell" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#112946" />
              <stop offset="0.48" stopColor="#06111f" />
              <stop offset="1" stopColor="#130824" />
            </linearGradient>
            <radialGradient id="nitroCoreDie" cx="50%" cy="46%" r="66%">
              <stop offset="0" stopColor="#e9fcff" stopOpacity="0.94" />
              <stop offset="0.35" stopColor="#22dfff" stopOpacity="0.72" />
              <stop offset="1" stopColor="#8b2cff" stopOpacity="0.2" />
            </radialGradient>
          </defs>

          <g className="nitro-core-link-grid">
            <path className="nitro-core-trace nitro-core-trace-primary" d="M8 86 H38 V104 H64" />
            <path className="nitro-core-trace nitro-core-trace-primary" d="M232 86 H202 V104 H176" />
            <path className="nitro-core-trace nitro-core-trace-secondary" d="M10 154 H42 V136 H64" />
            <path className="nitro-core-trace nitro-core-trace-secondary" d="M230 154 H198 V136 H176" />
            <path className="nitro-core-trace nitro-core-trace-uplink" d="M120 8 V42" />
            <path className="nitro-core-trace nitro-core-trace-uplink" d="M120 198 V232" />
            <circle className="nitro-core-node" cx="64" cy="104" r="3.2" />
            <circle className="nitro-core-node" cx="176" cy="104" r="3.2" />
            <circle className="nitro-core-node nitro-core-node-secondary" cx="64" cy="136" r="2.8" />
            <circle className="nitro-core-node nitro-core-node-secondary" cx="176" cy="136" r="2.8" />
          </g>

          <g className="nitro-core-pins">
            <path d="M82 64 V44" />
            <path d="M106 64 V40" />
            <path d="M134 64 V40" />
            <path d="M158 64 V44" />
            <path d="M82 176 V196" />
            <path d="M106 176 V200" />
            <path d="M134 176 V200" />
            <path d="M158 176 V196" />
            <path d="M64 82 H44" />
            <path d="M64 106 H40" />
            <path d="M64 134 H40" />
            <path d="M64 158 H44" />
            <path d="M176 82 H196" />
            <path d="M176 106 H200" />
            <path d="M176 134 H200" />
            <path d="M176 158 H196" />
          </g>

          <g className="nitro-core-chip">
            <rect className="nitro-core-chip-shadow" x="62" y="62" width="116" height="116" rx="18" />
            <rect className="nitro-core-chip-shell" x="66" y="66" width="108" height="108" rx="16" />
            <rect className="nitro-core-chip-ring" x="82" y="82" width="76" height="76" rx="13" />
            <circle className="nitro-core-die" cx="120" cy="120" r="24" />
            <path className="nitro-core-signal nitro-core-signal-a" d="M96 122 C106 106 118 136 128 120 S142 108 148 122" />
            <path className="nitro-core-signal nitro-core-signal-b" d="M96 137 H108 L115 129 L124 145 L132 135 H148" />
            <path className="nitro-core-axis" d="M120 86 V154 M86 120 H154" />
          </g>
        </svg>
        <div className="nitro-core-title">
          <strong>NÚCLEO NITRO</strong>
          <small>NÚCLEO DE COMPORTAMENTO</small>
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
          <strong>{stateLabels[status]}</strong>
        </div>
      </div>
    </section>
  );
}
