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
3. **BTS7960 H-Bridge Module** (43A motor driver for spotlight control)
4. **Automotive Spotlights** (auxiliary/driving lights)

### Pin Assignments

**LCD Keypad Shield (Fixed):**
- RS: Pin 8
- E: Pin 9
- D4-D7: Pins 4, 5, 6, 7
- Backlight: Pin 10 (PWM)
- Buttons: A0 (analog)

**Free Pins for Vehicle Mode:**
- Pin 2: Reed relay input (high beam detection)
- Pin 3: BTS7960 RPWM output (spotlight control)
- Pin 11: Flash LED indicator
- Pin 13: Status LED (built-in)
- A1: Hall effect sensor (optional current sensing)

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
- ✅ Silent operation (no relay clicking)
- ✅ Fast switching with no mechanical wear

---

## 🚀 Quick Start

### 1. Upload to Arduino

```bash
cd ~/Projects/knightdriver
arduino-cli compile --fqbn arduino:avr:uno smart_driving_light
arduino-cli upload -p /dev/tty.usbserial-1430 --fqbn arduino:avr:uno smart_driving_light
```

### 2. Test with Simulator

Open `dashboard_simulator.html` in Chrome/Edge (Web Serial API required)

### 3. Configure Modes

Edit `smart_driving_light.ino`:

```cpp
#define TEST_MODE false          // Set true for testing
#define DEBUG_LDR_MODE true      // Simulator mode (buttons)
#define USE_LCD true             // Enable LCD display
```

**Modes:**
- `DEBUG_LDR_MODE = true`: Simulator mode (button controls)
- `DEBUG_LDR_MODE = false`: Vehicle mode (reed relay/hall sensor)

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
├── smart_driving_light/
│   └── smart_driving_light.ino    # Main Arduino sketch
├── dashboard_simulator.html        # Web-based simulator
├── blink_test/
│   └── blink_test.ino             # Hardware test sketch
└── README.md                       # This file
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
**Version:** 1.0.0

---

**Stay safe, drive bright! 🚗💡**
