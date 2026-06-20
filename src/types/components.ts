import type { NextTest } from './diagnostics';
import type { ConfirmationState } from './confirmation';

export type ComponentType =
  | 'capacitor'
  | 'mosfet'
  | 'diode'
  | 'resistor'
  | 'inductor'
  | 'ldo'
  | 'buck_controller'
  | 'pwm_controller'
  | 'spi_flash'
  | 'cpu'
  | 'unknown_ic';

export type ComponentFindingStatus =
  | 'normal'
  | 'low_impedance'
  | 'short_detected'
  | 'open_path'
  | 'abnormal_junction'
  | 'thermal_response'
  | 'isolated_fault'
  | 'inconclusive';

export type ComponentFinding = {
  id: string;
  componentType: ComponentType;
  componentLabel: string;
  lineName: string;
  status: ComponentFindingStatus;
  confidence: number;
  confirmationState: ConfirmationState;
  evidences: string[];
  nextTests: NextTest[];
};

export type ComponentFailureSignature = {
  id: string;
  componentType: ComponentType;
  title: string;
  triggerPatterns: string[];
  correlatedPatterns: string[];
  confirmationPatterns: string[];
  suspects: string[];
  nextTests: string[];
};
