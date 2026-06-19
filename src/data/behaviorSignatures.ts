import type { BehaviorSignature } from '../types/behaviors';

export const behaviorSignatures: BehaviorSignature[] = [
  {
    id: 'buck-no-enable',
    name: 'Buck sem enable',
    category: 'regulator',
    description: 'VIN está presente, mas o buck não recebe comando de habilitação e a saída permanece ausente.',
    expectedConditions: [
      { id: 'buck-vin-present', description: 'VIN presente', state: 'voltage_present', nodeIncludes: ['vin'], strength: 'strong', required: true },
    ],
    failureConditions: [
      { id: 'buck-enable-absent', description: 'ENABLE ausente', state: 'signal_absent', nodeIncludes: ['enable'], strength: 'strong', required: true },
      { id: 'buck-vout-absent', description: 'VOUT ausente', state: 'voltage_absent', nodeIncludes: ['vout'], strength: 'medium', required: true },
    ],
    suspects: [
      { id: 'buck_controller', title: 'Controlador Buck', category: 'regulator', description: 'CI controlador sem habilitação válida.' },
      { id: 'ec_sio', title: 'EC/SIO', category: 'control', description: 'Controlador de sequência não libera enable.' },
      { id: 'enable_line', title: 'Linha enable', category: 'control', description: 'Linha de habilitação aberta, travada ou sem comando.' },
      { id: 'pullup_resistor', title: 'Resistor pull-up', category: 'control', description: 'Pull-up ausente ou alterado na linha enable.' },
    ],
    nextTests: [
      { id: 'measure-buck-enable', title: 'Medir enable no CI.', description: 'Medir o nível lógico de enable diretamente no controlador buck.', priority: 1, expectedResult: 'Enable deve chegar em nível lógico válido.' },
      { id: 'trace-enable-line', title: 'Seguir trilha enable.', description: 'Rastrear a linha de enable até o controlador de origem.', priority: 2 },
      { id: 'check-pullup', title: 'Verificar resistor de pull-up.', description: 'Medir o pull-up da linha enable e conferir se há interrupção.', priority: 2 },
      { id: 'check-controller-command', title: 'Verificar comando vindo do controlador.', description: 'Confirmar se EC/SIO ou lógica equivalente libera o comando.', priority: 3 },
    ],
    severity: 'high',
  },
  {
    id: 'buck-vin-enable-no-output',
    name: 'Buck com VIN e enable, mas sem saída',
    category: 'regulator',
    description: 'Entrada e enable estão presentes, mas o buck não gera VOUT.',
    expectedConditions: [
      { id: 'buck-vin-valid', description: 'VIN presente', state: 'voltage_present', nodeIncludes: ['vin'], strength: 'strong', required: true },
      { id: 'buck-enable-valid', description: 'ENABLE presente', state: 'signal_present', nodeIncludes: ['enable'], strength: 'strong', required: true },
    ],
    failureConditions: [
      { id: 'buck-output-missing', description: 'VOUT ausente', state: 'voltage_absent', nodeIncludes: ['vout'], strength: 'strong', required: true },
    ],
    suspects: [
      { id: 'buck_pwm', title: 'CI PWM', category: 'regulator', description: 'PWM não chaveia apesar das condições de entrada.' },
      { id: 'buck_mosfet', title: 'MOSFET', category: 'regulator', description: 'MOSFET aberto, em curto ou sem gate válido.' },
      { id: 'buck_inductor', title: 'Bobina', category: 'regulator', description: 'Bobina aberta ou trilha interrompida.' },
      { id: 'buck_output_short', title: 'Curto na saída', category: 'short', description: 'Curto posterior bloqueia a subida do VOUT.' },
    ],
    nextTests: [
      { id: 'measure-buck-output-resistance', title: 'Medir resistência da saída para GND.', description: 'Verificar se VOUT está em curto antes de trocar o CI.', priority: 1 },
      { id: 'check-mosfet-gate', title: 'Verificar gate dos MOSFETs.', description: 'Medir atividade nos gates do estágio buck.', priority: 2 },
      { id: 'check-heating', title: 'Verificar aquecimento.', description: 'Procurar componente aquecendo no estágio ou na carga.', priority: 2 },
      { id: 'test-inductor', title: 'Testar bobina.', description: 'Conferir continuidade da bobina e soldas associadas.', priority: 3 },
    ],
    severity: 'high',
  },
  {
    id: 'ldo-no-output',
    name: 'LDO sem saída',
    category: 'regulator',
    description: 'LDO recebe entrada, mas não entrega tensão regulada.',
    expectedConditions: [
      { id: 'ldo-vin-present', description: 'VIN presente', state: 'voltage_present', nodeIncludes: ['input'], strength: 'strong', required: true },
    ],
    failureConditions: [
      { id: 'ldo-vout-absent', description: 'VOUT ausente', state: 'voltage_absent', nodeIncludes: ['output'], strength: 'strong', required: true },
    ],
    suspects: [
      { id: 'ldo_damaged', title: 'LDO danificado', category: 'regulator', description: 'Regulador não entrega saída apesar da entrada.' },
      { id: 'ldo_output_short', title: 'Curto na saída', category: 'short', description: 'Carga posterior pode derrubar a saída.' },
      { id: 'ldo_enable_absent', title: 'Enable ausente', category: 'control', description: 'LDO pode depender de habilitação externa.' },
    ],
    nextTests: [
      { id: 'measure-ldo-enable', title: 'Medir enable.', description: 'Confirmar se o pino enable do LDO está em nível válido.', priority: 1 },
      { id: 'measure-ldo-output-resistance', title: 'Medir resistência da saída.', description: 'Conferir resistência da saída do LDO para GND.', priority: 1 },
      { id: 'inspect-ldo-heating', title: 'Verificar aquecimento.', description: 'Checar aquecimento no LDO e na carga alimentada.', priority: 2 },
    ],
    severity: 'high',
  },
  {
    id: 'shorted-rail',
    name: 'Linha em curto',
    category: 'short',
    description: 'Linha apresenta baixa resistência para GND e/ou corrente alta em injeção.',
    expectedConditions: [],
    failureConditions: [
      { id: 'low-resistance-to-ground', description: 'Resistência muito baixa para GND', state: 'low_resistance', strength: 'strong', required: true },
      { id: 'high-injection-current', description: 'Corrente alta em injeção', state: 'current_high', strength: 'strong' },
    ],
    suspects: [
      { id: 'shorted_capacitor', title: 'Capacitor em curto', category: 'short', description: 'Capacitor na linha pode estar em curto.' },
      { id: 'shorted_powered_ic', title: 'CI alimentado em curto', category: 'short', description: 'CI consumidor pode estar derrubando a linha.' },
      { id: 'shorted_mosfet', title: 'MOSFET em curto', category: 'short', description: 'MOSFET pode estar curto entre terminais.' },
    ],
    nextTests: [
      { id: 'limited-injection', title: 'Injeção de tensão limitada.', description: 'Injetar tensão com corrente limitada no trilho suspeito.', priority: 1, safetyNote: 'Usar tensão baixa e limite de corrente antes de aumentar.' },
      { id: 'thermal-search', title: 'Busca térmica.', description: 'Procurar o componente que aquece primeiro.', priority: 1 },
      { id: 'isopropyl-check', title: 'Álcool/isopropílico.', description: 'Usar evaporação controlada para localizar aquecimento.', priority: 2, safetyNote: 'Aplicar com a placa desenergizada e evitar excesso.' },
      { id: 'thermal-camera', title: 'Câmera térmica se existir.', description: 'Confirmar o ponto quente com câmera térmica.', priority: 3 },
    ],
    severity: 'critical',
  },
  {
    id: 'spi-powered-no-boot',
    name: 'SPI alimentada sem boot',
    category: 'firmware',
    description: 'SPI VCC está presente, mas o processador não progride no boot.',
    expectedConditions: [
      { id: 'spi-vcc-present', description: 'SPI VCC presente', state: 'voltage_present', measurementIds: ['spi_vcc'], strength: 'strong', required: true },
    ],
    failureConditions: [
      { id: 'cpu-no-boot', description: 'CPU sem inicialização', state: 'temperature_cold', measurementIds: ['cpu_temperature'], strength: 'medium', required: true },
      { id: 'clock-reset-suspect', description: 'Clock/Reset suspeitos', symptomIncludes: ['clock', 'reset'], strength: 'weak' },
    ],
    suspects: [
      { id: 'firmware_spi', title: 'Firmware SPI', category: 'firmware', description: 'Imagem SPI ausente, corrompida ou sem transação válida.' },
      { id: 'reset', title: 'Reset', category: 'timing', description: 'Reset travado impede execução do firmware.' },
      { id: 'clock', title: 'Clock', category: 'timing', description: 'Ausência de clock impede boot.' },
      { id: 'cpu_pch', title: 'CPU/PCH', category: 'boot', description: 'Processador ou ponte não progride após alimentação.' },
    ],
    nextTests: [
      { id: 'measure-clock', title: 'Medir relógio/cristal.', description: 'Medir cristal/clock do processador.', priority: 1 },
      { id: 'measure-reset', title: 'Medir reset.', description: 'Verificar se reset é liberado na partida.', priority: 1 },
      { id: 'check-spi-bus', title: 'Verificar CS/CLK/Data.', description: 'Conferir atividade SPI em CS, CLK e DATA.', priority: 2 },
      { id: 'reflash-firmware', title: 'Regravar firmware se aplicável.', description: 'Ler, comparar e regravar a SPI quando o barramento justificar.', priority: 3 },
    ],
    severity: 'high',
  },
  {
    id: 'cpu-no-activity',
    name: 'CPU sem atividade',
    category: 'boot',
    description: 'Tensões principais existem, mas CPU permanece fria e sem sinais de boot.',
    expectedConditions: [
      { id: 'main-rails-present', description: 'Tensões principais presentes', state: 'voltage_present', measurementIds: ['rail_3v3', 'rail_1v2'], strength: 'medium', required: true },
    ],
    failureConditions: [
      { id: 'cpu-cold', description: 'CPU fria', state: 'temperature_cold', measurementIds: ['cpu_temperature'], strength: 'medium', required: true },
      { id: 'boot-signals-absent', description: 'Sem sinais de boot', state: 'signal_absent', measurementIds: ['pfc_pctl'], strength: 'weak' },
    ],
    suspects: [
      { id: 'reset', title: 'Reset', category: 'timing', description: 'Reset não liberado mantém CPU parada.' },
      { id: 'clock', title: 'Clock', category: 'timing', description: 'Clock ausente impede atividade.' },
      { id: 'firmware', title: 'Firmware', category: 'firmware', description: 'Firmware pode não iniciar a sequência.' },
      { id: 'secondary_power_missing', title: 'Alimentação secundária ausente', category: 'power', description: 'Uma alimentação posterior pode estar bloqueada.' },
    ],
    nextTests: [
      { id: 'cpu-reset', title: 'Medir RESET da CPU.', description: 'Verificar se RESET sobe durante a sequência de power.', priority: 1 },
      { id: 'cpu-clock', title: 'Medir cristal/clock.', description: 'Conferir clock principal do processador.', priority: 1 },
      { id: 'secondary-rails', title: 'Medir tensões secundárias.', description: 'Mapear trilhos secundários liberados após standby.', priority: 2 },
      { id: 'verify-spi', title: 'Verificar SPI.', description: 'Confirmar VCC e atividade no barramento SPI.', priority: 2 },
    ],
    severity: 'high',
  },
  {
    id: 'forced-command-functional-source',
    name: 'Fonte funcional com comando forçado',
    category: 'control',
    description: 'Saída ausente no modo normal aparece quando o comando de controle é forçado.',
    expectedConditions: [
      { id: 'forced-output-present', description: 'Saída aparece com comando forçado', state: 'forced_command_active', measurementIds: ['rail_12v_forced'], strength: 'strong', required: true },
    ],
    failureConditions: [
      { id: 'normal-output-absent', description: 'Saída ausente no modo normal', state: 'voltage_absent', measurementIds: ['rail_12v_initial'], strength: 'strong', required: true },
    ],
    suspects: [
      { id: 'main_board', title: 'Placa principal', category: 'control', description: 'Placa principal não libera comando.' },
      { id: 'power_command', title: 'Comando power', category: 'control', description: 'Linha de comando não muda de estado.' },
      { id: 'control_logic', title: 'Lógica de controle', category: 'control', description: 'Sequência lógica falha antes de liberar a fonte.' },
      { id: 'firmware', title: 'Firmware', category: 'firmware', description: 'Firmware pode travar a sequência de power.' },
    ],
    nextTests: [
      { id: 'trace-command-line', title: 'Seguir linha de comando.', description: 'Rastrear PFC_PCTL até a placa principal.', priority: 1 },
      { id: 'measure-logic-level', title: 'Medir nível lógico.', description: 'Medir nível lógico do comando durante power-on.', priority: 1 },
      { id: 'power-sequence', title: 'Verificar sequência de power.', description: 'Comparar tempos de liberação dos trilhos.', priority: 2 },
      { id: 'control-processor', title: 'Investigar processador/controle.', description: 'Verificar se o controlador executa a sequência inicial.', priority: 3 },
    ],
    severity: 'high',
  },
];
