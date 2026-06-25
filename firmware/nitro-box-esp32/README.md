# Nitro Box ESP32 - teste serial inicial

Firmware inicial para provar comunicacao USB/Serial entre o Nitro Scan e a ESP32.

## Arduino IDE

- Placa: ESP32 Dev Module
- Baud rate do monitor serial: 115200
- Porta no Linux: geralmente `/dev/ttyUSB0`, mas pode variar
- No Windows/macOS, selecione a porta serial exibida pela Arduino IDE

Abra `nitro_box_esp32.ino`, selecione a placa ESP32 Dev Module e grave na ESP32.

## Primeiro teste

1. Abra o Nitro Scan no navegador.
2. Clique em `Conectar Nitro Box`.
3. Selecione a porta da ESP32.
4. Clique em `Testar comunicacao`.
5. O log esperado e: `Nitro Box respondeu: online.`

## Comandos JSON aceitos

Cada comando deve terminar com `\n`.

```json
{"type":"nitro_command","command":"ping"}
{"type":"nitro_command","command":"heartbeat","timestamp":123456}
{"type":"nitro_command","command":"pre_scan","mode":"one_point_scan","point":"VIN"}
{"type":"nitro_command","command":"test_cutoff_close"}
{"type":"nitro_command","command":"test_cutoff_open"}
{"type":"nitro_command","command":"stop"}
{"type":"nitro_command","command":"emergency_stop"}
```

Nesta etapa, `inject_low`, `inject_sine`, `read_impedance` e `read_response` nao acionam GPIO nem circuito real. A Nitro Box responde como comando bloqueado porque o hardware de potencia ainda nao esta conectado.

## Teste do LED no GPIO26

Este teste simula o futuro MOSFET de corte usando apenas um LED.

Ligacao:

- `P26 / GPIO26` -> resistor `1K` -> perna maior do LED
- perna menor do LED -> `GND`

Resultado esperado:

- ao ligar a ESP32: LED apagado;
- `Testar Corte ON`: LED acende;
- `Testar Corte OFF`: LED apaga;
- `Parada`: LED apaga;
- `heartbeat_timeout`: LED apaga sozinho.

Nao ligar placa real, fonte externa, bateria ou ponta ativa neste teste. Use somente LED, resistor 1K e GND.

## Heartbeat de seguranca

O software envia `heartbeat` a cada 500 ms quando a Nitro Box esta conectada.

Se o firmware parar de receber heartbeat por mais de 1000 ms:

- `cutoffState` volta para `open`;
- `safetyState` vira `emergency_stop`;
- GPIO26 vai para LOW;
- a ESP32 envia `heartbeat_timeout`.

Isso simula o futuro corte fisico de seguranca do MOSFET.
