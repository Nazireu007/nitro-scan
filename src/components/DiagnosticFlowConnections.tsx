const gapSegments = [
  'M50 17.44 V20.64',
  'M50 38.08 V41.28',
  'M50 58.72 V61.92',
  'M50 79.36 V82.56',
];

export function DiagnosticFlowConnections() {
  return (
    <svg className="diagnostic-flow-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="diagnosticFlowLine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#a855f7" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#22d3ee" stopOpacity="0.92" />
          <stop offset="1" stopColor="#60a5fa" stopOpacity="0.64" />
        </linearGradient>
        <filter id="diagnosticFlowGlow">
          <feGaussianBlur stdDeviation="0.75" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="diagnosticFlowArrow" markerHeight="7" markerWidth="7" orient="auto" refX="6.2" refY="3.5" viewBox="0 0 7 7">
          <path d="M1,1 L6.2,3.5 L1,6 Z" />
        </marker>
      </defs>

      {gapSegments.map((segment) => (
        <path className="diagnostic-flow-rail" d={segment} key={`rail-${segment}`} />
      ))}

      {gapSegments.map((segment) => (
        <path className="diagnostic-flow-line" d={segment} key={`line-${segment}`} markerEnd="url(#diagnosticFlowArrow)" />
      ))}
    </svg>
  );
}
