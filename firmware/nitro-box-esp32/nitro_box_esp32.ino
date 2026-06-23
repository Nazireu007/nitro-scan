const unsigned long HEARTBEAT_TIMEOUT_MS = 1000;
const unsigned long HEARTBEAT_ACK_INTERVAL = 4;

String inputLine = "";
String cutoffState = "open";
String safetyState = "idle";

bool heartbeatActive = false;
unsigned long lastHeartbeatAt = 0;
unsigned long heartbeatCount = 0;

String jsonStringValue(const String& payload, const String& key, const String& fallback = "") {
  String token = "\"" + key + "\"";
  int keyIndex = payload.indexOf(token);
  if (keyIndex < 0) return fallback;

  int colonIndex = payload.indexOf(':', keyIndex + token.length());
  if (colonIndex < 0) return fallback;

  int firstQuote = payload.indexOf('"', colonIndex + 1);
  if (firstQuote < 0) return fallback;

  int secondQuote = payload.indexOf('"', firstQuote + 1);
  if (secondQuote < 0) return fallback;

  return payload.substring(firstQuote + 1, secondQuote);
}

void sendFrame(const String& payload) {
  Serial.println(payload);
}

void sendCommandBlocked(const String& reason) {
  safetyState = "blocked";
  cutoffState = "open";
  sendFrame("{\"type\":\"nitro_frame\",\"event\":\"command_blocked\",\"safetyState\":\"blocked\",\"cutoffState\":\"open\",\"reason\":\"" + reason + "\"}");
}

void handlePing() {
  sendFrame("{\"type\":\"nitro_frame\",\"event\":\"pong\",\"hardware\":\"Nitro Box\",\"status\":\"online\"}");
}

void handleHeartbeat() {
  lastHeartbeatAt = millis();
  heartbeatActive = true;
  heartbeatCount++;

  if (heartbeatCount % HEARTBEAT_ACK_INTERVAL == 0) {
    sendFrame("{\"type\":\"nitro_frame\",\"event\":\"heartbeat_ack\",\"safetyState\":\"idle\"}");
  }
}

void handlePreScan(const String& commandLine) {
  String point = jsonStringValue(commandLine, "point", "VIN");
  safetyState = "safe_to_inject";
  cutoffState = "open";

  sendFrame(
    String("{\"type\":\"nitro_frame\",")
    + "\"mode\":\"one_point_scan\","
    + "\"point\":\"" + point + "\","
    + "\"groundDetected\":true,"
    + "\"preScanCompleted\":true,"
    + "\"impedanceOhms\":10000,"
    + "\"safetyState\":\"safe_to_inject\","
    + "\"source\":\"esp32_mock\"}"
  );
}

void handleStop() {
  cutoffState = "open";
  safetyState = "idle";
  heartbeatActive = false;
  sendFrame("{\"type\":\"nitro_frame\",\"event\":\"stop_ack\",\"cutoffState\":\"open\",\"safetyState\":\"idle\"}");
}

void handleEmergencyStop() {
  cutoffState = "open";
  safetyState = "emergency_stop";
  heartbeatActive = false;
  sendFrame("{\"type\":\"nitro_frame\",\"event\":\"emergency_stop_ack\",\"cutoffState\":\"open\",\"safetyState\":\"emergency_stop\"}");
}

void handleReadImpedance() {
  sendCommandBlocked("hardware_stage_not_connected");
}

void handleInjectLow() {
  sendCommandBlocked("hardware_stage_not_connected");
}

void handleInjectSine() {
  sendCommandBlocked("hardware_stage_not_connected");
}

void handleReadResponse() {
  sendCommandBlocked("hardware_stage_not_connected");
}

void handleCommand(const String& commandLine) {
  String command = jsonStringValue(commandLine, "command");

  if (command == "ping") {
    handlePing();
  } else if (command == "heartbeat") {
    handleHeartbeat();
  } else if (command == "pre_scan") {
    handlePreScan(commandLine);
  } else if (command == "stop") {
    handleStop();
  } else if (command == "emergency_stop") {
    handleEmergencyStop();
  } else if (command == "read_impedance") {
    handleReadImpedance();
  } else if (command == "inject_low") {
    handleInjectLow();
  } else if (command == "inject_sine") {
    handleInjectSine();
  } else if (command == "read_response") {
    handleReadResponse();
  } else {
    sendCommandBlocked("unknown_command");
  }
}

void checkHeartbeatWatchdog() {
  if (!heartbeatActive) return;

  if (millis() - lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS) return;

  cutoffState = "open";
  safetyState = "emergency_stop";
  heartbeatActive = false;

  sendFrame("{\"type\":\"nitro_frame\",\"event\":\"heartbeat_timeout\",\"safetyState\":\"emergency_stop\",\"cutoffState\":\"open\",\"reason\":\"heartbeat_timeout\"}");
}

void setup() {
  Serial.begin(115200);
  cutoffState = "open";
  safetyState = "idle";
  heartbeatActive = false;
}

void loop() {
  while (Serial.available() > 0) {
    char incoming = Serial.read();

    if (incoming == '\r') continue;

    if (incoming == '\n') {
      inputLine.trim();
      if (inputLine.length() > 0) handleCommand(inputLine);
      inputLine = "";
    } else {
      inputLine += incoming;
      if (inputLine.length() > 512) inputLine = "";
    }
  }

  checkHeartbeatWatchdog();
}
