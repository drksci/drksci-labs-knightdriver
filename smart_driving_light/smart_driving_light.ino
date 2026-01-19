/*
 * Smart Driving Light Activator for Automotive Spotlights
 *
 * SAFETY REQUIREMENT: High beam MUST be ON for relay to ever be ON
 *
 * OPERATION:
 * - High beam OFF = Relay always OFF (safety)
 * - High beam ON = Relay ON by default
 * - Double flash (within 3s) = Toggle relay ON/OFF while high beam is on
 * - When high beam turns back ON, relay resets to ON
 *
 * USE CASE: Control auxiliary spotlights independently while keeping high beams on
 *
 * Hardware:
 * - Reed relay on digital pin (detects high beam: LOW=off, HIGH=on)
 * - Relay module on digital pin (controls driving lights)
 */

// ===== CONFIGURATION =====
#define TEST_MODE true  // Set to false for production use
#define DEBUG_LDR_MODE true  // true = LDR hand wave demo, false = vehicle mode

// LCD Display support (Arduino LCD Keypad Shield)
#define USE_LCD true  // true = Use LCD for display, false = Serial only
// LCD uses pins: 4, 5, 6, 7, 8, 9, 10, A0 (buttons)

#if USE_LCD
  #include <LiquidCrystal.h>
#endif

#include <string.h>  // For memcpy in tire animation

// Pin definitions for BUTTON DEBUG MODE (LCD Keypad Shield)
#if DEBUG_LDR_MODE
  const int BUTTON_PIN = A0;           // LCD Keypad Shield buttons (shared with LCD)
  const int STATUS_LED_PIN = 13;       // Built-in LED shows spot status
  const int FLICKER_LED_PIN = 11;      // Flash when button press detected
  const int LCD_BACKLIGHT_PIN = 10;    // LCD backlight (PWM for fade effects)

  // Button thresholds (LCD Keypad Shield standard values)
  const int BTN_RIGHT = 0;
  const int BTN_UP = 100;
  const int BTN_DOWN = 250;
  const int BTN_LEFT = 400;
  const int BTN_SELECT = 640;
  const int BTN_NONE = 1023;
#else
  // Pin definitions for VEHICLE MODE - REORGANIZED to avoid LCD shield conflicts
  const int REED_RELAY_PIN = 2;       // Reed relay input - DIGITAL mode only
  const int HALL_SENSOR_PIN = A1;     // Hall effect current sensor - ANALOG
  const int RELAY_PIN = 3;            // MOSFET/Relay module output
  const int RELAY_LED_PIN = 13;       // LED indicator for relay ON (built-in LED)
  const int FLASH_LED_PIN = 11;       // LED indicator for flash detection
#endif

// LCD Shield pins (standard configuration)
// RS=8, E=9, D4=4, D5=5, D6=6, D7=7, Backlight=10, Buttons=A0
// FREE PINS: 0, 1 (Serial), 12, A2, A3, A4, A5

// Hall effect sensor settings (only used if USE_HALL_SENSOR = true)
const int HALL_THRESHOLD_HIGH = 100;  // Analog value above which high beam is considered ON (0-1023)
const int HALL_THRESHOLD_LOW = 50;    // Analog value below which high beam is considered OFF (hysteresis)
// Adjust these based on your sensor: ACS712 typically outputs ~512 at 0A, increases with current
// =========================

// Debouncing and timing
const unsigned long DEBOUNCE_DELAY = 50;      // 50ms debounce
const unsigned long FLASH_TIMEOUT = 3000;     // 3 seconds for double flash detection
const unsigned long MIN_FLASH_DURATION = 100; // Minimum flash duration (100ms)
const unsigned long MAX_FLASH_DURATION = 2000; // Maximum flash duration (2s)
const unsigned long DIP_DURATION = 60000;     // 60 seconds for dip auto-resume

// LED flash timing
const unsigned long RELAY_LED_INTERVAL = 150;  // Rapid flash interval (ms)
const unsigned long FLASH_LED_DURATION = 3000; // Flash LED on for 3 seconds
const unsigned long FLASH_LED_INTERVAL = 100;  // Flash LED blink interval (ms)

#if DEBUG_LDR_MODE
  // Vehicle Simulator - State variables
  bool highBeamsOn = false;        // SELECT toggles high beams
  bool spotlightsEnabled = false;  // UP double-flash toggles
  bool spotlightsOn = false;       // Actual state (highBeams && enabled && !dip)

  // Dip mode (DOWN button - momentary while held)
  bool dipActive = false;
  bool downButtonHeld = false;

  // Flash detection for spotlight toggle (UP button double-flash)
  int flashCount = 0;
  unsigned long firstFlashTime = 0;
  unsigned long lastFlashTime = 0;

  // Fade effects for LCD backlight
  int currentBrightness = 0;       // Current LCD backlight brightness (0-255)
  int targetBrightness = 0;        // Target brightness for fade
  unsigned long lastFadeUpdate = 0;
  const int FADE_STARTUP = 3000;   // 3s startup fade
  const int FADE_ON = 2000;        // 2s fade up on enable
  const int FADE_OFF = 1000;       // 1s fade down on disable
  int fadeStepDelay = 20;          // ms between fade steps

  // Knight Rider scanning animation
  int scanPosition = 0;            // Current position in scan (0-15)
  int scanDirection = 1;           // 1 = right, -1 = left
  unsigned long lastScanUpdate = 0;
  const int SCAN_SPEED = 80;       // ms between scan steps

  // Tire animation
  int tireFrame = 0;               // 0 or 1 for spinning tire animation

  // Button handling
  int buttonValue = 1023;
  int lastButtonValue = 1023;
  int currentButton = BTN_NONE;
  int lastButton = BTN_NONE;
  unsigned long lastDebounceTime = 0;

  // LED indicators
  bool statusLedState = false;
  unsigned long lastStatusLedToggle = 0;
  bool flickerLedActive = false;
  bool flickerLedState = false;
  unsigned long flickerLedStartTime = 0;
  unsigned long lastFlickerLedToggle = 0;

#else
  // Vehicle Mode - State variables
  bool highBeamState = false;
  bool lastHighBeamState = false;
  unsigned long lastDebounceTime = 0;

  // Flash detection
  int flashCount = 0;
  unsigned long firstFlashTime = 0;
  unsigned long lastFlashOffTime = 0;
  unsigned long lastFlashOnTime = 0;

  // Relay control
  bool relayEnabled = false;
  bool relayState = false;

  // LED indicators
  bool relayLedState = false;
  unsigned long lastRelayLedToggle = 0;
  bool flashLedActive = false;
  bool flashLedState = false;
  unsigned long flashLedStartTime = 0;
  unsigned long lastFlashLedToggle = 0;
#endif

// Test mode simulation
#if TEST_MODE
bool simulatedHighBeam = false;
unsigned long lastTestToggle = 0;
const unsigned long TEST_TOGGLE_INTERVAL = 10000; // 10 seconds
#endif

// LCD Display
#if USE_LCD
LiquidCrystal lcd(8, 9, 4, 5, 6, 7);  // RS, E, D4, D5, D6, D7
bool lcdAvailable = false;
unsigned long lastLcdUpdate = 0;
const unsigned long LCD_UPDATE_INTERVAL = 500;  // Update LCD every 500ms

// Headlight icons - GLOBAL BYTE ARRAYS
byte highLamp[8] = {
  0b01110, //  .XXX.
  0b11111, //  XXXXX
  0b11111, //  XXXXX
  0b11111, //  XXXXX
  0b11111, //  XXXXX
  0b11111, //  XXXXX
  0b01110, //  .XXX.
  0b00000
};

byte highBeams[8] = {
  0b00000,
  0b11111, // XXXXX
  0b00000,
  0b11111, // XXXXX
  0b00000,
  0b11111, // XXXXX
  0b00000,
  0b00000
};

byte spotLamp[8] = {
  0b01110, //  .XXX. (Top Circle)
  0b11111, //  XXXXX
  0b11111, //  XXXXX
  0b01110, //  .XXX. (Middle Join)
  0b01110,
  0b11111, //  XXXXX (Bottom Circle)
  0b11111, //  XXXXX
  0b01110  //  .XXX.
};
#endif

// Forward declarations
#if USE_LCD
void updateLcd();
#endif
void updateLeds();

void setup() {
  // Initialize pins
#if DEBUG_LDR_MODE
  // Vehicle Simulator Mode
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(FLICKER_LED_PIN, OUTPUT);
  pinMode(LCD_BACKLIGHT_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(FLICKER_LED_PIN, LOW);
  analogWrite(LCD_BACKLIGHT_PIN, 0);  // Start with backlight off
#else
  // Vehicle Mode
  #if !USE_HALL_SENSOR
    pinMode(REED_RELAY_PIN, INPUT);
  #endif
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(RELAY_LED_PIN, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(RELAY_LED_PIN, LOW);
  digitalWrite(FLASH_LED_PIN, LOW);
#endif

  // Initialize LCD if enabled
#if USE_LCD
  lcd.begin(16, 2);  // 16x2 LCD
  lcdAvailable = true;
  lcd.clear();

#if DEBUG_LDR_MODE
  // TOYOTA HILUX - Pixel Perfect 15x7 (3 characters side-by-side)
  // Based on standard 5x8 LCD character blocks
  // THE HILUX (Wider Tires Edition)

  // Char 0: REAR (Bed + Rear wheel)
  byte truck_rear[8] = {
    0b00000,  // Sky
    0b00000,  // Bed top
    0b00000,  // Sky above bed
    0b11101,  // Bed rail / Beltline
    0b11001,  // Tailgate/Rear panel
    0b11111,  // Wheel well
    0b01110,  // Tire top (wider)
    0b01110   // Tire bottom (wider)
  };

  // Char 1: CAB (Windshield + Door)
  byte truck_cab[8] = {
    0b00000,  // Sky
    0b01111,  // Roof
    0b10001,  // Window top (glass)
    0b10101,  // Window bottom / Pillar
    0b11111,  // Door panel
    0b11111,  // Rocker panel
    0b00000,  // Ground clearance
    0b00000   // Ground
  };

  // Char 2: FRONT (Hood + Front wheel)
  byte truck_front[8] = {
    0b00000,  // Sky
    0b00000,  // Sky
    0b10000,  // Windshield slope
    0b11100,  // Hood
    0b10011,  // Fender / Grille
    0b11111,  // Bumper/Wheel Arch
    0b01110,  // Tire top (wider)
    0b01110   // Tire bottom (wider)
  };

  // Char 3: DUST (will be animated)
  byte dust_frame[8] = {
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000
  };

  // Char 4: LIGHT BEAM (will be animated)
  byte light_beam[8] = {
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000
  };

  // Startup sequence - SIMPLE LIGHT MODE
  lcd.setCursor(0, 0);
  lcd.print("  KNIGHTDRIVER");

  // Fade up backlight
  for (int brightness = 0; brightness <= 255; brightness += 5) {
    analogWrite(LCD_BACKLIGHT_PIN, brightness);
    delay(12);
  }
  currentBrightness = 255;
  targetBrightness = 255;

  delay(300);

  // Knight Rider scanner animation (2 sweeps)
  for (int sweep = 0; sweep < 2; sweep++) {
    // Sweep right
    for (int pos = 0; pos < 16; pos++) {
      lcd.setCursor(0, 1);
      for (int i = 0; i < 16; i++) {
        if (i == pos) {
          lcd.print((char)219);  // █ bright center
        } else if (i == pos - 1 || i == pos + 1) {
          lcd.print((char)219);  // █ trail
        } else if (i == pos - 2 || i == pos + 2) {
          lcd.print((char)177);  // ░ fade
        } else {
          lcd.print(' ');
        }
      }
      delay(40);
    }

    // Sweep left
    for (int pos = 15; pos >= 0; pos--) {
      lcd.setCursor(0, 1);
      for (int i = 0; i < 16; i++) {
        if (i == pos) {
          lcd.print((char)219);  // █ bright center
        } else if (i == pos - 1 || i == pos + 1) {
          lcd.print((char)219);  // █ trail
        } else if (i == pos - 2 || i == pos + 2) {
          lcd.print((char)177);  // ░ fade
        } else {
          lcd.print(' ');
        }
      }
      delay(40);
    }
  }

  delay(300);
  lcd.clear();

  // Create truck characters
  lcd.createChar(0, truck_rear);
  lcd.createChar(1, truck_cab);
  lcd.createChar(2, truck_front);
  lcd.createChar(3, dust_frame);
  lcd.createChar(4, light_beam);

  // Create headlight status icons (defined as globals above)
  lcd.createChar(5, highLamp);
  lcd.createChar(6, highBeams);
  lcd.createChar(7, spotLamp);
#else
  lcd.setCursor(0, 0);
  lcd.print("Smart Lights");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  delay(1000);
  lcd.clear();
#endif
#endif

  // Initialize serial for debugging
  Serial.begin(9600);

#if DEBUG_LDR_MODE
  Serial.println("===== BUTTON DEBUG MODE =====");
  Serial.println("Double-tap SELECT button to toggle spotlights");
  Serial.println("Using LCD Keypad Shield buttons (A0)");
  Serial.println("LED indicators: Pin 13 (spot status), Pin 11 (tap detect)");
  Serial.println("");
  Serial.println("Ready! Press SELECT button twice quickly...");
#else
  Serial.println("Smart Driving Light Activator for Spotlights");
  Serial.println("Default: Spotlights OFF");
  Serial.println("Double-flash high beam to toggle ON/OFF");
  Serial.println("LED indicators: Pin 13 (relay), Pin 11 (flash)");

  #if USE_HALL_SENSOR
    Serial.println("");
    Serial.println("Sensor: Hall Effect Current Sensor (Analog on A1)");
    Serial.print("Threshold HIGH: "); Serial.println(HALL_THRESHOLD_HIGH);
    Serial.print("Threshold LOW: "); Serial.println(HALL_THRESHOLD_LOW);
  #else
    Serial.println("Sensor: Reed Relay (Digital on Pin 2)");
  #endif

  #if USE_LCD
    Serial.println("LCD Shield: Enabled (16x2)");
    Serial.println("** Pins reassigned to avoid LCD conflicts **");
  #endif

  #if TEST_MODE
    Serial.println("");
    Serial.println("*** TEST MODE - Simulating high beam every 10s ***");
  #endif
#endif
}

void loop() {
#if DEBUG_LDR_MODE
  // ===== VEHICLE SIMULATOR MODE LOOP =====

  // Check for serial commands from web UI
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();  // Remove whitespace

    if (command.length() > 0) {
      Serial.print("Received command: ");
      Serial.println(command);

      // Map web UI commands to button presses
      if (command == "SELECT") {
        handleButtonPress(BTN_SELECT);
      } else if (command == "UP") {
        handleButtonPress(BTN_UP);
      } else if (command == "DOWN") {
        handleButtonPress(BTN_DOWN);
        downButtonHeld = true;  // Simulate holding DOWN
      } else if (command == "UP_RELEASE") {
        handleButtonRelease(BTN_UP);
      } else if (command == "DOWN_RELEASE") {
        handleButtonRelease(BTN_DOWN);
        downButtonHeld = false;  // Release DOWN
      }
    }
  }

  // Read button value
  int reading = analogRead(BUTTON_PIN);

  // Debounce button input
  if (abs(reading - lastButtonValue) > 50) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (abs(reading - buttonValue) > 50) {
      lastButton = currentButton;
      currentButton = getButtonType(reading);
      buttonValue = reading;

      // Button press (transition from NONE to a button)
      if (lastButton == BTN_NONE && currentButton != BTN_NONE) {
        handleButtonPress(currentButton);
      }

      // Button release (transition to NONE)
      if (lastButton != BTN_NONE && currentButton == BTN_NONE) {
        handleButtonRelease(lastButton);
      }
    }
  }

  lastButtonValue = reading;

  // Check if DOWN button is still held (dip mode)
  dipActive = downButtonHeld;

  // Timeout flash detection after 3 seconds
  if (flashCount > 0 && (millis() - firstFlashTime) > FLASH_TIMEOUT) {
    resetFlashDetection();
  }

  // Update spotlight actual state based on all conditions
  updateSpotlightState();

  // Update fade effects
  updateFade();

  // Update Knight Rider scanner
  updateScanner();

  // Update LED indicators
  updateStatusLed();
  updateFlickerLed();

  // Update LCD display
#if USE_LCD
  updateLcd();
#endif

#else
  // ===== VEHICLE MODE LOOP =====
  bool reading;

  #if TEST_MODE
    // Test mode: Simulate high beam toggling
    unsigned long currentTime = millis();
    if (currentTime - lastTestToggle >= TEST_TOGGLE_INTERVAL) {
      simulatedHighBeam = !simulatedHighBeam;
      lastTestToggle = currentTime;
      Serial.print(">>> TEST: Simulated high beam ");
      Serial.println(simulatedHighBeam ? "ON" : "OFF");
    }
    reading = simulatedHighBeam;
  #else
    // Production mode: Read actual sensor
    #if USE_HALL_SENSOR
      int sensorValue = analogRead(HALL_SENSOR_PIN);
      if (sensorValue >= HALL_THRESHOLD_HIGH && !highBeamState) {
        reading = true;
      } else if (sensorValue <= HALL_THRESHOLD_LOW && highBeamState) {
        reading = false;
      } else {
        reading = highBeamState;
      }
    #else
      reading = digitalRead(REED_RELAY_PIN);
    #endif
  #endif

  // Check if state changed
  if (reading != lastHighBeamState) {
    lastDebounceTime = millis();
  }

  // Debounce the input
  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
    // If state has changed after debounce
    if (reading != highBeamState) {
      highBeamState = reading;

      // Detect flash pattern
      if (highBeamState == HIGH) {
        // High beam turned ON
        handleHighBeamOn();
      } else {
        // High beam turned OFF
        handleHighBeamOff();
      }

      // Update relay based on current mode
      updateRelay();
    }
  }

  lastHighBeamState = reading;

  // Timeout flash detection after 3 seconds
  if (flashCount > 0 && (millis() - firstFlashTime) > FLASH_TIMEOUT) {
    resetFlashDetection();
  }

  // Update LED indicators
  updateRelayLed();
  updateFlashLed();

  // Update LCD display
#if USE_LCD
  updateLcd();
#endif
#endif  // End VEHICLE MODE
}

// ===== VEHICLE SIMULATOR FUNCTIONS =====
#if DEBUG_LDR_MODE

int getButtonType(int value) {
  // Determine which button based on analog value
  if (value < 50) return BTN_RIGHT;
  if (value < 200) return BTN_UP;
  if (value < 350) return BTN_DOWN;
  if (value < 550) return BTN_LEFT;
  if (value < 850) return BTN_SELECT;
  return BTN_NONE;
}

void handleButtonPress(int button) {
  Serial.print("Button pressed: ");
  unsigned long currentTime = millis();

  switch (button) {
    case BTN_SELECT:
      // Toggle high beams
      highBeamsOn = !highBeamsOn;
      Serial.print("SELECT - High Beams: ");
      Serial.println(highBeamsOn ? "ON" : "OFF");
      if (highBeamsOn) {
        startFade(255, FADE_ON);
      } else {
        startFade(128, FADE_OFF);
      }
      activateFlickerLed();
      break;

    case BTN_UP:
      // Flash detection for double-flash spotlight toggle
      Serial.println("UP - Flash detected");

      if (flashCount == 0) {
        flashCount = 1;
        firstFlashTime = currentTime;
        lastFlashTime = currentTime;
        Serial.println(">>> Flash 1");
        activateFlickerLed();
      } else if (flashCount == 1) {
        unsigned long timeSinceFirst = currentTime - lastFlashTime;

        if (timeSinceFirst <= FLASH_TIMEOUT) {
          flashCount = 2;
          Serial.println(">>> Flash 2 - DOUBLE FLASH!");
          toggleSpotlights();
          resetFlashDetection();
        }
      }
      break;

    case BTN_DOWN:
      // Momentary dip (hold to dip)
      Serial.println("DOWN - DIP activated (hold)");
      downButtonHeld = true;
      activateFlickerLed();
      break;

    case BTN_RIGHT:
    case BTN_LEFT:
      // Unused
      break;
  }
}

void handleButtonRelease(int button) {
  Serial.print("Button released: ");

  switch (button) {
    case BTN_DOWN:
      // Release dip
      Serial.println("DOWN - DIP released");
      downButtonHeld = false;
      break;

    case BTN_UP:
      // Track flash release time
      lastFlashTime = millis();
      Serial.println("UP - Flash released");
      break;
  }
}

void toggleSpotlights() {
  spotlightsEnabled = !spotlightsEnabled;
  Serial.print(">>> SPOTLIGHTS toggled: ");
  Serial.println(spotlightsEnabled ? "ENABLED" : "DISABLED");
  activateFlickerLed();
}

void updateSpotlightState() {
  // Spotlights are ON when:
  // - High beams ON
  // - Spotlights enabled by user
  // - NOT in dip mode
  bool newState = highBeamsOn && spotlightsEnabled && !dipActive;

  if (newState != spotlightsOn) {
    spotlightsOn = newState;
    Serial.print("Spotlights actual state: ");
    Serial.println(spotlightsOn ? "ON" : "OFF");
  }
}

void resetFlashDetection() {
  flashCount = 0;
  firstFlashTime = 0;
  lastFlashTime = 0;
}

void startFade(int target, int duration) {
  targetBrightness = target;
  // Calculate step delay based on duration and brightness difference
  int steps = abs(targetBrightness - currentBrightness);
  if (steps > 0) {
    fadeStepDelay = duration / steps;
  }
  Serial.print("Fade started: ");
  Serial.print(currentBrightness);
  Serial.print(" -> ");
  Serial.println(targetBrightness);
}

void updateFade() {
  if (currentBrightness != targetBrightness) {
    unsigned long currentTime = millis();
    if (currentTime - lastFadeUpdate >= fadeStepDelay) {
      if (currentBrightness < targetBrightness) {
        currentBrightness++;
      } else {
        currentBrightness--;
      }
      analogWrite(LCD_BACKLIGHT_PIN, currentBrightness);
      lastFadeUpdate = currentTime;
    }
  }
}

void updateScanner() {
  // Knight Rider scanning animation
  unsigned long currentTime = millis();
  if (currentTime - lastScanUpdate >= SCAN_SPEED) {
    scanPosition += scanDirection;

    // Bounce at edges
    if (scanPosition >= 15) {
      scanPosition = 15;
      scanDirection = -1;
    } else if (scanPosition <= 0) {
      scanPosition = 0;
      scanDirection = 1;
    }

    lastScanUpdate = currentTime;
  }
}

void updateStatusLed() {
  // Rapidly flash LED when spotlights are ON
  if (spotlightsOn) {
    unsigned long currentTime = millis();
    if (currentTime - lastStatusLedToggle >= RELAY_LED_INTERVAL) {
      statusLedState = !statusLedState;
      digitalWrite(STATUS_LED_PIN, statusLedState ? HIGH : LOW);
      lastStatusLedToggle = currentTime;
    }
  } else {
    if (statusLedState) {
      statusLedState = false;
      digitalWrite(STATUS_LED_PIN, LOW);
    }
  }
}

void activateFlickerLed() {
  flickerLedActive = true;
  flickerLedStartTime = millis();
  flickerLedState = true;
  digitalWrite(FLICKER_LED_PIN, HIGH);
  lastFlickerLedToggle = flickerLedStartTime;
}

void updateFlickerLed() {
  if (flickerLedActive) {
    unsigned long currentTime = millis();

    if (currentTime - flickerLedStartTime >= FLASH_LED_DURATION) {
      flickerLedActive = false;
      flickerLedState = false;
      digitalWrite(FLICKER_LED_PIN, LOW);
    } else {
      if (currentTime - lastFlickerLedToggle >= FLASH_LED_INTERVAL) {
        flickerLedState = !flickerLedState;
        digitalWrite(FLICKER_LED_PIN, flickerLedState ? HIGH : LOW);
        lastFlickerLedToggle = currentTime;
      }
    }
  }
}

#else
// ===== VEHICLE MODE FUNCTIONS =====

void handleHighBeamOn() {
  Serial.println("High beam: ON");

  unsigned long currentTime = millis();
  lastFlashOnTime = currentTime;

  // Check if this was previously off (potential flash start)
  if (lastFlashOffTime > 0) {
    unsigned long offDuration = currentTime - lastFlashOffTime;

    // If it was off briefly, this is a flash
    if (offDuration >= MIN_FLASH_DURATION && offDuration <= MAX_FLASH_DURATION) {
      if (flashCount == 0) {
        // First flash detected
        flashCount = 1;
        firstFlashTime = currentTime;
        Serial.println("Flash 1 detected");
        activateFlashLed(); // Indicate flash detected
      } else if (flashCount == 1) {
        // Check if second flash is within timeout
        unsigned long timeSinceFirst = currentTime - firstFlashTime;

        if (timeSinceFirst <= FLASH_TIMEOUT) {
          // Second flash detected - TOGGLE relay!
          flashCount = 2;
          Serial.println("Flash 2 detected - DOUBLE FLASH!");
          toggleRelay();
          resetFlashDetection();
        } else {
          // Timeout expired, treat as new first flash
          flashCount = 1;
          firstFlashTime = currentTime;
          Serial.println("Timeout - Flash 1 detected");
        }
      }
    }
  }

  // State persists - no auto-reset when high beam cycles
}

void handleHighBeamOff() {
  Serial.println("High beam: OFF");

  // Record when high beam turned off
  lastFlashOffTime = millis();

  // Check if the ON duration was too long (not a flash, just normal use)
  if (flashCount > 0 && lastFlashOnTime > 0) {
    unsigned long onDuration = lastFlashOffTime - lastFlashOnTime;
    if (onDuration > MAX_FLASH_DURATION) {
      Serial.println("High beam was on too long - not a flash, resetting");
      resetFlashDetection();
    }
  }
}

void toggleRelay() {
  // Toggle the relay enabled state
  relayEnabled = !relayEnabled;
  Serial.print("Relay toggled: ");
  Serial.println(relayEnabled ? "ENABLED" : "DISABLED");
}

void updateRelay() {
  bool newRelayState = false;

  // SAFETY: Relay can only be ON if high beam is ON
  if (highBeamState && relayEnabled) {
    newRelayState = true;
  } else {
    newRelayState = false;
  }

  // Update relay if state changed
  if (newRelayState != relayState) {
    relayState = newRelayState;
    digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
    Serial.print("Relay output: ");
    Serial.println(relayState ? "ON" : "OFF");
  }
}

void resetFlashDetection() {
  flashCount = 0;
  firstFlashTime = 0;
  lastFlashOffTime = 0;
}

void updateRelayLed() {
  // Rapidly flash LED when relay is ON
  if (relayState) {
    unsigned long currentTime = millis();
    if (currentTime - lastRelayLedToggle >= RELAY_LED_INTERVAL) {
      relayLedState = !relayLedState;
      digitalWrite(RELAY_LED_PIN, relayLedState ? HIGH : LOW);
      lastRelayLedToggle = currentTime;
    }
  } else {
    // Relay OFF - turn LED off
    if (relayLedState) {
      relayLedState = false;
      digitalWrite(RELAY_LED_PIN, LOW);
    }
  }
}

void activateFlashLed() {
  // Start the flash LED indicator for 3 seconds
  flashLedActive = true;
  flashLedStartTime = millis();
  flashLedState = true;
  digitalWrite(FLASH_LED_PIN, HIGH);
  lastFlashLedToggle = flashLedStartTime;
}

void updateFlashLed() {
  if (flashLedActive) {
    unsigned long currentTime = millis();

    // Check if 3 seconds have elapsed
    if (currentTime - flashLedStartTime >= FLASH_LED_DURATION) {
      // Turn off and deactivate
      flashLedActive = false;
      flashLedState = false;
      digitalWrite(FLASH_LED_PIN, LOW);
    } else {
      // Blink the LED
      if (currentTime - lastFlashLedToggle >= FLASH_LED_INTERVAL) {
        flashLedState = !flashLedState;
        digitalWrite(FLASH_LED_PIN, flashLedState ? HIGH : LOW);
        lastFlashLedToggle = currentTime;
      }
    }
  }
}

#endif  // End DEBUG_LDR_MODE functions vs VEHICLE MODE functions

#if USE_LCD
void updateLcd() {
  // Update LCD display every LCD_UPDATE_INTERVAL
  unsigned long currentTime = millis();
  if (currentTime - lastLcdUpdate < LCD_UPDATE_INTERVAL) {
    return;  // Not time to update yet
  }
  lastLcdUpdate = currentTime;

#if DEBUG_LDR_MODE
  // KNIGHTDRIVER - PIXEL PERFECT TOYOTA HILUX
  // Line 1: Dust + Hilux + Dynamic Light Beams

  // Toggle tire animation frame (creates spinning effect)
  tireFrame = !tireFrame;

  // Recreate truck custom characters with animated tires
  // THE HILUX (Animated Tires Edition)
  byte truck_rear[8];
  byte truck_cab[8];
  byte truck_front[8];

  // Build truck body (static parts - top 6 rows)
  const byte body_rear[6] = {
    0b00000,  // Sky
    0b00000,  // Bed top
    0b00000,  // Sky above bed
    0b11101,  // Bed rail / Beltline
    0b11001,  // Tailgate/Rear panel
    0b11111   // Wheel well
  };

  const byte body_cab[8] = {
    0b00000,  // Sky
    0b01111,  // Roof
    0b10001,  // Window top (glass)
    0b10101,  // Window bottom / Pillar
    0b11111,  // Door panel
    0b11111,  // Rocker panel
    0b00000,  // Ground clearance
    0b00000   // Ground
  };

  const byte body_front[6] = {
    0b00000,  // Sky
    0b00000,  // Sky
    0b10000,  // Windshield slope
    0b11100,  // Hood
    0b10011,  // Fender / Grille
    0b11111   // Bumper/Wheel Arch
  };

  // Copy static body parts
  memcpy(truck_rear, body_rear, 6);
  memcpy(truck_cab, body_cab, 8);
  memcpy(truck_front, body_front, 6);

  // Add animated tires (rows 6 & 7) - diagonal pattern simulates spinning
  byte topTire, botTire;
  if (tireFrame) {
    // Frame A: Diagonal "/"
    topTire = 0b01100;
    botTire = 0b00110;
  } else {
    // Frame B: Diagonal "\"
    topTire = 0b00110;
    botTire = 0b01100;
  }

  truck_rear[6] = topTire;
  truck_rear[7] = botTire;
  truck_front[6] = topTire;
  truck_front[7] = botTire;

  lcd.createChar(0, truck_rear);
  lcd.createChar(1, truck_cab);
  lcd.createChar(2, truck_front);

  // Headlight icons will be created dynamically in updateLcd()

  // Generate enhanced dust/road/sky environment
  byte dust[8] = {0};

  // Stars in night sky (rows 0-2)
  if (random(0, 100) < 30) dust[0] = 1 << random(0, 5);  // Random star
  if (random(0, 100) < 30) dust[1] = 1 << random(0, 5);  // Random star
  if (random(0, 100) < 30) dust[2] = 1 << random(0, 5);  // Random star

  // Road line (static - row 7 bottom)
  dust[7] = 0b11111;  // Ground line ─────

  // Dust particles (random - rows 3-6)
  for(int i = 3; i < 7; i++) {
    // Create scattered dust with clustering effect
    if (spotlightsOn && random(0, 100) < 40) {
      // More dust when moving fast with spots on
      byte pattern = random(0, 4);
      if (pattern == 0) dust[i] = 0b10000;  // Single particle left
      else if (pattern == 1) dust[i] = 0b01000;
      else if (pattern == 2) dust[i] = 0b10100;  // Two particles
      else dust[i] = 0b00100;  // Single particle center
    } else if (random(0, 100) < 20) {
      // Light dust when cruising
      dust[i] = random(0, 2) ? 0b10000 : 0b00100;
    }
  }

  lcd.createChar(3, dust);
  // Headlight icons (5, 6, 7) are created once in setup()

  lcd.setCursor(0, 0);

  // Draw dust (left of truck)
  lcd.write((uint8_t)3);

  // Draw THE HILUX (3 chars = 15px wide)
  lcd.write((uint8_t)0);  // REAR (bed + rear wheel)
  lcd.write((uint8_t)1);  // CAB (windshield + door)
  lcd.write((uint8_t)2);  // FRONT (hood + front wheel)
  lcd.print(" ");  // Space after truck

  // Generate dynamic light beam character with enhanced visuals
  byte beam[8] = {0};

  // Add ground line to match dust environment
  beam[7] = 0b11111;  // Ground line

  if (highBeamsOn && !dipActive) {
    if (spotlightsOn) {
      // FULL POWER - Spotlights (wide, bright cone)
      beam[2] = 0b10000;  // Top ray
      beam[3] = 0b11100;  // Expanding
      beam[4] = 0b11111;  // Full blast ═════
      beam[5] = 0b11100;  // Expanding
      beam[6] = 0b10000;  // Bottom ray
    } else {
      // HIGH BEAM ONLY - Narrower beam
      beam[3] = 0b11000;  // ══
      beam[4] = 0b11100;  // ═══
      beam[5] = 0b11000;  // ══
    }
  } else if (dipActive) {
    // DIP MODE - Very minimal light
    beam[4] = 0b11000;  // Just a hint
  }

  lcd.createChar(4, beam);

  // Draw light beam (right of truck)
  lcd.write((uint8_t)4);

  // Extend beams with standard chars + scanner
  if (dipActive) {
    lcd.print(" <DIP>    ");
  } else if (flashCount > 0) {
    unsigned long elapsed = millis() - firstFlashTime;
    unsigned long remaining = (FLASH_TIMEOUT - elapsed) / 1000;
    lcd.print(">>FLASH");
    lcd.print(remaining);
    lcd.print("s");
  } else if (!highBeamsOn) {
    lcd.print("           ");
  } else if (spotlightsOn) {
    // KNIGHT RIDER SCANNER
    for (int i = 0; i < 11; i++) {
      if (i == scanPosition / 2) {
        lcd.print((char)219);  // █ scanner
      } else if (abs(i - (scanPosition / 2)) == 1) {
        lcd.print((char)254);  // ▓ trail
      } else if (abs(i - (scanPosition / 2)) == 2) {
        lcd.print((char)177);  // ░ fade
      } else {
        lcd.print((char)196);  // ─ beam
      }
    }
  } else if (highBeamsOn) {
    for (int i = 0; i < 11; i++) {
      lcd.print((char)196);  // ─ steady beam
    }
  }

  // Line 2: Status bar - TEST CUSTOM CHARS UNCONDITIONALLY
  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);

  // ALWAYS show custom chars to debug
  lcd.print("5:");
  lcd.write(byte(5));  // Should show D-lamp
  lcd.print(" 6:");
  lcd.write(byte(6));  // Should show beams
  lcd.print(" 7:");
  lcd.write(byte(7));  // Should show 8-lamp

#else
  // VEHICLE MODE LCD Display
  // Line 1: System status
  lcd.setCursor(0, 0);
  lcd.print("                ");  // Clear line
  lcd.setCursor(0, 0);

  #if TEST_MODE
    lcd.print("TEST ");
  #endif

  if (highBeamState) {
    lcd.print("HB:ON ");
  } else {
    lcd.print("HB:-- ");
  }

  if (relayEnabled) {
    lcd.print("SP:EN");
  } else {
    lcd.print("SP:--");
  }

  // Line 2: Detailed status
  lcd.setCursor(0, 1);
  lcd.print("                ");  // Clear line
  lcd.setCursor(0, 1);

  if (relayState) {
    lcd.print("LIGHTS ON!");
  } else if (relayEnabled && !highBeamState) {
    lcd.print("Wait HB...");
  } else if (flashCount > 0) {
    lcd.print("Flash ");
    lcd.print(flashCount);
    lcd.print(" detect");
  } else {
    lcd.print("Ready (2xFlash)");
  }
#endif  // End DEBUG_LDR_MODE vs VEHICLE MODE in updateLcd()
}
#endif  // End USE_LCD
