export function ArchitectureConnections() {
  return (
    <svg className="architecture-connections" viewBox="0 0 720 310" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="architectureLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.34" />
          <stop offset="0.52" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="1" stopColor="#60a5fa" stopOpacity="0.78" />
        </linearGradient>
        <filter id="architectureGlow">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="architectureArrow" markerHeight="7" markerWidth="8" orient="auto" refX="7" refY="3.5">
          <path d="M0,0 L8,3.5 L0,7 Z" />
        </marker>
      </defs>

      <path d="M201 92 H224 V124 H242 V92 H264" />
      <path d="M456 92 H478 V124 H494 V92 H516" />
      <path d="M112 130 V154 H150 V180" />
      <path d="M360 132 V171 H278 V220" />
      <path d="M360 132 V171 H438 V220" />
      <path d="M606 130 V178" />
      <path d="M350 254 H365" />
      <path d="M510 254 H538 V218 H514" />
    </svg>
  );
}
