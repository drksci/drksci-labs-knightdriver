# KNIGHTDRIVER 🚗⚡

**Smart Automotive Spotlight Controller with Knight Rider Style Animation**

A sophisticated Arduino-based system for controlling auxiliary spotlights with realistic high beam integration, double-flash toggle, and momentary dip functionality - all displayed with a beautiful Knight Rider-style scanning animation.

---

## 🎯 Features

### Core Functionality
- **High Beam Control**: Toggle high beams ON/OFF (SELECT button)
- **Double-Flash Toggle**: Flash high beams twice to enable/disable spotlights (UP button)
- **Momentary Dip**: Hold to dip beams for oncoming traffic (DOWN button)
- **Knight Rider Animation**: Scanning beam effect when spotlights are active
- **Safety First**: Spotlights only activate when high beams are ON

### Display Features
- **Animated Car Visualization**: Visual representation of beam lengths
- **Real-time Status Bar**: Clear indicators for HI, SP, DP states
- **Fade Effects**: Smooth LCD backlight transitions
- **Contextual Messages**: Helpful prompts and status updates

---

## 🎮 Controls (LCD Keypad Shield)

| Button | Function | Description |
|--------|----------|-------------|
| **SELECT** | Toggle High Beams | Main high beam ON/OFF switch |
| **UP** | Flash / Double-Flash | Press twice quickly to toggle spotlights |
| **DOWN** | Dip (Hold) | Momentary dip - hold while car passes |
| RIGHT | Unused | Reserved for future features |
| LEFT | Unused | Reserved for future features |

---

## 📺 LCD Display

### Line 1: Animated Beam Visualization

**High Beams OFF:**
```
] Hi:SEL Sp:2xUP
```

**High Beams ON:**
```
]======  Sp:2xUP
```

**High Beams + Spotlights (Knight Rider Scanner):**
```
]=    █▀  ====
```
*Scanner sweeps back and forth!*

**Dipping:**
```
]      [DIP]
```

**Double-Flash Active:**
```
] >>FLASH 2s<<
```

### Line 2: Status Bar
```
HI:█ SP:█ DP:-
```
- **█** = ON
- **\*** = Enabled (waiting for conditions)
- **-** = OFF

---

## 💻 Dashboard Simulator

**Interactive web-based simulator** for testing without hardware!

### Launch the Simulator

```bash
cd ~/Projects/knightdriver
open dashboard_simulator.html
```

### Features
- **Realistic Toyota Hilux stalk controls**
- **Animated beam visualization**
- **Live serial communication** with Arduino
- **Touch/mouse friendly** interface

### Controls
- **↑ PUSH (Flash)**: Press twice quickly → toggle spotlights
- **⊙ CLICK**: Toggle high beams ON/OFF
- **↓ PULL (Dip)**: Hold to dip beams

### Serial Connection
1. Click **"CONNECT TO ARDUINO"**
2. Select your Arduino's serial port
3. Controls now send commands to physical hardware!

---

## 🛠️ Hardware Setup

### Required Components
1. **Arduino Uno R3** (or compatible)
2. **LCD Keypad Shield** (16x2 with 5 buttons)
3. **ACS712 Current Sensor Module** (20A variant recommended)
4. **BTS7960 H-Bridge Module** (43A motor driver for spotlight control)
5. **Automotive Spotlights** (auxiliary/driving lights)

### Pin Assignments

**LCD Keypad Shield (Fixed):**
- RS: Pin 8
- E: Pin 9
- D4-D7: Pins 4, 5, 6, 7
- Backlight: Pin 10 (PWM)
- Buttons: A0 (analog)

**Vehicle Mode Pins:**
- **A1: ACS712 current sensor output** (analog - high beam detection)
- Pin 2: Reed switch input (alternative to ACS712)
- Pin 3: BTS7960 RPWM output (spotlight control)
- Pin 11: Flash LED indicator
- Pin 13: Status LED (built-in)

### ACS712 Current Sensor Wiring

The ACS712 detects when current flows through the high beam circuit:

```
                    ACS712-20A Module
                   ┌─────────────────┐
    Arduino 5V ────┤ VCC             │
    Arduino GND ───┤ GND             │
    Arduino A1 ────┤ OUT             │  (Analog output ~2.5V at 0A)
                   │                 │
    HIGH BEAM ═════┤ IP+         IP- ├═════ HIGH BEAM
    WIRE (IN)      │   (pass-through)│      WIRE (OUT)
                   └─────────────────┘
```

**Installation:**
1. Identify one of the high beam wires (positive side)
2. Cut the wire and connect both ends to IP+ and IP-
3. Current flows through the sensor without interruption
4. Sensor outputs analog voltage proportional to current

**ACS712 Variants:**
| Model | Range | Sensitivity | Best For |
|-------|-------|-------------|----------|
| ACS712-05B | ±5A | 185 mV/A | Single bulb |
| ACS712-20A | ±20A | 100 mV/A | High beam circuit (recommended) |
| ACS712-30A | ±30A | 66 mV/A | High-current applications |

**Calibration:**
- At 0A (high beam OFF): Output ≈ 2.5V (ADC ~512)
- Current flowing (ON): Output increases above 2.5V
- Default threshold: 560 ADC (~2A detection)
- Monitor Serial output to tune thresholds for your vehicle

### BTS7960 Wiring

```
Arduino Pin 3 (RELAY_PIN) → BTS7960 RPWM
Arduino GND → BTS7960 GND
Arduino 5V → BTS7960 VCC

BTS7960 B+ → +12V Vehicle Power
BTS7960 B- → Vehicle GND
BTS7960 M+ → Spotlight Positive
BTS7960 M- → Spotlight Negative

BTS7960 LPWM → GND (single direction)
BTS7960 R_EN → +5V (enable right side)
BTS7960 L_EN → +5V (enable left side)
```

**Advantages of BTS7960:**
- ✅ 43A continuous current capacity
- ✅ PWM dimming support (future feature)
- ✅ Overcurrent/overtemperature protection
- ✅ Silent solid-state operation
- ✅ Fast switching with no mechanical wear

---

## 🚀 Quick Start

### 1. Upload to Arduino

```bash
cd ~/Projects/knightdriver/firmware
arduino-cli compile --fqbn arduino:avr:uno knightdriver
arduino-cli upload -p /dev/tty.usbserial-1430 --fqbn arduino:avr:uno knightdriver
```

### 2. Test with Simulator

Open `dashboard_simulator.html` in Chrome/Edge (Web Serial API required)

### 3. Configure Modes

Edit `firmware/knightdriver/knightdriver.ino`:

```cpp
#define TEST_MODE false          // Set true to simulate high beam toggling
#define DEBUG_LDR_MODE false     // false = vehicle mode, true = simulator
#define USE_HALL_SENSOR true     // true = ACS712, false = reed switch
#define USE_LCD true             // Enable LCD display
```

**Modes:**
- `DEBUG_LDR_MODE = true`: Simulator mode (LCD keypad button controls)
- `DEBUG_LDR_MODE = false`: Vehicle mode (uses real sensors)
- `USE_HALL_SENSOR = true`: ACS712 current sensor on A1
- `USE_HALL_SENSOR = false`: Reed switch on D2

---

## 🔧 Configuration

### Timing Constants

```cpp
const unsigned long FLASH_TIMEOUT = 3000;      // 3s for double-flash
const unsigned long MIN_FLASH_DURATION = 100;  // Min flash time
const unsigned long MAX_FLASH_DURATION = 2000; // Max flash time
```

### Fade Effects

```cpp
const int FADE_STARTUP = 3000;  // 3s startup fade
const int FADE_ON = 2000;       // 2s fade up on enable
const int FADE_OFF = 1000;      // 1s fade down on disable
```

### Scanner Animation

```cpp
const int SCAN_SPEED = 80;  // ms between scan steps (80 = smooth)
```

---

## 🎬 Real-World Usage

### Typical Driving Scenario

1. **Turn on high beams** → Press SELECT
   - LCD shows: `]======  Sp:2xUP`

2. **Enable spotlights** → Press UP twice quickly (double-flash)
   - LCD shows: `]=    █▀  ====` (scanner active!)

3. **Oncoming car** → Hold DOWN to dip
   - LCD shows: `]      [DIP]`
   - Release when clear

4. **Turn off high beams** → Press SELECT again
   - LCD shows: `] Hi:SEL Sp:2xUP`

---

## 📋 Project Structure

```
knightdriver/
├── firmware/
│   ├── knightdriver/
│   │   └── knightdriver.ino    # Main Arduino sketch
│   └── blink_test/
│       └── blink_test.ino             # Hardware test sketch
├── simulator/                          # AVR8JS web simulator
│   ├── src/
│   │   └── main.js                    # Simulator logic
│   ├── public/
│   │   └── firmware/                  # Compiled .hex files
│   ├── index.html                     # Simulator UI
│   ├── package.json
│   └── vercel.json                    # Vercel deployment config
├── .github/
│   └── workflows/
│       └── deploy-simulator.yml       # Vercel CI/CD
├── dashboard_simulator.html           # Serial dashboard (legacy)
└── README.md                          # This file
```

---

## 🔌 AVR8JS Simulator

Test the firmware in your browser with our custom AVR8JS-based simulator!

**Live Simulator:** [drksci-labs-knightdriver.vercel.app](https://drksci-labs-knightdriver.vercel.app)

### Features
- Real AVR ATmega328P emulation via [avr8js](https://github.com/wokwi/avr8js)
- Virtual LCD display with Knight Rider animation
- ACS712 current sensor simulation (adjustable slider)
- LCD Keypad Shield button simulation
- Live serial monitor output
- LED and driver state visualization

### Run Locally

```bash
cd simulator
pnpm install
pnpm dev
```

Open http://localhost:3000 in your browser.

### Compile Firmware for Simulator

```bash
cd firmware
arduino-cli compile -e --fqbn arduino:avr:uno knightdriver
cp knightdriver/build/arduino.avr.uno/knightdriver.ino.hex ../simulator/public/firmware/knightdriver.hex
```

---

## 🐛 Troubleshooting

### LCD Not Working
- Check I2C address if using I2C LCD
- Verify pin connections (RS=8, E=9, D4-7=4-7)
- Adjust contrast potentiometer

### Buttons Not Responding
- Check A0 connection
- Verify button thresholds in code:
  ```cpp
  const int BTN_SELECT = 640;  // Adjust if needed
  ```

### BTS7960 Not Switching
- Check RPWM connection to Pin 3
- Verify R_EN and L_EN are connected to +5V
- Check B+ has 12V power supply

### Serial Monitor Freezing Upload
- Close `screen` session: `Ctrl+A`, then `K`
- Close Arduino IDE Serial Monitor
- Kill any serial processes: `lsof | grep usbserial`

---

## 🎨 Customization Ideas

### Add More Features
- **PWM Dimming**: Use `analogWrite()` on Pin 3 for brightness control
- **Auto High Beam**: Use light sensor to auto-toggle
- **Speed Integration**: Enable spots only above certain speed
- **Dashboard Integration**: Connect to vehicle CAN bus

### Modify Animations
- Change scanner speed
- Add different patterns (pulse, fade, strobe)
- Customize LCD characters

---

## 📜 License

MIT License - Feel free to modify and use in your projects!

---

## 🙏 Credits

**Built with:**
- Arduino Platform
- LiquidCrystal Library
- Knight Rider inspiration 🚗⚡

**Created by:** DRKSCI Labs
**Project:** KNIGHTDRIVER
**Version:** 1.1.0

---

**Stay safe, drive bright! 🚗💡**
