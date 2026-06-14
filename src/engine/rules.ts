import type { DiagnosticScenario, Measurement, Rule } from './types';

const presentStatuses = new Set<Measurement['status']>(['present', 'forced-active', 'ok']);
const absentStatuses = new Set<Measurement['status']>(['absent', 'dead']);

function byId(scenario: DiagnosticScenario, id: string | undefined): Measurement | undefined {
  if (!id) {
    return undefined;
  }

  return scenario.measurements.find((measurement) => measurement.id === id);
}

function isPresent(measurement: Measurement | undefined): boolean {
  return Boolean(measurement && presentStatuses.has(measurement.status));
}

function isAbsent(measurement: Measurement | undefined): boolean {
  return Boolean(measurement && absentStatuses.has(measurement.status));
}

function isLowResistance(measurement: Measurement | undefined): boolean {
  return measurement?.kind === 'resistance' && typeof measurement.value === 'number' && measurement.value < 2;
}

function isHighCurrent(measurement: Measurement | undefined): boolean {
  return measurement?.kind === 'current' && (measurement.status === 'high' || Number(measurement.value) >= 1.5);
}

function isLowVoltage(measurement: Measurement | undefined): boolean {
  return measurement?.kind === 'voltage' && (measurement.status === 'low' || Number(measurement.value) <= 0.5);
}

function measurementLabel(measurement: Measurement | undefined): string {
  if (!measurement) {
    return 'unknown measurement';
  }

  if (typeof measurement.value === 'number' && measurement.unit) {
    return `${measurement.label}: ${measurement.value}${measurement.unit}`;
  }

  return measurement.label;
}

export const rules: Rule[] = [
  {
    id: 'forced-command-validates-source',
    name: 'Forced command validates power source',
    description: 'If a source rail appears when the command is forced, classify the source as functional.',
    evaluate: (scenario) => {
      const initial12v = byId(scenario, 'rail_12v_initial');
      const forced12v = byId(scenario, 'rail_12v_forced');

      if (!isAbsent(initial12v) || forced12v?.status !== 'forced-active') {
        return null;
      }

      return {
        evidence: [
          {
            id: 'source-responds-to-forced-pfc',
            severity: 'OK',
            title: 'Power supply responds to forced command',
            detail: '12V is absent at first, then rises when PFC_PCTL is forced. The power stage can generate the rail.',
            sourceRuleId: 'forced-command-validates-source',
          },
        ],
        conclusions: ['Power supply classified as functional under forced-command test.'],
        nextTests: ['Trace why the main board is not releasing PFC_PCTL during normal boot.'],
        logs: [
          { level: 'TEST', message: 'PFC_PCTL forced -> 12V rail active' },
          { level: 'AI', message: 'Power supply classified as functional' },
        ],
      };
    },
  },
  {
    id: 'logic-rails-present-cpu-no-boot',
    name: 'Logic rails present with cold CPU',
    description: 'If 3.3V and 1.2V rails exist but CPU stays cold and no commands are released, raise boot-chain suspects.',
    evaluate: (scenario) => {
      const rail3v3 = byId(scenario, 'rail_3v3');
      const rail1v2 = byId(scenario, 'rail_1v2');
      const cpuTemperature = byId(scenario, 'cpu_temperature');
      const pfcCommand = byId(scenario, 'pfc_pctl');

      if (!isPresent(rail3v3) || !isPresent(rail1v2) || cpuTemperature?.status !== 'cold' || !isAbsent(pfcCommand)) {
        return null;
      }

      return {
        evidence: [
          {
            id: 'cpu-rails-present-cpu-cold',
            severity: 'WARN',
            title: 'Core rails present, CPU remains inactive',
            detail: '3.3V and 1.2V are present, but CPU thermal response is cold and PFC_PCTL is not released.',
            sourceRuleId: 'logic-rails-present-cpu-no-boot',
          },
        ],
        suspectScores: [
          {
            id: 'firmware_spi',
            name: 'Firmware SPI',
            category: 'firmware',
            score: 28,
            reason: 'Powered boot chain does not execute enough to release control signals.',
          },
          {
            id: 'clock_reset',
            name: 'Clock/Reset',
            category: 'timing',
            score: 24,
            reason: 'CPU rails are alive but the processor does not leave early boot state.',
          },
          {
            id: 'cpu_boot_failure',
            name: 'CPU Boot Failure',
            category: 'logic',
            score: 18,
            reason: 'CPU remains cold while required logic rails are present.',
          },
        ],
        conclusions: ['Main board is not initializing the boot/control sequence.'],
        nextTests: [
          'Probe crystal/clock activity at the CPU.',
          'Check reset line release during power-on.',
          'Read or reflash the SPI firmware image.',
        ],
        logs: [{ level: 'WARN', message: 'Main board not releasing enable signals' }],
      };
    },
  },
  {
    id: 'regulator-input-enable-no-output',
    name: 'Regulator has input and enable but no output',
    description: 'If VIN and ENABLE are present, VOUT is absent, and no short exists, suspect the regulator stage.',
    evaluate: (scenario) => {
      const matches = scenario.boardLines
        .filter((line) => line.topology === 'buck' || line.topology === 'ldo')
        .map((line) => {
          const input = byId(scenario, line.inputMeasurementId);
          const enable = byId(scenario, line.enableMeasurementId);
          const output = byId(scenario, line.outputMeasurementId);
          const resistance = byId(scenario, line.resistanceMeasurementId);

          return { line, input, enable, output, resistance };
        })
        .filter(({ input, enable, output, resistance }) => {
          const noShort = !isLowResistance(resistance);

          return isPresent(input) && isPresent(enable) && isAbsent(output) && noShort;
        });

      if (matches.length === 0) {
        return null;
      }

      const evidence = matches.map(({ line, input, enable, output, resistance }) => ({
        id: `${line.id}-input-enable-no-output`,
        severity: 'FAIL' as const,
        title: `${line.name} is not regulating`,
        detail: `${measurementLabel(input)} and ${measurementLabel(enable)} are valid, but ${measurementLabel(
          output,
        )} is missing with ${measurementLabel(resistance)}.`,
        sourceRuleId: 'regulator-input-enable-no-output',
      }));

      const suspectScores = matches.map(({ line }) => {
        const isBuck = line.topology === 'buck';

        return {
          id: isBuck ? 'buck_converter' : 'ldo_regulator',
          name: isBuck ? 'Buck Converter' : 'LDO Regulator',
          category: 'regulator' as const,
          score: isBuck ? 78 : 76,
          reason: `${line.name} has valid input and enable but does not produce output.`,
        };
      });

      return {
        evidence,
        suspectScores,
        conclusions: matches.map(({ line }) => `${line.name} is the primary suspect.`),
        nextTests: matches.map(({ line }) => `Check ${line.name} feedback path, switching/regulation pin and output capacitor ESR.`),
        logs: matches.map(({ line }) => ({ level: 'AI' as const, message: `${line.name} suspected` })),
      };
    },
  },
  {
    id: 'shorted-rail-detection',
    name: 'Shorted rail detection',
    description: 'If resistance is below 2 ohms, or current is high while voltage collapses, flag a probable short.',
    evaluate: (scenario) => {
      const shortLines = scenario.boardLines.filter((line) => {
        const resistance = byId(scenario, line.resistanceMeasurementId);
        const current = byId(scenario, line.currentMeasurementId);
        const voltage = byId(scenario, line.voltageMeasurementId);

        return isLowResistance(resistance) || (isHighCurrent(current) && isLowVoltage(voltage));
      });

      if (shortLines.length === 0) {
        return null;
      }

      return {
        evidence: shortLines.map((line) => ({
          id: `${line.id}-probable-short`,
          severity: 'FAIL',
          title: `${line.name} has short-like behavior`,
          detail: 'Low resistance and/or high current with collapsing voltage indicates a probable short on the rail.',
          sourceRuleId: 'shorted-rail-detection',
        })),
        suspectScores: shortLines.map((line) => ({
          id: 'shorted_rail',
          name: 'Shorted Rail',
          category: 'short',
          score: 90,
          reason: `${line.name} meets low-resistance or current-collapse criteria.`,
        })),
        conclusions: ['Probable short detected on the measured rail.'],
        nextTests: [
          'Inject limited current and inspect thermal response.',
          'Isolate downstream capacitors and loads from the collapsed rail.',
          'Measure resistance again after removing suspect load sections.',
        ],
        logs: [{ level: 'FAIL', message: 'Probable short detected on target rail' }],
      };
    },
  },
  {
    id: 'spi-powered-cpu-no-boot',
    name: 'SPI powered with CPU no-boot',
    description: 'If SPI flash is powered and CPU does not boot, raise firmware suspicion.',
    evaluate: (scenario) => {
      const spiPower = byId(scenario, 'spi_vcc');
      const cpuTemperature = byId(scenario, 'cpu_temperature');

      if (!isPresent(spiPower) || cpuTemperature?.status !== 'cold') {
        return null;
      }

      return {
        evidence: [
          {
            id: 'spi-powered-cpu-no-boot',
            severity: 'WARN',
            title: 'SPI flash is powered but boot does not progress',
            detail: 'SPI VCC exists while CPU remains cold, so corrupted firmware or missing SPI transaction is plausible.',
            sourceRuleId: 'spi-powered-cpu-no-boot',
          },
        ],
        suspectScores: [
          {
            id: 'firmware_spi',
            name: 'Firmware SPI',
            category: 'firmware',
            score: 32,
            reason: 'SPI is powered, yet CPU boot activity is absent.',
          },
        ],
        nextTests: ['Capture SPI CLK/CS/MOSI/MISO activity during startup.'],
      };
    },
  },
  {
    id: 'clock-or-reset-stuck',
    name: 'Clock absent or reset stuck',
    description: 'If clock is absent or reset is held, suspect clock/reset subsystem.',
    evaluate: (scenario) => {
      const failedTimingMeasurements = scenario.measurements.filter((measurement) => {
        const normalizedLabel = measurement.label.toLowerCase();
        const isTimingSignal = normalizedLabel.includes('clock') || normalizedLabel.includes('reset');

        return isTimingSignal && (measurement.status === 'absent' || measurement.status === 'dead' || measurement.status === 'low');
      });

      if (failedTimingMeasurements.length === 0) {
        return null;
      }

      return {
        evidence: failedTimingMeasurements.map((measurement) => ({
          id: `${measurement.id}-timing-failure`,
          severity: 'FAIL',
          title: `${measurement.label} is not valid`,
          detail: 'A missing clock or stuck reset can prevent the CPU from executing firmware.',
          sourceRuleId: 'clock-or-reset-stuck',
        })),
        suspectScores: [
          {
            id: 'clock_reset',
            name: 'Clock/Reset',
            category: 'timing',
            score: 72,
            reason: 'Timing/reset signal is absent or stuck.',
          },
        ],
        conclusions: ['Clock/reset chain requires direct probing.'],
        nextTests: ['Measure oscillator output and reset release with an oscilloscope.'],
        logs: [{ level: 'WARN', message: 'Clock/reset anomaly detected' }],
      };
    },
  },
  {
    id: 'secondary-rails-held-by-enable',
    name: 'Secondary rails held by missing enable',
    description: 'If secondary rails do not rise because enable commands are absent, suspect boot or control logic.',
    evaluate: (scenario) => {
      const missingControl = scenario.measurements.filter(
        (measurement) =>
          measurement.kind === 'logic' &&
          (measurement.label.toLowerCase().includes('enable') || measurement.label.toLowerCase().includes('pfc')) &&
          isAbsent(measurement),
      );
      const inactiveSecondary = scenario.measurements.filter(
        (measurement) =>
          measurement.lineId &&
          (measurement.status === 'absent' || measurement.status === 'dead') &&
          scenario.boardLines.some((line) => line.id === measurement.lineId && line.role === 'secondary'),
      );

      if (missingControl.length === 0 || inactiveSecondary.length === 0) {
        return null;
      }

      return {
        evidence: [
          {
            id: 'secondary-held-by-control',
            severity: 'WARN',
            title: 'Secondary rails are blocked by missing command',
            detail: 'At least one secondary rail is inactive while a required enable/control command is absent.',
            sourceRuleId: 'secondary-rails-held-by-enable',
          },
        ],
        suspectScores: [
          {
            id: 'control_logic',
            name: 'Boot/Control Logic',
            category: 'logic',
            score: 42,
            reason: 'Secondary power sequencing is being held by a missing enable command.',
          },
          {
            id: 'cpu_boot_failure',
            name: 'CPU Boot Failure',
            category: 'logic',
            score: 20,
            reason: 'Main controller is not issuing required secondary-rail commands.',
          },
        ],
        nextTests: [
          'Follow enable source back to the controller pin.',
          'Compare power-sequence timing against the service schematic.',
        ],
      };
    },
  },
];
