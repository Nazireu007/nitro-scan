import { motion } from 'framer-motion';
import { Cpu, RadioTower, ScanLine, Zap } from 'lucide-react';

const pinIndexes = Array.from({ length: 14 }, (_, index) => index);

// CentralChip module: visual diagnostic target with animated buses and scan energy.
export function CentralChip() {
  return (
    <motion.section
      className="central-stage relative min-h-[420px] overflow-hidden rounded-lg"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.75, ease: 'easeOut', delay: 0.15 }}
      aria-label="Animated board visualization"
    >
      <div className="circuit-grid" aria-hidden="true" />
      <div className="signal-line signal-line-left" aria-hidden="true" />
      <div className="signal-line signal-line-right" aria-hidden="true" />
      <div className="signal-line signal-line-top" aria-hidden="true" />
      <div className="signal-line signal-line-bottom" aria-hidden="true" />

      <div className="floating-module module-voltage">
        <Zap className="h-4 w-4 text-warning" aria-hidden="true" />
        <span>3.3V Rail</span>
      </div>
      <div className="floating-module module-clock">
        <RadioTower className="h-4 w-4 text-ion" aria-hidden="true" />
        <span>Clock Sync</span>
      </div>
      <div className="floating-module module-scan">
        <ScanLine className="h-4 w-4 text-plasma" aria-hidden="true" />
        <span>AI Trace</span>
      </div>

      <motion.div
        className="chip-perspective"
        animate={{
          y: [0, -8, 0],
          rotateX: [62, 58, 62],
          rotateZ: [-7, -4, -7],
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="chip-board">
          <div className="chip-glow" aria-hidden="true" />
          {pinIndexes.map((index) => (
            <span
              className="chip-pin chip-pin-top"
              key={`top-${index}`}
              style={{ left: `${8 + index * 6.5}%` }}
            />
          ))}
          {pinIndexes.map((index) => (
            <span
              className="chip-pin chip-pin-bottom"
              key={`bottom-${index}`}
              style={{ left: `${8 + index * 6.5}%` }}
            />
          ))}
          {pinIndexes.slice(0, 10).map((index) => (
            <span
              className="chip-pin chip-pin-left"
              key={`left-${index}`}
              style={{ top: `${10 + index * 8}%` }}
            />
          ))}
          {pinIndexes.slice(0, 10).map((index) => (
            <span
              className="chip-pin chip-pin-right"
              key={`right-${index}`}
              style={{ top: `${10 + index * 8}%` }}
            />
          ))}

          <div className="chip-core">
            <Cpu className="h-14 w-14 text-ion" aria-hidden="true" />
            <span>NXS-01</span>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
