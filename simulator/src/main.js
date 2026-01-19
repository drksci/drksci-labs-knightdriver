// KNIGHTDRIVER Simulator

const state = {
  highBeamOn: false,
  driverEnabled: false,
  driverState: false,
  flashCount: 0,
  firstFlashTime: 0,
  lastFlashOffTime: 0,
  lastFlashOnTime: 0,
  flashIndicatorActive: false,
  flashIndicatorStart: 0,
};

const FLASH_TIMEOUT = 3000;
const MIN_FLASH_DURATION = 100;
const MAX_FLASH_DURATION = 2000;

// Elements
const el = {
  stalk: document.getElementById('stalk'),
  hbL: document.getElementById('hb-l'),
  hbR: document.getElementById('hb-r'),
  spotL: document.getElementById('spot-l'),
  spotR: document.getElementById('spot-r'),
  ledHb: document.getElementById('led-hb'),
  ledEnabled: document.getElementById('led-enabled'),
  ledSpots: document.getElementById('led-spots'),
  flashInd: document.getElementById('flash-ind'),
  pip1: document.getElementById('pip1'),
  pip2: document.getElementById('pip2'),
};

// Flash detection
function handleHighBeamOn() {
  const now = Date.now();
  state.lastFlashOnTime = now;

  if (state.lastFlashOffTime > 0) {
    const offDuration = now - state.lastFlashOffTime;
    if (offDuration >= MIN_FLASH_DURATION && offDuration <= MAX_FLASH_DURATION) {
      if (state.flashCount === 0) {
        state.flashCount = 1;
        state.firstFlashTime = now;
        state.flashIndicatorActive = true;
        state.flashIndicatorStart = now;
      } else if (state.flashCount === 1) {
        if (now - state.firstFlashTime <= FLASH_TIMEOUT) {
          state.flashCount = 2;
          state.driverEnabled = !state.driverEnabled;
          setTimeout(resetFlash, 500);
        } else {
          state.flashCount = 1;
          state.firstFlashTime = now;
        }
      }
    }
  }
}

function handleHighBeamOff() {
  state.lastFlashOffTime = Date.now();
  if (state.flashCount > 0 && state.lastFlashOnTime > 0) {
    if (state.lastFlashOffTime - state.lastFlashOnTime > MAX_FLASH_DURATION) {
      resetFlash();
    }
  }
}

function resetFlash() {
  state.flashCount = 0;
  state.firstFlashTime = 0;
  state.lastFlashOffTime = 0;
}

function updateDriver() {
  state.driverState = state.highBeamOn && state.driverEnabled;
}

// Controls
function setHighBeam(on) {
  if (on !== state.highBeamOn) {
    state.highBeamOn = on;
    if (on) handleHighBeamOn();
    else handleHighBeamOff();
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

// UI
function updateUI() {
  el.stalk.classList.toggle('active', state.highBeamOn);
  el.hbL.classList.toggle('on', state.highBeamOn);
  el.hbR.classList.toggle('on', state.highBeamOn);
  el.spotL.classList.toggle('on', state.driverState);
  el.spotR.classList.toggle('on', state.driverState);
  el.ledHb.classList.toggle('on', state.highBeamOn);
  el.ledEnabled.classList.toggle('on', state.driverEnabled);
  el.ledSpots.classList.toggle('on', state.driverState);

  const showFlash = state.flashCount > 0 || state.flashIndicatorActive;
  el.flashInd.classList.toggle('visible', showFlash);
  el.pip1.classList.toggle('active', state.flashCount >= 1);
  el.pip2.classList.toggle('active', state.flashCount >= 2);
}

function tick() {
  const now = Date.now();
  if (state.flashCount > 0 && now - state.firstFlashTime > FLASH_TIMEOUT) {
    resetFlash();
  }
  if (state.flashIndicatorActive && now - state.flashIndicatorStart > 3000) {
    state.flashIndicatorActive = false;
  }
  updateUI();
}

// Tab switching
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// Events
function setupEvents() {
  el.stalk.addEventListener('click', toggleHighBeam);
  el.stalk.addEventListener('dblclick', e => {
    e.preventDefault();
    setHighBeam(true);
    setTimeout(() => {
      doFlash();
      setTimeout(doFlash, 400);
    }, 200);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F' || e.key === ' ') {
      e.preventDefault();
      doFlash();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      toggleHighBeam();
    }
  });
}

// Init
setupTabs();
setupEvents();
setInterval(tick, 50);
updateUI();
