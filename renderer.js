/* ============================================================
   CONFIG — adjust these to customize your desktop companion
   ============================================================ */
const CONFIG = {
  characterScale: 150,
  messageBubbleWidth: 220,
  messageBubbleFontSize: 13,
  messageTextAlign: 'center',
  walkSpeed: 1.4,
  walkBobAmplitude: 6,
  walkBobSpeed: 0.008,
  sleepIntervalMs: 3 * 60 * 1000,
  sleepDurationMs: 60 * 1000,
  messageIntervalMs: 45 * 1000,
  messageDurationMs: 8000,
  focusDurationMs: 25 * 60 * 1000,
  breakDurationMs: 5 * 60 * 1000,
  treatFallDurationMs: 600,
  treatCatchRadius: 40,
  gravitySlideSpeed: 8,
  messages: [
    'breathe in... hold it... breathe out...',
    'take a sip of your tea/coffee',
    'you are coding poetry today',
    'a tiny step forward is still progress',
    'relax your shoulders, you\'re doing great',
    'your focus is a gift to yourself',
    'stretch your wrists, then keep going',
    'every bug you fix makes you stronger',
    'rest is part of the work, not apart from it',
    'you showed up today — that matters',
  ],
};

/* ============================================================
   STATE
   ============================================================ */
const State = {
  WALKING: 'walking',
  FOCUS: 'focus',
  BREAK: 'break',
  SLEEP: 'sleep',
  DRAGGING: 'dragging',
  EATING: 'eating',
  SLIDING: 'sliding',
};

let currentState = State.WALKING;
let petX = 0;
let direction = 1;
let bobPhase = 0;
let screenBounds = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
let sessionEndTime = 0;
let sessionType = null;
let sleepTimer = null;
let sleepEndTimer = null;
let messageTimer = null;
let animationFrame = null;
let lastTimestamp = 0;
let isDragging = false;
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartWindowX = 0;
let dragStartWindowY = 0;
let slideCurrentWindowX = 0;
let slideTargetY = 0;
let slideCurrentWindowY = 0;
let workAreaBottom = 0;
let treatActive = false;
let messageIndex = 0;
let unsubscribePetAction = null;

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const app = document.getElementById('app');
const petContainer = document.getElementById('pet-container');
const petSprite = document.getElementById('pet-sprite');
const dragPaws = document.getElementById('drag-paws');
const messageBubble = document.getElementById('message-bubble');
const messageText = document.getElementById('message-text');
const focusBar = document.getElementById('focus-bar');
const focusBarFill = document.getElementById('focus-bar-fill');
const focusCountdown = document.getElementById('focus-countdown');
const effectsLayer = document.getElementById('effects-layer');
const treatLayer = document.getElementById('treat-layer');

/* ============================================================
   INITIALIZATION
   ============================================================ */
async function init() {
  applyConfigStyles();
  await loadScreenBounds();
  centerPetHorizontally();
  setupEventListeners();
  setupPetActionListener();
  scheduleSleepCycle();
  scheduleMessages();
  startGameLoop();
  updateClickThrough();
}

function applyConfigStyles() {
  petSprite.style.height = `${CONFIG.characterScale}px`;
  messageBubble.style.width = `${CONFIG.messageBubbleWidth}px`;
  messageText.style.fontSize = `${CONFIG.messageBubbleFontSize}px`;
  messageText.style.textAlign = CONFIG.messageTextAlign;
}

async function loadScreenBounds() {
  try {
    screenBounds = await window.petAPI.getScreenBounds();
  } catch {
    screenBounds = {
      workArea: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    };
  }
  workAreaBottom = screenBounds.workArea.y + screenBounds.workArea.height - 320;
}

function centerPetHorizontally() {
  petX = (app.clientWidth - CONFIG.characterScale) / 2;
  updatePetPosition();
}

function setupPetActionListener() {
  unsubscribePetAction = window.petAPI.onPetAction((action) => {
    switch (action) {
      case 'focus-start':
        startFocusSession();
        break;
      case 'break-start':
        startBreakSession();
        break;
      case 'session-end':
        endSession();
        break;
    }
  });
}

function setupEventListeners() {
  petContainer.addEventListener('mousedown', onPetMouseDown);
  petContainer.addEventListener('dblclick', onPetDoubleClick);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('contextmenu', onContextMenu);

  document.addEventListener('mousemove', onDocumentMouseMove);

  window.addEventListener('resize', () => {
    clampPetPosition();
    updatePetPosition();
    updateClickThrough();
  });
}

/* ============================================================
   GAME LOOP
   ============================================================ */
function startGameLoop() {
  lastTimestamp = performance.now();
  animationFrame = requestAnimationFrame(tick);
}

function tick(timestamp) {
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  switch (currentState) {
    case State.WALKING:
    case State.BREAK:
      updateWalking(delta);
      break;
    case State.SLIDING:
      updateSliding(delta);
      break;
    case State.FOCUS:
      updateFocusSession();
      break;
    case State.SLEEP:
      updateSleepEffects(delta);
      break;
    default:
      break;
  }

  animationFrame = requestAnimationFrame(tick);
}

/* ============================================================
   WALKING
   ============================================================ */
function updateWalking(delta) {
  petX += CONFIG.walkSpeed * direction * (delta / 16);

  const maxX = app.clientWidth - CONFIG.characterScale;
  if (petX <= 0) {
    petX = 0;
    direction = 1;
  } else if (petX >= maxX) {
    petX = maxX;
    direction = -1;
  }

  bobPhase += CONFIG.walkBobSpeed * delta;
  const bob = Math.sin(bobPhase) * CONFIG.walkBobAmplitude;

  petContainer.style.transform = `translate(${petX}px, ${bob}px) scaleX(${direction})`;
  petSprite.src = 'assets/pet.png';
  petSprite.classList.remove('focus-pose', 'sleep-pose', 'drag-pose');
}

/* ============================================================
   FOCUS MODE
   ============================================================ */
function startFocusSession() {
  clearSleepTimers();
  if (messageTimer) {
    clearInterval(messageTimer);
    messageTimer = null;
  }
  hideMessage();
  currentState = State.FOCUS;
  sessionType = 'focus';
  sessionEndTime = Date.now() + CONFIG.focusDurationMs;

  petSprite.src = 'assets/pet.png';
  petSprite.classList.add('focus-pose');
  petContainer.style.transform = `translate(${petX}px, 0px) scaleX(1)`;

  focusBar.classList.remove('hidden');
  focusBar.classList.add('focus-mode');
  focusBar.classList.remove('break-mode');
  updateFocusSession();
}

function startBreakSession() {
  clearSleepTimers();
  hideMessage();
  endSessionVisuals();
  scheduleMessages();
  currentState = State.BREAK;
  sessionType = 'break';
  sessionEndTime = Date.now() + CONFIG.breakDurationMs;

  petSprite.src = 'assets/pet.png';

  focusBar.classList.remove('hidden');
  focusBar.classList.add('break-mode');
  focusBar.classList.remove('focus-mode');
}

function updateFocusSession() {
  const remaining = Math.max(0, sessionEndTime - Date.now());
  const total = sessionType === 'focus' ? CONFIG.focusDurationMs : CONFIG.breakDurationMs;
  const elapsed = total - remaining;
  const progress = Math.min(100, (elapsed / total) * 100);

  focusBarFill.style.width = `${progress}%`;
  focusCountdown.textContent = formatTime(remaining);

  if (remaining <= 0) {
    if (sessionType === 'focus') {
      showMessage('focus complete — nice work!');
      startBreakSession();
    } else {
      showMessage('break over — let\'s go!');
      endSession();
    }
  }
}

function endSession() {
  sessionEndTime = 0;
  sessionType = null;
  endSessionVisuals();
  currentState = State.WALKING;
  petSprite.src = 'assets/pet.png';
  scheduleSleepCycle();
  scheduleMessages();
}

function endSessionVisuals() {
  focusBar.classList.add('hidden');
  focusBar.classList.remove('focus-mode', 'break-mode');
  focusBarFill.style.width = '0%';
}

function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/* ============================================================
   SLEEP MODE
   ============================================================ */
function scheduleSleepCycle() {
  clearSleepTimers();
  if (currentState === State.FOCUS || currentState === State.BREAK) return;

  sleepTimer = setTimeout(() => {
    if (currentState === State.WALKING) {
      enterSleep();
    }
  }, CONFIG.sleepIntervalMs);
}

function enterSleep() {
  currentState = State.SLEEP;
  petSprite.src = 'assets/pet.png';
  petSprite.classList.add('sleep-pose');
  petContainer.style.transform = `translate(${petX}px, 4px) scaleX(1)`;

  spawnZzzIcons();

  sleepEndTimer = setTimeout(() => {
    exitSleep();
  }, CONFIG.sleepDurationMs);
}

function exitSleep() {
  if (currentState !== State.SLEEP) return;

  currentState = State.WALKING;
  petSprite.src = 'assets/walk-1.png';
  petSprite.classList.remove('sleep-pose');
  clearEffects();
  scheduleSleepCycle();
}

function updateSleepEffects(delta) {
  bobPhase += 0.003 * delta;
  const bob = Math.sin(bobPhase) * 2;
  petContainer.style.transform = `translate(${petX}px, ${4 + bob}px) scaleX(1)`;
}

function clearSleepTimers() {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
  if (sleepEndTimer) {
    clearTimeout(sleepEndTimer);
    sleepEndTimer = null;
  }
}

function spawnZzzIcons() {
  clearEffects();
  for (let i = 0; i < 3; i++) {
    const zzz = document.createElement('img');
    zzz.src = 'assets/zzz.png';
    zzz.className = 'zzz-icon';
    zzz.style.left = `${petX + CONFIG.characterScale * 0.5 + i * 18}px`;
    zzz.style.animationDelay = `${i * 0.6}s`;
    zzz.draggable = false;
    effectsLayer.appendChild(zzz);
  }
}

/* ============================================================
   MESSAGES
   ============================================================ */
function scheduleMessages() {
  if (messageTimer) clearInterval(messageTimer);
  if (currentState === State.FOCUS) return;

  messageTimer = setInterval(() => {
    if (currentState === State.WALKING || currentState === State.BREAK) {
      const msg = CONFIG.messages[messageIndex % CONFIG.messages.length];
      messageIndex++;
      showMessage(msg);
    }
  }, CONFIG.messageIntervalMs);
}

function showMessage(text) {
  messageText.textContent = text;
  messageBubble.classList.remove('hidden');
  messageBubble.classList.add('visible');
  positionMessageBubble();

  clearTimeout(messageBubble.hideTimer);
  messageBubble.hideTimer = setTimeout(hideMessage, CONFIG.messageDurationMs);
}

function hideMessage() {
  messageBubble.classList.remove('visible');
  messageBubble.classList.add('hidden');
}

function positionMessageBubble() {
  const bubbleX = petX + CONFIG.characterScale / 2 - CONFIG.messageBubbleWidth / 2;
  messageBubble.style.left = `${Math.max(4, Math.min(bubbleX, app.clientWidth - CONFIG.messageBubbleWidth - 4))}px`;
}

/* ============================================================
   FEEDING / TREATS
   ============================================================ */
function onPetDoubleClick(e) {
  e.preventDefault();
  if (treatActive || currentState === State.DRAGGING) return;
  dropTreat();
}

function dropTreat() {
  treatActive = true;
  const treat = document.createElement('img');
  treat.src = 'assets/treat.png';
  treat.className = 'treat-falling';
  treat.draggable = false;

  const startX = petX + CONFIG.characterScale / 2 - 16;
  treat.style.left = `${startX}px`;
  treat.style.top = '-40px';
  treatLayer.appendChild(treat);

  const petCenterX = petX + CONFIG.characterScale / 2;
  const petCenterY = CONFIG.characterScale * 0.6;
  const targetY = petCenterY - 20;

  let startTime = null;

  function fallStep(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min(1, (timestamp - startTime) / CONFIG.treatFallDurationMs);
    const ease = progress * progress;
    treat.style.top = `${-40 + (targetY + 40) * ease}px`;

    if (progress < 1) {
      requestAnimationFrame(fallStep);
    } else {
      catchTreat(treat, petCenterX, targetY);
    }
  }

  requestAnimationFrame(fallStep);
}

function catchTreat(treat, x, y) {
  treat.remove();
  treatActive = false;

  const prevState = currentState;
  currentState = State.EATING;

  showMessage('thank you! *munch*');
  spawnHearts(x, y);

  setTimeout(() => {
    if (currentState === State.EATING) {
      currentState = prevState === State.FOCUS || prevState === State.BREAK ? prevState : State.WALKING;
    }
  }, 2000);
}

function spawnHearts(x, y) {
  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = '♥';
    heart.style.left = `${x - 10 + (Math.random() - 0.5) * 40}px`;
    heart.style.top = `${y}px`;
    heart.style.animationDelay = `${i * 0.15}s`;
    heart.style.color = `hsl(${340 + Math.random() * 20}, 80%, 65%)`;
    effectsLayer.appendChild(heart);

    setTimeout(() => heart.remove(), 2000);
  }
}

/* ============================================================
   DRAG & DROP PHYSICS
   ============================================================ */
async function onPetMouseDown(e) {
  if (e.button !== 0) return;
  isDragging = true;
  currentState = State.DRAGGING;

  dragStartMouseX = e.screenX;
  dragStartMouseY = e.screenY;

  const winPos = await window.petAPI.getWindowPosition();
  dragStartWindowX = winPos.x;
  dragStartWindowY = winPos.y;

  petSprite.classList.add('drag-pose');
  dragPaws.classList.remove('hidden');
  hideMessage();
  window.petAPI.setIgnoreMouseEvents(false);
}

function onMouseMove(e) {
  if (!isDragging) return;

  const deltaX = e.screenX - dragStartMouseX;
  const deltaY = e.screenY - dragStartMouseY;

  window.petAPI.setWindowPosition(
    dragStartWindowX + deltaX,
    dragStartWindowY + deltaY
  );

  const lift = Math.min(0, deltaY * 0.3);
  petContainer.style.transform = `translate(${petX}px, ${lift}px) rotate(-8deg)`;
}

async function onMouseUp() {
  if (!isDragging) return;
  isDragging = false;
  dragPaws.classList.add('hidden');
  petSprite.classList.remove('drag-pose');

  const winPos = await window.petAPI.getWindowPosition();
  slideCurrentWindowY = winPos.y;
  slideCurrentWindowX = winPos.x;
  slideTargetY = workAreaBottom;
  currentState = State.SLIDING;
  clampPetPosition();
  petContainer.style.transform = `translate(${petX}px, 0px)`;
  updateClickThrough();
}

function updateSliding(delta) {
  const step = CONFIG.gravitySlideSpeed * (delta / 16);
  slideCurrentWindowY += (slideTargetY - slideCurrentWindowY) * Math.min(1, step * 0.12);

  window.petAPI.setWindowPosition(
    slideCurrentWindowX,
    slideCurrentWindowY
  );

  const dropOffset = Math.max(0, (slideCurrentWindowY - slideTargetY) * 0.15);
  petContainer.style.transform = `translate(${petX}px, ${-dropOffset}px)`;

  if (Math.abs(slideTargetY - slideCurrentWindowY) < 1) {
    window.petAPI.setWindowPosition(slideCurrentWindowX, slideTargetY);
    petContainer.style.transform = `translate(${petX}px, 0px)`;

    if (sessionType === 'focus') {
      currentState = State.FOCUS;
      petSprite.src = 'assets/pet.png';
    } else if (sessionType === 'break') {
      currentState = State.BREAK;
      petSprite.src = 'assets/pet.png';
    } else {
      currentState = State.WALKING;
      petSprite.src = 'assets/pet.png';
    }
    updateClickThrough();
  }
}

function clampPetPosition() {
  const maxX = app.clientWidth - CONFIG.characterScale;
  petX = Math.max(0, Math.min(petX, maxX));
}

function onContextMenu(e) {
  e.preventDefault();
  window.petAPI.showContextMenu();
}

/* ============================================================
   CLICK-THROUGH FOR TRANSPARENT AREAS
   ============================================================ */
function isOverInteractiveElement(x, y) {
  if (isDragging) return true;

  const el = document.elementFromPoint(x, y);
  if (!el) return false;

  const interactive = el.closest('#pet-container, #focus-bar, #message-bubble.visible, .treat-falling');
  if (interactive) return true;

  if (!messageBubble.classList.contains('hidden') && messageBubble.classList.contains('visible')) {
    const rect = messageBubble.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return true;
    }
  }

  return false;
}

function onDocumentMouseMove(e) {
  if (isDragging) return;

  if (isOverInteractiveElement(e.clientX, e.clientY)) {
    window.petAPI.setIgnoreMouseEvents(false);
  } else {
    window.petAPI.setIgnoreMouseEvents(true, { forward: true });
  }
}

function updateClickThrough() {
  window.petAPI.setIgnoreMouseEvents(true, { forward: true });
}

function clearEffects() {
  effectsLayer.innerHTML = '';
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (messageTimer) clearInterval(messageTimer);
  clearSleepTimers();
  if (unsubscribePetAction) unsubscribePetAction();
});

function updatePetPosition() {
  petContainer.style.transform = `translate(${petX}px, 0px) scaleX(${direction})`;
}
