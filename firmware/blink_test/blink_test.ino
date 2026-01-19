/*
 * Simple Rapid LED Blink Test
 * Flashes the built-in LED rapidly to verify Arduino is working
 */

const int LED_PIN = 13;  // Built-in LED on most Arduinos
const int BLINK_DELAY = 100;  // 100ms = rapid flash

void setup() {
  pinMode(LED_PIN, OUTPUT);

  // Initialize serial for debugging
  Serial.begin(9600);
  Serial.println("Arduino Uno R3 SMD Visduino - LED Blink Test");
  Serial.println("Rapidly flashing built-in LED on Pin 13");
  Serial.println("System ready!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // Turn LED on
  Serial.print(".");
  delay(BLINK_DELAY);

  digitalWrite(LED_PIN, LOW);   // Turn LED off
  delay(BLINK_DELAY);
}
