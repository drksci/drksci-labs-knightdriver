// Import wokwi-elements web components
import '@wokwi/elements';

// System state (matching firmware exactly)
const state = {
  highBeamOn: false,
  driverEnabled: false,
  driverState: false,
  flashCount: 0,
  firstFlashTime: 0,
  lastFlashOffTime: 0,
  lastFlashOnTime: 0,
  led13State: false,
  led11Active: false,
  led11StartTime: 0,
  lastLed13Toggle: 0,
};

// Constants (matching firmware)
const FLASH_TIMEOUT = 3000;
const MIN_FLASH_DURATION = 100;
const MAX_FLASH_DURATION = 2000;
const DRIVER_LED_INTERVAL = 150;

// DOM Elements
const el = {
  // Circuit panel
  led13: document.getElementById('led-13'),
  led11: document.getElementById('led-11'),
  sensorAmps: document.getElementById('sensor-amps'),
  sensorAdc: document.getElementById('sensor-adc'),
  driverOutput: document.getElementById('driver-output'),
  sigHb: document.getElementById('sig-hb'),
  sigSensor: document.getElementById('sig-sensor'),
  sigMcu: document.getElementById('sig-mcu'),
  sigDriver: document.getElementById('sig-driver'),
  sigSpots: document.getElementById('sig-spots'),
  stHighbeam: document.getElementById('st-highbeam'),
  stEnabled: document.getElementById('st-enabled'),
  stActive: document.getElementById('st-active'),
  flashCountText: document.getElementById('flash-count'),

  // Dash panel
  stalk: document.getElementById('stalk'),
  hbLeft: document.getElementById('hb-left'),
  hbRight: document.getElementById('hb-right'),
  spotLeft: document.getElementById('spot-left'),
  spotRight: document.getElementById('spot-right'),
  flashInd: document.getElementById('flash-ind'),
  pip1: document.getElementById('pip-1'),
  pip2: document.getElementById('pip-2'),
  dashHb: document.getElementById('dash-hb'),
  dashEnabled: document.getElementById('dash-enabled'),
  dashSpots: document.getElementById('dash-spots'),
};

// ===== FLASH DETECTION LOGIC (matching firmware) =====

function handleHighBeamOn() {
  const currentTime = Date.now();
  state.lastFlashOnTime = currentTime;

  if (state.lastFlashOffTime > 0) {
    const offDuration = currentTime - state.lastFlashOffTime;

    if (offDuration >= MIN_FLASH_DURATION && offDuration <= MAX_FLASH_DURATION) {
      if (state.flashCount === 0) {
        state.flashCount = 1;
        state.firstFlashTime = currentTime;
        state.led11Active = true;
        state.led11StartTime = currentTime;
      } else if (state.flashCount === 1) {
        const timeSinceFirst = currentTime - state.firstFlashTime;
        if (timeSinceFirst <= FLASH_TIMEOUT) {
          state.flashCount = 2;
          state.driverEnabled = !state.driverEnabled;
          setTimeout(resetFlashDetection, 500);
        } else {
          state.flashCount = 1;
          state.firstFlashTime = currentTime;
        }
      }
    }
  }
}

function handleHighBeamOff() {
  state.lastFlashOffTime = Date.now();

  if (state.flashCount > 0 && state.lastFlashOnTime > 0) {
    const onDuration = state.lastFlashOffTime - state.lastFlashOnTime;
    if (onDuration > MAX_FLASH_DURATION) {
      resetFlashDetection();
    }
  }
}

function updateDriver() {
  // SAFETY: Driver can only be ON if high beam is ON
  state.driverState = state.highBeamOn && state.driverEnabled;
}

function resetFlashDetection() {
  state.flashCount = 0;
  state.firstFlashTime = 0;
  state.lastFlashOffTime = 0;
}

// ===== CONTROLS =====

function setHighBeam(on) {
  if (on !== state.highBeamOn) {
    state.highBeamOn = on;
    if (state.highBeamOn) {
      handleHighBeamOn();
    } else {
      handleHighBeamOff();
    }
    updateDriver();
    updateUI();
  }
}

function toggleHighBeam() {
  setHighBeam(!state.highBeamOn);
}

function doFlash() {
  if (state.highBeamOn) {
    setHighBeam(false);
    setTimeout(() => setHighBeam(true), 150);
  } else {
    setHighBeam(true);
    setTimeout(() => {
      setHighBeam(false);
      setTimeout(() => setHighBeam(true), 150);
    }, 200);
  }
}

// ===== UI UPDATES =====

function updateUI() {
  const now = Date.now();

  // Simulated current reading
  const amps = state.highBeamOn ? 5.2 : 0.0;
  const adc = Math.round(512 + (amps * 20.48));

  // Circuit panel - sensor
  el.sensorAmps.textContent = `${amps.toFixed(1)}A`;
  el.sensorAdc.textContent = `ADC: ${adc}`;

  // Circuit panel - driver
  el.driverOutput.textContent = state.driverState ? 'ON' : 'OFF';
  el.driverOutput.classList.toggle('on', state.driverState);
  el.driverOutput.classList.toggle('off', !state.driverState);

  // Circuit panel - LEDs
  // D13 flashes when driver is active
  if (state.driverState) {
    if (now - state.lastLed13Toggle >= DRIVER_LED_INTERVAL) {
      state.led13State = !state.led13State;
      state.lastLed13Toggle = now;
    }
  } else {
    state.led13State = false;
  }
  el.led13.classList.toggle('on', state.led13State);

  // D11 flashes during flash detection
  const led11On = state.led11Active && (Math.floor((now - state.led11StartTime) / 100) % 2 === 0);
  el.led11.classList.toggle('on', led11On);

  // Circuit panel - signal flow
  el.sigHb.classList.toggle('active', state.highBeamOn);
  el.sigSensor.classList.toggle('active', state.highBeamOn);
  el.sigMcu.classList.toggle('active', state.highBeamOn);
  el.sigDriver.classList.toggle('active', state.driverState);
  el.sigSpots.classList.toggle('active', state.driverState);

  // Circuit panel - status
  el.stHighbeam.classList.toggle('on', state.highBeamOn);
  el.stEnabled.classList.toggle('on', state.driverEnabled);
  el.stActive.classList.toggle('on', state.driverState);
  el.flashCountText.textContent = state.flashCount;

  // Dash panel - stalk
  el.stalk.classList.toggle('active', state.highBeamOn);

  // Dash panel - light beams
  el.hbLeft.classList.toggle('on', state.highBeamOn);
  el.hbRight.classList.toggle('on', state.highBeamOn);
  el.spotLeft.classList.toggle('on', state.driverState);
  el.spotRight.classList.toggle('on', state.driverState);

  // Dash panel - flash indicator
  const showFlash = state.flashCount > 0 || state.led11Active;
  el.flashInd.classList.toggle('visible', showFlash);
  el.pip1.classList.toggle('active', state.flashCount >= 1);
  el.pip2.classList.toggle('active', state.flashCount >= 2);

  // Dash panel - status
  el.dashHb.classList.toggle('on', state.highBeamOn);
  el.dashEnabled.classList.toggle('on', state.driverEnabled);
  el.dashSpots.classList.toggle('on', state.driverState);
}

// ===== SIMULATION LOOP =====

function tick() {
  const now = Date.now();

  // Timeout flash detection
  if (state.flashCount > 0 && (now - state.firstFlashTime) > FLASH_TIMEOUT) {
    resetFlashDetection();
  }

  // Timeout flash LED indicator
  if (state.led11Active && (now - state.led11StartTime) > 3000) {
    state.led11Active = false;
  }

  updateUI();
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
  el.stalk.addEventListener('click', toggleHighBeam);

  el.stalk.addEventListener('dblclick', (e) => {
    e.preventDefault();
    setHighBeam(true);
    setTimeout(() => {
      doFlash();
      setTimeout(() => doFlash(), 400);
    }, 200);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F' || e.key === ' ') {
      e.preventDefault();
      doFlash();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      toggleHighBeam();
    }
  });
}

// ===== INIT =====

function init() {
  setupEventListeners();
  setInterval(tick, 50);
  updateUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
