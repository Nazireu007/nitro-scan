import { motion } from 'framer-motion';
import { Activity, Cpu, Gauge, Waves } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MonitorMetric } from '../engine/types';

const accentClass = {
  cyan: 'text-ion',
  violet: 'text-plasma',
  blue: 'text-pulse',
  green: 'text-cyan-200',
  amber: 'text-warning',
};

const metricLabel = {
  'Board Health': 'Saúde',
  'Detected Voltage': 'Tensão',
  'Current Draw': 'Corrente',
  'Estimated Resistance': 'Resistência',
  'Short Status': 'Resumo',
};

type SystemMonitorProps = {
  healthPercentage: number;
  metrics: MonitorMetric[];
};

function getMetric(metrics: MonitorMetric[], label: string): MonitorMetric {
  return metrics.find((metric) => metric.label === label) ?? { label, value: 'n/a', accent: 'cyan' };
}

function numericValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : 0;
}

function visualProgress(metric: MonitorMetric, healthPercentage: number): number {
  if (metric.label === 'Board Health') {
    return healthPercentage;
  }

  if (metric.label === 'Detected Voltage') {
    return Math.min(100, Math.max(8, (numericValue(metric.value) / 15) * 100));
  }

  if (metric.label === 'Current Draw') {
    return Math.min(100, Math.max(8, (numericValue(metric.value) / 3) * 100));
  }

  if (metric.label === 'Estimated Resistance') {
    return Math.min(100, Math.max(8, (numericValue(metric.value) / 25) * 100));
  }

  return metric.value.toLowerCase().includes('probable') ? 32 : 82;
}

// SystemMonitor module: compact electrical telemetry for the selected diagnostic scenario.
export function SystemMonitor({ healthPercentage, metrics }: SystemMonitorProps) {
  const healthMetric = getMetric(metrics, 'Board Health');
  const voltageMetric = getMetric(metrics, 'Detected Voltage');
  const currentMetric = getMetric(metrics, 'Current Draw');
  const resistanceMetric = getMetric(metrics, 'Estimated Resistance');
  const summaryMetric = getMetric(metrics, 'Short Status');
  const hudIndicators = [healthMetric, voltageMetric, currentMetric, resistanceMetric];

  return (
    <motion.aside
      className="panel-glass scan-panel system-monitor-card h-full p-4"
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.65, ease: 'easeOut', delay: 0.1 }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Telemetry</p>
          <h2 className="panel-title">Monitor do sistema</h2>
        </div>
        <div className="icon-shell">
          <Gauge className="h-5 w-5 text-ion" aria-hidden="true" />
        </div>
      </div>

      <div className="monitor-hud">
        <div className="processor-stage" aria-label="Processador central do monitor">
          <div className="processor-trace trace-top" aria-hidden="true" />
          <div className="processor-trace trace-right" aria-hidden="true" />
          <div className="processor-trace trace-bottom" aria-hidden="true" />
          <div className="processor-trace trace-left" aria-hidden="true" />

          <div className="processor-node processor-node-voltage">
            <span>{metricLabel[voltageMetric.label as keyof typeof metricLabel]}</span>
            <strong>{voltageMetric.value}</strong>
          </div>
          <div className="processor-node processor-node-current">
            <span>{metricLabel[currentMetric.label as keyof typeof metricLabel]}</span>
            <strong>{currentMetric.value}</strong>
          </div>
          <div className="processor-node processor-node-health">
            <span>{metricLabel[healthMetric.label as keyof typeof metricLabel]}</span>
            <strong>{healthPercentage}%</strong>
          </div>
          <div className="processor-node processor-node-resistance">
            <span>{metricLabel[resistanceMetric.label as keyof typeof metricLabel]}</span>
            <strong>{resistanceMetric.value}</strong>
          </div>

          <div className="processor-chip">
            <span className="processor-chip-grid" aria-hidden="true" />
            <Cpu className="h-9 w-9 text-ion" aria-hidden="true" />
            <strong>NITRO</strong>
            <small>Telemetry Core</small>
          </div>
        </div>

        <div className="monitor-waveform" aria-label="Linha de sinal do monitor">
          <Waves className="h-4 w-4 text-pulse" aria-hidden="true" />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {metrics.map((metric, index) => (
          <motion.div
            className="metric-row metric-hud-row"
            key={metric.label}
            style={
              {
                '--metric-fill': `${visualProgress(metric, healthPercentage)}%`,
                '--metric-delay': `${index * 0.18}s`,
              } as CSSProperties
            }
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.18 + index * 0.06 }}
          >
            <div className="metric-hud-meta">
              <div className="flex items-center gap-2">
                <Activity className={`h-4 w-4 ${accentClass[metric.accent]}`} aria-hidden="true" />
                <span>{metricLabel[metric.label as keyof typeof metricLabel] ?? metric.label}</span>
              </div>
              <strong className={accentClass[metric.accent]}>{metric.value}</strong>
            </div>
            <div className="metric-hud-bar" aria-hidden="true">
              <span />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="monitor-summary">
        <span>Resumo</span>
        <strong>{summaryMetric.value}</strong>
      </div>
    </motion.aside>
  );
}
