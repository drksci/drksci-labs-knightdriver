// Import wokwi-elements web components
import '@wokwi/elements';

// Simulation state (no AVR emulation for now - just behavior simulation)
let running = false;
let intervalId = null;

// System state
const state = {
  highBeamOn: false,
  driverEnabled: false,
  driverOn: false,
  flashCount: 0,
  firstFlashTime: 0,
  lastFlashOffTime: 0,
  lastFlashOnTime: 0,
  led13State: false,
  led11State: false,
  led11Active: false,
  led11StartTime: 0,
  currentAmps: 0,
  cycles: 0,
};

// Constants (matching firmware)
const FLASH_TIMEOUT = 3000;
const MIN_FLASH_DURATION = 100;
const MAX_FLASH_DURATION = 2000;
const LED_BLINK_INTERVAL = 150;
const FLASH_LED_DURATION = 3000;
const ADC_ZERO = 512;
const ADC_THRESHOLD_HIGH = 560;
const ADC_THRESHOLD_LOW = 530;

// DOM Elements
const elements = {
  // Wokwi components
  lcd: null,
  led13: null,
  led11: null,

  // Custom UI
  currentSlider: document.getElementById('current-slider'),
  currentValue: document.getElementById('current-value'),
  currentAmps: document.getElementById('current-amps'),
  currentAdc: document.getElementById('current-adc'),
  driverState: document.getElementById('driver-state'),
  beamStatus: document.getElementById('beam-status'),
  spotlightLens: document.getElementById('spotlight-lens'),
  highbeamStalk: document.getElementById('highbeam-stalk'),
  serialOutput: document.getElementById('serial-output'),

  // Status panel
  statusHighbeam: document.getElementById('status-highbeam'),
  statusEnabled: document.getElementById('status-enabled'),
  statusDriver: document.getElementById('status-driver'),
  statusFlash: document.getElementById('status-flash'),
  statusCycles: document.getElementById('status-cycles'),

  // Control buttons
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnReset: document.getElementById('btn-reset'),
};

// Serial logging
function log(message) {
  const line = document.createElement('div');
  line.className = 'serial-line';
  line.textContent = message;
  elements.serialOutput.appendChild(line);
  elements.serialOutput.scrollTop = elements.serialOutput.scrollHeight;

  // Keep only last 100 lines
  while (elements.serialOutput.children.length > 100) {
    elements.serialOutput.removeChild(elements.serialOutput.firstChild);
  }
}

function clearSerial() {
  elements.serialOutput.innerHTML = '';
}

// Convert amps to ADC value (ACS712-20A: 100mV/A, 2.5V at 0A)
function ampsToAdc(amps) {
  // 100mV per amp, 2.5V baseline = 512 ADC
  // 1A = 100mV = 20.48 ADC counts
  return Math.round(ADC_ZERO + (amps * 20.48));
}

// Update LCD display
function updateLcd(line0, line1) {
  if (elements.lcd) {
    // Pad lines to 16 chars
    const text = (line0.padEnd(16) + line1.padEnd(16)).substring(0, 32);
    elements.lcd.setAttribute('text', text);
  }
}

// Update LED state
function updateLed(id, on) {
  const led = document.getElementById(id);
  if (led) {
    led.value = on;
  }
}

// Handle high beam state change
function handleHighBeamOn() {
  log('High beam: ON');
  state.lastFlashOnTime = Date.now();

  if (state.lastFlashOffTime > 0) {
    const offDuration = state.lastFlashOnTime - state.lastFlashOffTime;

    if (offDuration >= MIN_FLASH_DURATION && offDuration <= MAX_FLASH_DURATION) {
      if (state.flashCount === 0) {
        state.flashCount = 1;
        state.firstFlashTime = Date.now();
        log('Flash 1 detected');
        activateFlashLed();
      } else if (state.flashCount === 1) {
        const timeSinceFirst = Date.now() - state.firstFlashTime;

        if (timeSinceFirst <= FLASH_TIMEOUT) {
          state.flashCount = 2;
          log('Flash 2 detected - DOUBLE FLASH!');
          toggleDriver();
          resetFlashDetection();
        } else {
          state.flashCount = 1;
          state.firstFlashTime = Date.now();
          log('Timeout - Flash 1 detected');
        }
      }
    }
  }
}

function handleHighBeamOff() {
  log('High beam: OFF');
  state.lastFlashOffTime = Date.now();

  if (state.flashCount > 0 && state.lastFlashOnTime > 0) {
    const onDuration = state.lastFlashOffTime - state.lastFlashOnTime;
    if (onDuration > MAX_FLASH_DURATION) {
      log('High beam was on too long - not a flash, resetting');
      resetFlashDetection();
    }
  }
}

function toggleDriver() {
  state.driverEnabled = !state.driverEnabled;
  log(`Driver toggled: ${state.driverEnabled ? 'ENABLED' : 'DISABLED'}`);
}

function updateDriver() {
  const newState = state.highBeamOn && state.driverEnabled;

  if (newState !== state.driverOn) {
    state.driverOn = newState;
    log(`Driver output: ${state.driverOn ? 'ON' : 'OFF'}`);
  }
}

function resetFlashDetection() {
  state.flashCount = 0;
  state.firstFlashTime = 0;
  state.lastFlashOffTime = 0;
}

function activateFlashLed() {
  state.led11Active = true;
  state.led11StartTime = Date.now();
}

// Main simulation loop
function simulationTick() {
  state.cycles++;
  const now = Date.now();

  // Read current slider and convert to ADC
  const amps = parseFloat(elements.currentSlider.value);
  state.currentAmps = amps;
  const adcValue = ampsToAdc(amps);

  // Update current display
  elements.currentValue.textContent = `${amps.toFixed(1)}A`;
  elements.currentAmps.textContent = `${amps.toFixed(1)}A`;
  elements.currentAdc.textContent = `ADC: ${adcValue}`;

  // Detect high beam state with hysteresis
  const wasOn = state.highBeamOn;
  if (adcValue >= ADC_THRESHOLD_HIGH && !state.highBeamOn) {
    state.highBeamOn = true;
  } else if (adcValue <= ADC_THRESHOLD_LOW && state.highBeamOn) {
    state.highBeamOn = false;
  }

  // Handle state transitions
  if (state.highBeamOn && !wasOn) {
    handleHighBeamOn();
  } else if (!state.highBeamOn && wasOn) {
    handleHighBeamOff();
  }

  // Timeout flash detection
  if (state.flashCount > 0 && (now - state.firstFlashTime) > FLASH_TIMEOUT) {
    resetFlashDetection();
  }

  // Update driver output
  updateDriver();

  // LED 13: Blink when driver is on
  if (state.driverOn) {
    if (Math.floor(now / LED_BLINK_INTERVAL) % 2 === 0) {
      state.led13State = !state.led13State;
    }
  } else {
    state.led13State = false;
  }

  // LED 11: Flash indicator
  if (state.led11Active) {
    if (now - state.led11StartTime >= FLASH_LED_DURATION) {
      state.led11Active = false;
      state.led11State = false;
    } else {
      state.led11State = Math.floor(now / 100) % 2 === 0;
    }
  }

  // Update UI
  updateLed('led-13', state.led13State);
  updateLed('led-11', state.led11State);

  // Update status panel
  elements.statusHighbeam.textContent = state.highBeamOn ? 'ON' : 'OFF';
  elements.statusHighbeam.className = `status-value ${state.highBeamOn ? 'on' : 'off'}`;

  elements.statusEnabled.textContent = state.driverEnabled ? 'YES' : 'NO';
  elements.statusEnabled.className = `status-value ${state.driverEnabled ? 'on' : 'off'}`;

  elements.statusDriver.textContent = state.driverOn ? 'ON' : 'OFF';
  elements.statusDriver.className = `status-value ${state.driverOn ? 'on' : 'off'}`;

  elements.statusFlash.textContent = state.flashCount.toString();
  elements.statusCycles.textContent = state.cycles.toLocaleString();

  // Update high beam stalk visual
  elements.highbeamStalk.classList.toggle('active', state.highBeamOn);
  elements.beamStatus.textContent = state.highBeamOn ? '● ON' : '● OFF';
  elements.beamStatus.classList.toggle('on', state.highBeamOn);

  // Update driver module
  elements.driverState.textContent = state.driverOn ? 'ON' : 'OFF';
  elements.driverState.style.color = state.driverOn ? '#4caf50' : '#888';

  // Update spotlight
  elements.spotlightLens.classList.toggle('on', state.driverOn);

  // Update LCD
  let line0, line1;
  if (state.highBeamOn) {
    if (state.driverOn) {
      line0 = 'HB:ON  SPOT:ON';
      line1 = '>>> ACTIVE <<<';
    } else {
      line0 = 'HB:ON  SPOT:--';
      line1 = state.flashCount > 0 ? `Flash ${state.flashCount}/2...` : '2xFlash=Toggle';
    }
  } else {
    line0 = 'HB:OFF SPOT:--';
    line1 = state.driverEnabled ? 'Waiting for HB' : 'Ready';
  }
  updateLcd(line0, line1);
}

// Control functions
function start() {
  if (running) return;
  running = true;

  log('─'.repeat(30));
  log('KNIGHTDRIVER Simulation Started');
  log('─'.repeat(30));
  log('');
  log('Sensor: ACS712 Current Sensor');
  log(`Threshold HIGH: ${ADC_THRESHOLD_HIGH}`);
  log(`Threshold LOW: ${ADC_THRESHOLD_LOW}`);
  log('');
  log('Slide current > 2A to turn high beam ON');
  log('Double-flash to toggle spotlights');
  log('');

  intervalId = setInterval(simulationTick, 50); // 20Hz update

  elements.btnStart.disabled = true;
  elements.btnStop.disabled = false;
}

function stop() {
  if (!running) return;
  running = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  log('');
  log('Simulation stopped');

  elements.btnStart.disabled = false;
  elements.btnStop.disabled = true;
}

function reset() {
  stop();

  // Reset state
  state.highBeamOn = false;
  state.driverEnabled = false;
  state.driverOn = false;
  state.flashCount = 0;
  state.firstFlashTime = 0;
  state.lastFlashOffTime = 0;
  state.lastFlashOnTime = 0;
  state.led13State = false;
  state.led11State = false;
  state.led11Active = false;
  state.cycles = 0;

  // Reset UI
  elements.currentSlider.value = 0;
  elements.currentValue.textContent = '0.0A';
  elements.currentAmps.textContent = '0.0A';
  elements.currentAdc.textContent = 'ADC: 512';

  updateLed('led-13', false);
  updateLed('led-11', false);

  elements.spotlightLens.classList.remove('on');
  elements.highbeamStalk.classList.remove('active');
  elements.beamStatus.textContent = '● OFF';
  elements.beamStatus.classList.remove('on');

  updateLcd('  KNIGHTDRIVER', '    Ready...');

  clearSerial();
  log('System reset');
}

// Event listeners
function setupEventListeners() {
  elements.btnStart.addEventListener('click', start);
  elements.btnStop.addEventListener('click', stop);
  elements.btnReset.addEventListener('click', reset);

  // High beam stalk click
  elements.highbeamStalk.addEventListener('click', () => {
    if (!running) return;
    // Toggle current slider to simulate stalk push
    const current = parseFloat(elements.currentSlider.value);
    elements.currentSlider.value = current < 2 ? 4 : 0;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (running) {
        // Quick flash simulation
        const current = parseFloat(elements.currentSlider.value);
        if (current < 2) {
          elements.currentSlider.value = 4;
          setTimeout(() => {
            elements.currentSlider.value = 0;
          }, 200);
        } else {
          elements.currentSlider.value = 0;
          setTimeout(() => {
            elements.currentSlider.value = 4;
          }, 200);
        }
      }
    } else if (e.key === 's' || e.key === 'S') {
      if (!running) start();
      else stop();
    } else if (e.key === 'r' || e.key === 'R') {
      reset();
    }
  });
}

// Initialize
function init() {
  // Wait for wokwi elements to be defined
  customElements.whenDefined('wokwi-lcd1602').then(() => {
    elements.lcd = document.getElementById('lcd');
    updateLcd('  KNIGHTDRIVER', '    Ready...');
  });

  customElements.whenDefined('wokwi-led').then(() => {
    elements.led13 = document.getElementById('led-13');
    elements.led11 = document.getElementById('led-11');
  });

  setupEventListeners();

  log('KNIGHTDRIVER Circuit Simulator');
  log('─'.repeat(30));
  log('');
  log('Press Start to begin simulation');
  log('');
  log('Keyboard shortcuts:');
  log('  Space - Quick flash');
  log('  S     - Start/Stop');
  log('  R     - Reset');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
