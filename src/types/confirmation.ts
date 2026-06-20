import type { NextTest } from './diagnostics';

export type ConfirmationState = 'detected' | 'correlated' | 'strong_indication' | 'confirmed';

export type ConfirmationDecision = {
  confirmationState: ConfirmationState;
  confidence: number;
  reasons: string[];
  missingProofs: string[];
  nextConfirmationTests: NextTest[];
};
