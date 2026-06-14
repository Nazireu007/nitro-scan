import { motion } from 'framer-motion';
import {
  Activity,
  BrainCircuit,
  CircuitBoard,
  FileText,
  Gauge,
  LibraryBig,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: Gauge },
  { label: 'Behavior Engine', icon: BrainCircuit },
  { label: 'Casos', icon: CircuitBoard },
  { label: 'Biblioteca', icon: LibraryBig },
  { label: 'Relatórios', icon: FileText },
];

// Header module: product identity, prototype status, and the MVP navigation surface.
export function Header() {
  return (
    <motion.header
      className="panel-glass relative z-20 flex flex-col gap-5 p-4 md:flex-row md:items-center md:justify-between"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="logo-orb flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
          <Activity className="h-6 w-6 text-ion" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-white md:text-3xl">Nitro Scan</h1>
          <p className="text-sm font-medium text-slate-300">
            Intelligent Board Diagnostic System
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-2" aria-label="Primary navigation">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = index === 0;

          return (
            <button
              className={`nav-button ${active ? 'nav-button-active' : ''}`}
              key={item.label}
              type="button"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="status-chip">
        <ShieldCheck className="h-4 w-4 text-acid" aria-hidden="true" />
        <span>Software Mode</span>
      </div>
    </motion.header>
  );
}
