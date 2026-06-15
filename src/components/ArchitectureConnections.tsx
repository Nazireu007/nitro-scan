export function ArchitectureConnections() {
  const routes = [
    { id: 'input-engine', d: 'M269 139 H383' },
    { id: 'engine-diagnostic', d: 'M618 139 H731' },
    { id: 'input-cases', d: 'M152 213 V388' },
    { id: 'engine-signatures', d: 'M468 213 V306 H392 V446' },
    { id: 'engine-history', d: 'M532 213 V306 H609 V446' },
    { id: 'diagnostic-library', d: 'M849 213 V388' },
    { id: 'signatures-history', d: 'M492 511 H509' },
    { id: 'history-library', d: 'M710 535 H849 V517' },
  ];

  const ports = [
    [269, 139],
    [383, 139],
    [618, 139],
    [731, 139],
    [152, 213],
    [152, 388],
    [468, 213],
    [392, 446],
    [532, 213],
    [609, 446],
    [849, 213],
    [849, 388],
    [492, 511],
    [509, 511],
    [710, 535],
    [849, 517],
  ];

  return (
    <svg className="architecture-connections" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="architectureLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.34" />
          <stop offset="0.46" stopColor="#22d3ee" stopOpacity="0.88" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0.58" />
        </linearGradient>
        <filter id="architectureGlow">
          <feGaussianBlur stdDeviation="1.9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="architectureArrow" markerHeight="5.8" markerWidth="5.8" orient="auto" refX="5.1" refY="2.9" viewBox="0 0 5.8 5.8">
          <path d="M0.8,0.8 L5.1,2.9 L0.8,5 Z" />
        </marker>
      </defs>

      <g className="architecture-route-layer">
        {routes.map((route) => (
          <path className="architecture-route" d={route.d} key={route.id} markerEnd="url(#architectureArrow)" />
        ))}
      </g>

      <g className="architecture-port-layer">
        {ports.map(([cx, cy]) => (
          <circle className="architecture-port" cx={cx} cy={cy} key={`${cx}-${cy}`} r="3.2" />
        ))}
      </g>
    </svg>
  );
}
