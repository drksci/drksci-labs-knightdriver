// Import wokwi-elements web components
import '@wokwi/elements';

// Simulation state
let running = false;
let intervalId = null;

// System state (matching firmware exactly)
const state = {
  highBeamOn: false,
  lastHighBeamOn: false,
  driverEnabled: false,
  driverState: false,
  flashCount: 0,
  firstFlashTime: 0,
  lastFlashOffTime: 0,
  lastFlashOnTime: 0,
  led13State: false,
  led11State: false,
  led11Active: false,
  led11StartTime: 0,
  lastLed13Toggle: 0,
  lastLed11Toggle: 0,
  currentAmps: 0,
  cycles: 0,
};

// Constants (matching firmware)
const FLASH_TIMEOUT = 3000;
const MIN_FLASH_DURATION = 100;
const MAX_FLASH_DURATION = 2000;
const DRIVER_LED_INTERVAL = 150;
const FLASH_LED_DURATION = 3000;
const FLASH_LED_INTERVAL = 100;
const ADC_ZERO = 512;
const ADC_THRESHOLD_HIGH = 560;
const ADC_THRESHOLD_LOW = 530;

// DOM Elements
const elements = {
  lcd: null,
  lcdText: document.getElementById('lcd-text'),
  led13: null,
  led11: null,
  ledVisual13: document.getElementById('led-visual-13'),
  ledVisual11: document.getElementById('led-visual-11'),
  currentSlider: document.getElementById('current-slider'),
  currentValue: document.getElementById('current-value'),
  currentAmps: document.getElementById('current-amps'),
  currentAdc: document.getElementById('current-adc'),
  driverState: document.getElementById('driver-state'),
  beamStatus: document.getElementById('beam-status'),
  spotlight1: document.getElementById('spotlight-1'),
  spotlight2: document.getElementById('spotlight-2'),
  highbeamStalk: document.getElementById('highbeam-stalk'),
  serialOutput: document.getElementById('serial-output'),
  statusHighbeam: document.getElementById('status-highbeam'),
  statusEnabled: document.getElementById('status-enabled'),
  statusDriver: document.getElementById('status-driver'),
  statusFlash: document.getElementById('status-flash'),
  statusCycles: document.getElementById('status-cycles'),
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
  while (elements.serialOutput.children.length > 100) {
    elements.serialOutput.removeChild(elements.serialOutput.firstChild);
  }
}

function clearSerial() {
  elements.serialOutput.innerHTML = '';
}

// Convert amps to ADC value (ACS712-20A: 100mV/A, 2.5V at 0A)
function ampsToAdc(amps) {
  return Math.round(ADC_ZERO + (amps * 20.48));
}

// Update LCD display
function updateLcd(line0, line1) {
  // Update wokwi element if available
  if (elements.lcd) {
    const text = (line0.padEnd(16) + line1.padEnd(16)).substring(0, 32);
    elements.lcd.setAttribute('text', text);
  }
  // Update visual LCD text
  if (elements.lcdText) {
    elements.lcdText.textContent = line0.padEnd(16) + '\n' + line1.padEnd(16);
  }
}

// Update LED state
function updateLed(id, on) {
  // Update wokwi element
  const led = document.getElementById(id);
  if (led && led.value !== undefined) {
    led.value = on;
  }
  // Update visual LED circles
  if (id === 'led-13' && elements.ledVisual13) {
    elements.ledVisual13.classList.toggle('on', on);
  } else if (id === 'led-11' && elements.ledVisual11) {
    elements.ledVisual11.classList.toggle('on', on);
  }
}

// ===== VEHICLE MODE FUNCTIONS (matching firmware exactly) =====

function handleHighBeamOn() {
  log('High beam: ON');

  const currentTime = Date.now();
  state.lastFlashOnTime = currentTime;

  // Check if this was previously off (potential flash)
  if (state.lastFlashOffTime > 0) {
    const offDuration = currentTime - state.lastFlashOffTime;

    // If it was off briefly, this is a flash
    if (offDuration >= MIN_FLASH_DURATION && offDuration <= MAX_FLASH_DURATION) {
      if (state.flashCount === 0) {
        // First flash detected
        state.flashCount = 1;
        state.firstFlashTime = currentTime;
        log('Flash 1 detected');
        activateFlashLed();
      } else if (state.flashCount === 1) {
        // Check if second flash is within timeout
        const timeSinceFirst = currentTime - state.firstFlashTime;

        if (timeSinceFirst <= FLASH_TIMEOUT) {
          // Second flash detected - TOGGLE driver!
          state.flashCount = 2;
          log('Flash 2 detected - DOUBLE FLASH!');
          toggleDriver();
          resetFlashDetection();
        } else {
          // Timeout expired, treat as new first flash
          state.flashCount = 1;
          state.firstFlashTime = currentTime;
          log('Timeout - Flash 1 detected');
        }
      }
    }
  }
}

function handleHighBeamOff() {
  log('High beam: OFF');

  // Record when high beam turned off
  state.lastFlashOffTime = Date.now();

  // Check if the ON duration was too long (not a flash, just normal use)
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
  let newDriverState = false;

  // SAFETY: Driver can only be ON if high beam is ON
  if (state.highBeamOn && state.driverEnabled) {
    newDriverState = true;
  }

  // Update driver if state changed
  if (newDriverState !== state.driverState) {
    state.driverState = newDriverState;
    log(`Driver output: ${state.driverState ? 'ON' : 'OFF'}`);
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
  state.led11State = true;
  state.lastLed11Toggle = Date.now();
}

function updateDriverLed() {
  const now = Date.now();

  // Rapidly flash LED when driver is ON
  if (state.driverState) {
    if (now - state.lastLed13Toggle >= DRIVER_LED_INTERVAL) {
      state.led13State = !state.led13State;
      state.lastLed13Toggle = now;
    }
  } else {
    if (state.led13State) {
      state.led13State = false;
    }
  }
}

function updateFlashLed() {
  const now = Date.now();

  if (state.led11Active) {
    if (now - state.led11StartTime >= FLASH_LED_DURATION) {
      state.led11Active = false;
      state.led11State = false;
    } else {
      if (now - state.lastLed11Toggle >= FLASH_LED_INTERVAL) {
        state.led11State = !state.led11State;
        state.lastLed11Toggle = now;
      }
    }
  }
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

  // Read sensor with hysteresis (matching firmware)
  let reading;
  if (adcValue >= ADC_THRESHOLD_HIGH && !state.highBeamOn) {
    reading = true;
  } else if (adcValue <= ADC_THRESHOLD_LOW && state.highBeamOn) {
    reading = false;
  } else {
    reading = state.highBeamOn; // Hold previous state
  }

  // Check if state changed (debounce simulated by tick rate)
  if (reading !== state.highBeamOn) {
    state.highBeamOn = reading;

    if (state.highBeamOn) {
      handleHighBeamOn();
    } else {
      handleHighBeamOff();
    }

    // Update driver based on current mode
    updateDriver();
  }

  // Timeout flash detection after 3 seconds
  if (state.flashCount > 0 && (now - state.firstFlashTime) > FLASH_TIMEOUT) {
    log('Flash timeout - resetting');
    resetFlashDetection();
  }

  // Update LED indicators
  updateDriverLed();
  updateFlashLed();

  // Update UI
  updateLed('led-13', state.led13State);
  updateLed('led-11', state.led11State);

  // Update status panel
  elements.statusHighbeam.textContent = state.highBeamOn ? 'ON' : 'OFF';
  elements.statusHighbeam.className = `status-value ${state.highBeamOn ? 'on' : 'off'}`;

  elements.statusEnabled.textContent = state.driverEnabled ? 'YES' : 'NO';
  elements.statusEnabled.className = `status-value ${state.driverEnabled ? 'on' : 'off'}`;

  elements.statusDriver.textContent = state.driverState ? 'ON' : 'OFF';
  elements.statusDriver.className = `status-value ${state.driverState ? 'on' : 'off'}`;

  elements.statusFlash.textContent = state.flashCount.toString();
  elements.statusCycles.textContent = state.cycles.toLocaleString();

  // Update high beam stalk visual
  elements.highbeamStalk.classList.toggle('active', state.highBeamOn);
  elements.beamStatus.classList.toggle('on', state.highBeamOn);
  // Update beam status indicator text (find the span inside)
  const beamText = elements.beamStatus.querySelector('span:last-child');
  if (beamText) {
    beamText.textContent = state.highBeamOn ? 'ON' : 'OFF';
  }

  // Update driver module
  elements.driverState.textContent = state.driverState ? 'ON' : 'OFF';
  elements.driverState.style.color = state.driverState ? '#4caf50' : '#888';

  // Update driver status class
  elements.driverState.classList.toggle('on', state.driverState);
  elements.driverState.classList.toggle('off', !state.driverState);

  // Update spotlights (both SVGs)
  if (elements.spotlight1) {
    elements.spotlight1.classList.toggle('on', state.driverState);
  }
  if (elements.spotlight2) {
    elements.spotlight2.classList.toggle('on', state.driverState);
  }

  // Update LCD
  let line0, line1;
  if (state.highBeamOn) {
    if (state.driverState) {
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
  log('HOW TO USE:');
  log('1. Slide current to 4A (high beam ON)');
  log('2. Quickly slide to 0A (OFF) then back to 4A');
  log('3. Repeat for second flash');
  log('4. Double-flash toggles spotlights!');
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
  Object.assign(state, {
    highBeamOn: false,
    lastHighBeamOn: false,
    driverEnabled: false,
    driverState: false,
    flashCount: 0,
    firstFlashTime: 0,
    lastFlashOffTime: 0,
    lastFlashOnTime: 0,
    led13State: false,
    led11State: false,
    led11Active: false,
    led11StartTime: 0,
    lastLed13Toggle: 0,
    lastLed11Toggle: 0,
    cycles: 0,
  });

  // Reset UI
  elements.currentSlider.value = 0;
  elements.currentValue.textContent = '0.0A';
  elements.currentAmps.textContent = '0.0A';
  elements.currentAdc.textContent = 'ADC: 512';

  updateLed('led-13', false);
  updateLed('led-11', false);

  if (elements.spotlight1) elements.spotlight1.classList.remove('on');
  if (elements.spotlight2) elements.spotlight2.classList.remove('on');
  elements.highbeamStalk.classList.remove('active');
  elements.beamStatus.classList.remove('on');
  const beamText = elements.beamStatus.querySelector('span:last-child');
  if (beamText) beamText.textContent = 'OFF';
  elements.driverState.classList.remove('on');
  elements.driverState.classList.add('off');

  updateLcd('  KNIGHTDRIVER', '    Ready...');

  clearSerial();
  log('System reset');
}

// Flash helper - simulates a quick OFF-ON cycle
function doFlash() {
  if (!running) return;

  const wasOn = state.highBeamOn;
  if (wasOn) {
    // Turn off briefly, then back on
    elements.currentSlider.value = 0;
    setTimeout(() => {
      elements.currentSlider.value = 4;
    }, 150); // 150ms off duration
  } else {
    // Turn on first
    elements.currentSlider.value = 4;
  }
}

// Event listeners
function setupEventListeners() {
  elements.btnStart.addEventListener('click', start);
  elements.btnStop.addEventListener('click', stop);
  elements.btnReset.addEventListener('click', reset);

  // High beam stalk click - toggle high beam
  elements.highbeamStalk.addEventListener('click', () => {
    if (!running) return;
    const current = parseFloat(elements.currentSlider.value);
    elements.currentSlider.value = current < 2 ? 4 : 0;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      doFlash();
    } else if (e.key === 's' || e.key === 'S') {
      if (!running) start();
      else stop();
    } else if (e.key === 'r' || e.key === 'R') {
      reset();
    } else if (e.key === 'h' || e.key === 'H') {
      // Toggle high beam
      if (running) {
        const current = parseFloat(elements.currentSlider.value);
        elements.currentSlider.value = current < 2 ? 4 : 0;
      }
    }
  });

  // Double-click on stalk for quick double-flash
  let lastStalkClick = 0;
  elements.highbeamStalk.addEventListener('dblclick', () => {
    if (!running) return;
    // Perform two flashes
    elements.currentSlider.value = 4; // Ensure on first
    setTimeout(() => {
      doFlash();
      setTimeout(() => {
        doFlash();
      }, 300);
    }, 100);
  });
}

// Initialize
function init() {
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
  log('  Space/F - Flash high beam');
  log('  H       - Toggle high beam');
  log('  S       - Start/Stop');
  log('  R       - Reset');
  log('');
  log('Double-click stalk for double-flash');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
