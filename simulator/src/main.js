// Import wokwi-elements web components
import '@wokwi/elements';

// Simulation state
let running = true; // Auto-start
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
};

// Constants (matching firmware)
const FLASH_TIMEOUT = 3000;
const MIN_FLASH_DURATION = 100;
const MAX_FLASH_DURATION = 2000;

// DOM Elements
const elements = {
  highbeamStalk: document.getElementById('highbeam-stalk'),
  highbeamLeft: document.getElementById('highbeam-left'),
  highbeamRight: document.getElementById('highbeam-right'),
  spotlightLeft: document.getElementById('spotlight-left'),
  spotlightRight: document.getElementById('spotlight-right'),
  statusHighbeam: document.getElementById('status-highbeam'),
  statusEnabled: document.getElementById('status-enabled'),
  statusSpots: document.getElementById('status-spots'),
  flashCount: document.getElementById('flash-count'),
  flashDot1: document.getElementById('flash-dot-1'),
  flashDot2: document.getElementById('flash-dot-2'),
};

// ===== VEHICLE MODE FUNCTIONS (matching firmware exactly) =====

function handleHighBeamOn() {
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
        activateFlashIndicator();
      } else if (state.flashCount === 1) {
        // Check if second flash is within timeout
        const timeSinceFirst = currentTime - state.firstFlashTime;

        if (timeSinceFirst <= FLASH_TIMEOUT) {
          // Second flash detected - TOGGLE driver!
          state.flashCount = 2;
          toggleDriver();
          setTimeout(() => resetFlashDetection(), 500);
        } else {
          // Timeout expired, treat as new first flash
          state.flashCount = 1;
          state.firstFlashTime = currentTime;
        }
      }
    }
  }
}

function handleHighBeamOff() {
  // Record when high beam turned off
  state.lastFlashOffTime = Date.now();

  // Check if the ON duration was too long (not a flash, just normal use)
  if (state.flashCount > 0 && state.lastFlashOnTime > 0) {
    const onDuration = state.lastFlashOffTime - state.lastFlashOnTime;
    if (onDuration > MAX_FLASH_DURATION) {
      resetFlashDetection();
    }
  }
}

function toggleDriver() {
  state.driverEnabled = !state.driverEnabled;
}

function updateDriver() {
  let newDriverState = false;

  // SAFETY: Driver can only be ON if high beam is ON
  if (state.highBeamOn && state.driverEnabled) {
    newDriverState = true;
  }

  state.driverState = newDriverState;
}

function resetFlashDetection() {
  state.flashCount = 0;
  state.firstFlashTime = 0;
  state.lastFlashOffTime = 0;
}

function activateFlashIndicator() {
  state.led11Active = true;
  state.led11StartTime = Date.now();
}

// Toggle high beam state
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

// Flash helper - simulates a quick OFF-ON cycle
function doFlash() {
  if (state.highBeamOn) {
    // Turn off briefly, then back on
    setHighBeam(false);
    setTimeout(() => setHighBeam(true), 150);
  } else {
    // Turn on, then off, then on (to register as flash)
    setHighBeam(true);
    setTimeout(() => {
      setHighBeam(false);
      setTimeout(() => setHighBeam(true), 150);
    }, 200);
  }
}

// Update UI
function updateUI() {
  // Stalk position
  elements.highbeamStalk.classList.toggle('active', state.highBeamOn);

  // High beam lights
  elements.highbeamLeft.classList.toggle('on', state.highBeamOn);
  elements.highbeamRight.classList.toggle('on', state.highBeamOn);

  // Spotlights
  elements.spotlightLeft.classList.toggle('on', state.driverState);
  elements.spotlightRight.classList.toggle('on', state.driverState);

  // Status indicators
  elements.statusHighbeam.classList.toggle('on', state.highBeamOn);
  elements.statusEnabled.classList.toggle('on', state.driverEnabled);
  elements.statusSpots.classList.toggle('on', state.driverState);

  // Flash count indicator
  const showFlashCount = state.flashCount > 0 || state.led11Active;
  elements.flashCount.classList.toggle('visible', showFlashCount);
  elements.flashDot1.classList.toggle('active', state.flashCount >= 1);
  elements.flashDot2.classList.toggle('active', state.flashCount >= 2);
}

// Main simulation loop
function simulationTick() {
  const now = Date.now();

  // Timeout flash detection after 3 seconds
  if (state.flashCount > 0 && (now - state.firstFlashTime) > FLASH_TIMEOUT) {
    resetFlashDetection();
    updateUI();
  }

  // Update flash indicator timeout
  if (state.led11Active && (now - state.led11StartTime) > 3000) {
    state.led11Active = false;
    updateUI();
  }
}

// Event listeners
function setupEventListeners() {
  // High beam stalk click - toggle high beam
  elements.highbeamStalk.addEventListener('click', toggleHighBeam);

  // Double-click on stalk for quick double-flash
  elements.highbeamStalk.addEventListener('dblclick', (e) => {
    e.preventDefault();
    // Perform two flashes
    setHighBeam(true);
    setTimeout(() => {
      doFlash();
      setTimeout(() => doFlash(), 400);
    }, 200);
  });

  // Keyboard shortcuts
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

// Initialize
function init() {
  setupEventListeners();

  // Start simulation loop
  intervalId = setInterval(simulationTick, 50);

  // Initial UI update
  updateUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
