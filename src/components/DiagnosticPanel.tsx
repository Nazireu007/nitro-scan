import { motion } from 'framer-motion';
import {
  Binary,
  BrainCircuit,
  Cpu,
  Gauge,
  RadioTower,
  ShieldAlert,
  type LucideIcon,
  Zap,
} from 'lucide-react';
import type { Suspect } from '../engine/types';

const suspectIcons: Record<string, LucideIcon> = {
  firmware_spi: Binary,
  clock_reset: RadioTower,
  buck_converter: Zap,
  cpu_boot_failure: Cpu,
  shorted_rail: ShieldAlert,
  ldo_regulator: Gauge,
  control_logic: BrainCircuit,
};

type DiagnosticPanelProps = {
  suspects: Suspect[];
  summary: string;
};

// DiagnosticPanel module: AI suspicion ranking rendered from the behavior engine output.
export function DiagnosticPanel({ suspects, summary }: DiagnosticPanelProps) {
  return (
    <motion.aside
      className="panel-glass h-full p-4"
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.65, ease: 'easeOut', delay: 0.1 }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">AI Matrix</p>
          <h2 className="panel-title">Diagnostic Engine</h2>
        </div>
        <div className="icon-shell">
          <BrainCircuit className="h-5 w-5 text-plasma" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-4">
        <p className="diagnostic-summary">{summary}</p>

        {suspects.map((item, index) => {
          const Icon = suspectIcons[item.id] ?? BrainCircuit;

          return (
            <motion.div
              className="diagnostic-row"
              key={item.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 + index * 0.08 }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-ion" aria-hidden="true" />
                  <span className="truncate text-sm font-semibold text-slate-100">{item.name}</span>
                </div>
                <strong className="text-sm text-ion">{item.probability}%</strong>
              </div>
              <div className="bar-track" aria-label={`${item.name} probability ${item.probability}%`}>
                <motion.div
                  className="bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${item.probability}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 + index * 0.1 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.aside>
  );
}
