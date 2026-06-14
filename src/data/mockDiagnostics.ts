import {
  Activity,
  Binary,
  Cpu,
  Gauge,
  type LucideIcon,
  Microchip,
  RadioTower,
  ShieldAlert,
  Zap,
} from 'lucide-react';

export type MonitorMetric = {
  label: string;
  value: string;
  accent: 'cyan' | 'violet' | 'blue' | 'green' | 'amber';
};

export type DiagnosticItem = {
  name: string;
  probability: number;
  icon: LucideIcon;
};

export type SignatureCard = {
  name: string;
  description: string;
  icon: LucideIcon;
  accent: 'cyan' | 'violet' | 'blue' | 'green' | 'amber';
};

export type LogLine = {
  level: 'SCAN' | 'WARN' | 'AI';
  message: string;
};

export const monitorMetrics: MonitorMetric[] = [
  { label: 'Board Health', value: '87%', accent: 'green' },
  { label: 'Detected Voltage', value: '3.32 V', accent: 'cyan' },
  { label: 'Current Draw', value: '0.41 A', accent: 'blue' },
  { label: 'Estimated Resistance', value: '8.1 Ohm', accent: 'violet' },
  { label: 'Short Status', value: 'No hard short', accent: 'green' },
];

export const diagnosticRanking: DiagnosticItem[] = [
  { name: 'Firmware SPI', probability: 82, icon: Binary },
  { name: 'Clock/Reset', probability: 68, icon: RadioTower },
  { name: 'Buck Converter', probability: 54, icon: Zap },
  { name: 'CPU Boot Failure', probability: 41, icon: Cpu },
];

export const signatureCards: SignatureCard[] = [
  {
    name: 'Buck Converter',
    description: 'Switching rail pattern',
    icon: Zap,
    accent: 'cyan',
  },
  {
    name: 'LDO Regulator',
    description: 'Linear dropout profile',
    icon: Gauge,
    accent: 'blue',
  },
  {
    name: 'SPI Flash',
    description: 'Boot ROM signature',
    icon: Binary,
    accent: 'violet',
  },
  {
    name: 'MOSFET',
    description: 'Gate-source response',
    icon: ShieldAlert,
    accent: 'amber',
  },
  {
    name: 'CPU Boot',
    description: 'Core bring-up trace',
    icon: Cpu,
    accent: 'green',
  },
  {
    name: 'Short Detection',
    description: 'Rail-to-ground sweep',
    icon: Activity,
    accent: 'cyan',
  },
];

export const terminalLogs: LogLine[] = [
  { level: 'SCAN', message: '3.3V rail detected' },
  { level: 'SCAN', message: '1.2V core rail detected' },
  { level: 'WARN', message: 'PFC command absent' },
  { level: 'AI', message: 'Firmware SPI suspected' },
];

export const primaryChipIcon = Microchip;
