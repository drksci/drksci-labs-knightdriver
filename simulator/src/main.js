import {
  CPU,
  avrInstruction,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig,
  AVRTimer,
  timer0Config,
  timer1Config,
  timer2Config,
  AVRUSART,
  usart0Config,
} from 'avr8js';

// ATmega328P configuration
const FLASH_SIZE = 32768;
const CPU_FREQ = 16000000; // 16 MHz

// State
let cpu = null;
let running = false;
let cycleCount = 0;
let animationId = null;

// Peripherals
let portB, portC, portD;
let timer0, timer1, timer2;
let usart;

// LCD state (HD44780 simulation)
const lcdState = {
  row0: '                ',
  row1: '                ',
  cursorX: 0,
  cursorY: 0,
  displayOn: true,
  entryMode: 0x06, // increment, no shift
  ddramAddr: 0,
  cgram: new Uint8Array(64),
  customChars: Array(8).fill(null).map(() => new Uint8Array(8)),
};

// Pin states
const pinState = {
  led13: false,
  led11: false,
  driver: false,
  lcdBacklight: 0,
};

// ADC value (ACS712 simulation)
let adcValue = 512; // 2.5V at 0A

// Button state (A0 analog values)
const buttonValues = {
  right: 0,
  up: 100,
  down: 250,
  left: 400,
  select: 640,
  none: 1023,
};
let currentButtonValue = buttonValues.none;

// DOM elements
const elements = {
  lcdRow0: document.getElementById('lcd-row-0'),
  lcdRow1: document.getElementById('lcd-row-1'),
  led13: document.getElementById('led-13'),
  led11: document.getElementById('led-11'),
  ledRelay: document.getElementById('led-driver'),
  driverState: document.getElementById('driver-state'),
  spotlightIcon: document.getElementById('spotlight-icon'),
  serialOutput: document.getElementById('serial-output'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  cycleCount: document.getElementById('cycle-count'),
  adcSlider: document.getElementById('adc-slider'),
  adcValue: document.getElementById('adc-value'),
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnReset: document.getElementById('btn-reset'),
};

// Serial buffer
let serialBuffer = '';

function log(message) {
  const line = document.createElement('div');
  line.className = 'serial-line';
  line.textContent = message;
  elements.serialOutput.appendChild(line);
  elements.serialOutput.scrollTop = elements.serialOutput.scrollHeight;
}

function clearSerial() {
  elements.serialOutput.innerHTML = '';
}

// Parse Intel HEX format
function parseHex(hexString) {
  const program = new Uint8Array(FLASH_SIZE);
  const lines = hexString.split('\n');

  for (const line of lines) {
    if (!line.startsWith(':')) continue;

    const byteCount = parseInt(line.substr(1, 2), 16);
    const address = parseInt(line.substr(3, 4), 16);
    const recordType = parseInt(line.substr(7, 2), 16);

    if (recordType === 0x00) { // Data record
      for (let i = 0; i < byteCount; i++) {
        program[address + i] = parseInt(line.substr(9 + i * 2, 2), 16);
      }
    } else if (recordType === 0x01) { // EOF
      break;
    }
  }

  return program;
}

// Initialize CPU and peripherals
function initCPU(program) {
  // Create CPU with program memory
  cpu = new CPU(new Uint16Array(program.buffer));

  // Initialize I/O ports
  portB = new AVRIOPort(cpu, portBConfig);
  portC = new AVRIOPort(cpu, portCConfig);
  portD = new AVRIOPort(cpu, portDConfig);

  // Initialize timers
  timer0 = new AVRTimer(cpu, timer0Config);
  timer1 = new AVRTimer(cpu, timer1Config);
  timer2 = new AVRTimer(cpu, timer2Config);

  // Initialize USART
  usart = new AVRUSART(cpu, usart0Config, CPU_FREQ);

  // Handle serial output
  usart.onByteTransmit = (byte) => {
    const char = String.fromCharCode(byte);
    if (char === '\n') {
      log(serialBuffer);
      serialBuffer = '';
    } else if (char !== '\r') {
      serialBuffer += char;
    }
  };

  // Hook into port writes for LED/driver monitoring
  portB.addListener(() => {
    // Pin 13 = PB5
    pinState.led13 = (portB.pinState & (1 << 5)) !== 0;
    // Pin 11 = PB3
    pinState.led11 = (portB.pinState & (1 << 3)) !== 0;
    // Pin 10 = PB2 (LCD backlight PWM - simplified)
    pinState.lcdBacklight = (portB.pinState & (1 << 2)) !== 0 ? 255 : 0;

    updateLEDs();
  });

  portD.addListener(() => {
    // Pin 3 = PD3 (Relay)
    pinState.driver = (portD.pinState & (1 << 3)) !== 0;
    updateRelay();
  });

  // ADC simulation - override ADC reading
  // The AVR8JS doesn't have built-in ADC, so we'll hook into memory reads
  // ADC result registers: ADCL (0x78) and ADCH (0x79)

  cycleCount = 0;
}

// Simulate ADC conversion for A0 and A1
function simulateADC(channel) {
  if (channel === 0) {
    return currentButtonValue; // A0 - buttons
  } else if (channel === 1) {
    return adcValue; // A1 - ACS712
  }
  return 0;
}

// LCD command handling (simplified HD44780)
let lcdDataMode = false;
let lcdNibbleHigh = true;
let lcdCurrentByte = 0;

function handleLCDWrite(rs, data) {
  if (rs) {
    // Data write
    const char = String.fromCharCode(data);
    if (lcdState.cursorY === 0) {
      lcdState.row0 = lcdState.row0.substring(0, lcdState.cursorX) +
                       char +
                       lcdState.row0.substring(lcdState.cursorX + 1);
    } else {
      lcdState.row1 = lcdState.row1.substring(0, lcdState.cursorX) +
                       char +
                       lcdState.row1.substring(lcdState.cursorX + 1);
    }
    lcdState.cursorX++;
    if (lcdState.cursorX >= 16) {
      lcdState.cursorX = 0;
    }
  } else {
    // Command write
    if (data & 0x80) {
      // Set DDRAM address
      const addr = data & 0x7F;
      if (addr >= 0x40) {
        lcdState.cursorY = 1;
        lcdState.cursorX = addr - 0x40;
      } else {
        lcdState.cursorY = 0;
        lcdState.cursorX = addr;
      }
    } else if (data === 0x01) {
      // Clear display
      lcdState.row0 = '                ';
      lcdState.row1 = '                ';
      lcdState.cursorX = 0;
      lcdState.cursorY = 0;
    } else if (data === 0x02) {
      // Return home
      lcdState.cursorX = 0;
      lcdState.cursorY = 0;
    }
  }
  updateLCD();
}

function updateLCD() {
  elements.lcdRow0.textContent = lcdState.row0;
  elements.lcdRow1.textContent = lcdState.row1;
}

function updateLEDs() {
  elements.led13.classList.toggle('on', pinState.led13);
  elements.led11.classList.toggle('on', pinState.led11);
}

function updateRelay() {
  elements.ledRelay.classList.toggle('on', pinState.driver);
  elements.driverState.textContent = pinState.driver ? 'ON' : 'OFF';
  elements.spotlightIcon.classList.toggle('on', pinState.driver);
}

function updateStatus() {
  elements.statusDot.classList.toggle('running', running);
  elements.statusText.textContent = running ? 'Running' : 'Stopped';
  elements.btnStart.disabled = running;
  elements.btnStop.disabled = !running;
  elements.cycleCount.textContent = cycleCount.toLocaleString();
}

// Main execution loop
function runCPU() {
  if (!running || !cpu) return;

  const cyclesPerFrame = CPU_FREQ / 60; // ~16MHz / 60fps
  const startCycles = cycleCount;

  while (cycleCount - startCycles < cyclesPerFrame) {
    avrInstruction(cpu);
    timer0.tick();
    timer1.tick();
    timer2.tick();
    usart.tick();
    cycleCount++;

    // Check for ADC reads (simplified - poll ADMUX and ADCSRA)
    // In real AVR, ADC conversion is triggered and takes cycles
    // Here we just provide instant results when ADSC is set
    const admux = cpu.data[0x7C];
    const adcsra = cpu.data[0x7A];

    if (adcsra & 0x40) { // ADSC - start conversion
      const channel = admux & 0x0F;
      const result = simulateADC(channel);
      cpu.data[0x78] = result & 0xFF; // ADCL
      cpu.data[0x79] = (result >> 8) & 0x03; // ADCH
      cpu.data[0x7A] &= ~0x40; // Clear ADSC
      cpu.data[0x7A] |= 0x10; // Set ADIF (conversion complete)
    }
  }

  updateStatus();
  animationId = requestAnimationFrame(runCPU);
}

function start() {
  if (!cpu) {
    log('Error: No program loaded');
    return;
  }
  running = true;
  updateStatus();
  runCPU();
}

function stop() {
  running = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  updateStatus();
}

function reset() {
  stop();
  clearSerial();
  if (cpu) {
    cpu.reset();
    cycleCount = 0;
  }
  lcdState.row0 = '  KNIGHTDRIVER  ';
  lcdState.row1 = '   Loading...   ';
  updateLCD();
  updateStatus();
}

// Load hex file
async function loadHex(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
    const hexString = await response.text();
    const program = parseHex(hexString);
    initCPU(program);
    log(`Loaded program from ${url}`);
    log(`Flash size: ${program.length} bytes`);
    return true;
  } catch (error) {
    log(`Error loading hex: ${error.message}`);
    return false;
  }
}

// Button handling
function setupButtons() {
  const buttons = [
    { id: 'btn-up', value: buttonValues.up },
    { id: 'btn-down', value: buttonValues.down },
    { id: 'btn-left', value: buttonValues.left },
    { id: 'btn-right', value: buttonValues.right },
    { id: 'btn-select', value: buttonValues.select },
  ];

  buttons.forEach(({ id, value }) => {
    const btn = document.getElementById(id);
    btn.addEventListener('mousedown', () => {
      currentButtonValue = value;
      btn.classList.add('pressed');
    });
    btn.addEventListener('mouseup', () => {
      currentButtonValue = buttonValues.none;
      btn.classList.remove('pressed');
    });
    btn.addEventListener('mouseleave', () => {
      currentButtonValue = buttonValues.none;
      btn.classList.remove('pressed');
    });
  });

  // ADC slider
  elements.adcSlider.addEventListener('input', (e) => {
    adcValue = parseInt(e.target.value);
    elements.adcValue.textContent = adcValue;
  });

  // Control buttons
  elements.btnStart.addEventListener('click', start);
  elements.btnStop.addEventListener('click', stop);
  elements.btnReset.addEventListener('click', reset);
}

// Initialize
async function init() {
  setupButtons();
  updateStatus();

  log('KNIGHTDRIVER AVR Simulator');
  log('─'.repeat(30));
  log('');
  log('To run the simulator:');
  log('1. Compile the firmware to .hex');
  log('2. Place .hex file in /simulator/firmware/');
  log('3. Click Start');
  log('');
  log('Or use: arduino-cli compile -e');
  log('');

  // Try to load pre-compiled hex
  const hexLoaded = await loadHex('/firmware/knightdriver.hex');
  if (hexLoaded) {
    log('');
    log('Program loaded! Click Start to run.');
  }
}

init();
