export const componentProfiles = [
  {
    id: 'buck',
    name: 'Conversor Buck',
    expectedInputs: ['VIN', 'ENABLE'],
    expectedOutputs: ['VOUT', 'SW'],
    commonFailures: ['CI PWM', 'MOSFET', 'bobina', 'curto na saída'],
  },
  {
    id: 'ldo',
    name: 'Regulador LDO',
    expectedInputs: ['VIN', 'ENABLE opcional'],
    expectedOutputs: ['VOUT'],
    commonFailures: ['LDO danificado', 'curto na saída', 'enable ausente'],
  },
  {
    id: 'spi_flash',
    name: 'Memória SPI',
    expectedInputs: ['VCC', 'CS', 'CLK', 'DATA'],
    expectedOutputs: ['resposta MISO'],
    commonFailures: ['firmware corrompido', 'clock ausente', 'reset travado'],
  },
  {
    id: 'cpu_boot',
    name: 'Cadeia de boot da CPU',
    expectedInputs: ['tensões principais', 'reset liberado', 'clock válido', 'SPI ativa'],
    expectedOutputs: ['sequência de controle', 'atividade térmica inicial'],
    commonFailures: ['reset', 'clock', 'firmware', 'alimentação secundária'],
  },
];
