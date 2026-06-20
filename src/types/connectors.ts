export type ConnectorType =
  | 'dc_jack'
  | 'usb_c_charge'
  | 'battery_connector'
  | 'power_connector'
  | 'signal_flex'
  | 'probe'
  | 'other_board_connector';

export type ConnectorProfile = {
  type: ConnectorType;
  label: string;
  description: string;
  focusLines: string[];
  commonRisks: string[];
  suggestedTests: string[];
};
