import type { Hypothesis, NextTest } from '../types/diagnostics';

function priorityForHypothesis(hypothesis: Hypothesis): number {
  if (hypothesis.id === 'firmware_spi' || hypothesis.id === 'clock_reset') {
    return 1;
  }

  if (hypothesis.id === 'shorted_rail') {
    return 1;
  }

  return hypothesis.confidence >= 50 ? 2 : 3;
}

export function buildNextTests(candidateTests: NextTest[], hypotheses: Hypothesis[]): NextTest[] {
  const hypothesisTests: NextTest[] = hypotheses.flatMap((hypothesis) => {
    if (hypothesis.id === 'firmware_spi') {
      return [
        {
          id: 'spi-vcc-cs-clk-data',
          title: 'Conferir SPI VCC, CS, CLK e DATA.',
          description: 'Verificar alimentação e atividade do barramento SPI durante a partida.',
          priority: priorityForHypothesis(hypothesis),
          expectedResult: 'SPI VCC deve estar presente e CS/CLK/DATA devem apresentar atividade.',
        },
      ];
    }

    if (hypothesis.id === 'clock_reset') {
      return [
        {
          id: 'cpu-reset-clock',
          title: 'Medir RESET da CPU.',
          description: 'Confirmar se RESET é liberado durante a sequência normal.',
          priority: 1,
          expectedResult: 'RESET deve sair do estado travado após estabilização das tensões.',
        },
        {
          id: 'check-crystal-clock',
          title: 'Verificar clock/cristal.',
          description: 'Medir clock principal com osciloscópio.',
          priority: 1,
          expectedResult: 'Cristal/clock deve oscilar de forma estável.',
        },
      ];
    }

    if (hypothesis.id === 'control_logic') {
      return [
        {
          id: 'confirm-pfc-pctl',
          title: 'Confirmar comando PFC_PCTL vindo da placa principal.',
          description: 'Medir PFC_PCTL no power-on e rastrear a origem do comando.',
          priority: 1,
          expectedResult: 'PFC_PCTL deve mudar de nível quando a placa libera a fonte.',
        },
        {
          id: 'compare-power-sequence',
          title: 'Comparar sequência de power.',
          description: 'Comparar 5 V, 14 V, 12 V, 3,3 V, 1,2 V e comandos de controle em ordem temporal.',
          priority: 2,
        },
      ];
    }

    if (hypothesis.id === 'shorted_rail') {
      return [
        {
          id: 'limited-current-injection',
          title: 'Fazer injeção limitada se houver suspeita de curto.',
          description: 'Injetar tensão limitada no trilho suspeito e observar consumo/aquecimento.',
          priority: 1,
          safetyNote: 'Começar com tensão baixa e limite de corrente conservador.',
        },
      ];
    }

    return [];
  });

  return Array.from(
    [...candidateTests, ...hypothesisTests]
      .reduce((map, test) => {
        if (!map.has(test.id)) {
          map.set(test.id, test);
        }

        return map;
      }, new Map<string, NextTest>())
      .values(),
  ).sort((left, right) => left.priority - right.priority);
}

export function toLegacyNextTests(tests: NextTest[]): string[] {
  return tests.map((test) => test.title);
}
