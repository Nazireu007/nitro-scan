import { connectorProfiles } from '../data/connectorProfiles';
import type { ConnectorProfile } from '../types/connectors';
import type { DiagnosticLog, Evidence, NextTest } from '../types/diagnostics';
import type { OfflineScanInput } from '../types/offlineScan';

export type ConnectorScanResult = {
  profile?: ConnectorProfile;
  evidences: Evidence[];
  nextTests: NextTest[];
  logs: DiagnosticLog[];
};

function evidence(input: OfflineScanInput, profile: ConnectorProfile): Evidence {
  return {
    id: `${input.id}-connector-${profile.type}`,
    level: 'info',
    text: `Origem do teste: ${profile.label}. Foco técnico: ${profile.focusLines.slice(0, 4).join(', ')}.`,
    source: 'runConnectorScan',
    relatedRule: 'connector-scan-model',
    strength: 'weak',
  };
}

function nextTest(input: OfflineScanInput, profile: ConnectorProfile, test: string, index: number): NextTest {
  return {
    id: `${input.id}-connector-${profile.type}-${index}`,
    title: test,
    description: `${profile.description} Aplicar este teste antes de elevar energia na placa.`,
    priority: index + 2,
    safetyNote: index === 0 ? 'Manter placa desligada no pré-scan.' : undefined,
  };
}

export function runConnectorScan(input: OfflineScanInput): ConnectorScanResult {
  const profile = connectorProfiles.find((item) => item.type === input.testOrigin);

  if (!profile) {
    return { evidences: [], nextTests: [], logs: [] };
  }

  return {
    profile,
    evidences: [evidence(input, profile)],
    nextTests: profile.suggestedTests.slice(0, 2).map((test, index) => nextTest(input, profile, test, index)),
    logs: [
      {
        level: 'INFO',
        message: `Modelo de origem carregado: ${profile.label}.`,
        source: 'runConnectorScan',
      },
    ],
  };
}
