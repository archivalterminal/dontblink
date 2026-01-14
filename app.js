// =====================
// ЛУПОГЛАЗ: Android-proof
// Camera starts ONCE, rounds reset without getUserMedia again
// =====================

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");

const screenStart = document.getElementById("screenStart");
const screenPlay = document.getElementById("screenPlay");
const screenLose = document.getElementById("screenLose");

const btnStart = document.getElementById("btnStart");
const btnQuit  = document.getElementById("btnQuit");
const btnRetry = document.getElementById("btnRetry");

let stream = null;
let faceMesh = null;
let camera = null;

let sessionStarted = false;  // camera+facemesh started once
let playing = false;         // round active
let starting = false;

// ---------- UI
function show(which){
  screenStart.style.display = "none";
  screenPlay.style.display = "none";
  screenLose.style.display = "none";
  which.style.display = "block";
}

// ---------- helpers
function dist(a,b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function eyeEAR(lm, isLeft){
  const idx = isLeft
    ? [33, 160, 158, 133, 153, 144]
    : [362, 385, 387, 263, 373, 380];

  const p1 = lm[idx[0]];
  const p2 = lm[idx[1]];
  const p3 = lm[idx[2]];
  const p4 = lm[idx[3]];
  const p5 = lm[idx[4]];
  const p6 = lm[idx[5]];

  const v1 = dist(p2,p6);
  const v2 = dist(p3,p5);
  const h  = dist(p1,p4);
  if (h < 1e-6) return 0;
  return (v1 + v2) / (2*h);
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// ---------- REAL eye warp (stable, not “whole head”)
const off = document.createElement("canvas");
const offCtx = off.getContext("2d");

const LEFT_EYE_RING  = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_RING = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];

function boundsOf(lm, ids){
  let minX=1, minY=1, maxX=0, maxY=0;
  for (const i of ids){
    const p = lm[i];
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return {minX, minY, maxX, maxY};
}

// “лупоглаз” по ощущению, без разнесения
const EYE_SCALE = 1.70;   // если мало -> 1.85
const PAD = 0.07;
const ALPHA = 0.98;

function warpEye(lm, ringIds){
  const b = boundsOf(lm, ringIds);

  let x1 = clamp(b.minX - PAD, 0, 1);
  let y1 = clamp(b.minY - PAD, 0, 1);
  let x2 = clamp(b.maxX + PAD, 0, 1);
  let y2 = clamp(b.maxY + PAD, 0, 1);

  const W = canvas.width, H = canvas.height;

  const sx = Math.floor(x1 * W);
  const sy = Math.floor(y1 * H);
  const sw = Math.max(2, Math.floor((x2 - x1) * W));
  const sh = Math.max(2, Math.floor((y2 - y1) * H));

  off.width = sw;
  off.height = sh;
  offCtx.clearRect(0,0,sw,sh);
  offCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const dw = sw * EYE_SCALE;
  const dh = sh * EYE_SCALE;
  const dx = sx - (dw - sw) / 2;
  const dy = sy - (dh - sh) / 2;

  ctx.save();
  ctx.globalAlpha = ALPHA;

  const cx = sx + sw/2;
  const cy = sy + sh/2;
  const rx = (sw * 0.52) * EYE_SCALE;
  const ry = (sh * 0.48) * EYE_SCALE;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(off, 0, 0, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

// ---------- Round (blink) state
let calibrateUntil = 0;
let graceUntil = 0;

let earSamples = [];
let earThreshold = null;

let closedFrames = 0;
let lastBlinkTs = 0;
let seenOpenEyes = false;

// tuning
const CALIB_MS = 2000;
const GRACE_MS = 1200;
const FRAMES_TO_CONFIRM = 4;
const DEBOUNCE_MS = 700;
const THRESH_MULT = 0.70;

function resetRound(){
  earSamples = [];
  earThreshold = null;
  closedFrames = 0;
  lastBlinkTs = 0;
  seenOpenEyes = false;

  calibrateUntil = Date.now() + CALIB_MS;
  graceUntil = calibrateUntil + GRACE_MS;

  hud.textContent = "Калибровка… 2 секунды не моргай";
  playing = true;
}

function lose(){
  if (!playing) return;
  playing = false;
  document.getElementById("loseMeta").textContent = "Обнаружено моргание.";
  show(screenLose);
}

// ---------- Start camera ONCE
function waitLoadedMetadata(v){
  return new Promise((resolve) => {
    if (v.readyState >= 1 && v.videoWidth) return resolve();
    v.addEventListener("loadedmetadata", () => resolve(), { once: true });
  });
}

async function startSessionOnce(){
  if (sessionStarted) return;
  sessionStarted = true;

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
  await waitLoadedMetadata(video);

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  try { await video.play(); } catch {}

  faceMesh = new FaceMesh({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults((res) => {
    // draw mirrored base video always
    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const faces = res.multiFaceLandmarks;
    if (!faces || faces.length === 0) {
      if (playing) hud.textContent = "Лицо не видно. Поднеси телефон ближе.";
      return;
    }

    const lm = faces[0];

    // Filter ALWAYS ON (even on lose screen it will keep drawing if canvas visible)
    warpEye(lm, LEFT_EYE_RING);
    warpEye(lm, RIGHT_EYE_RING);

    // If round not active, don't detect blinks
    if (!playing) return;

    // blink detect
    const ear = (eyeEAR(lm, true) + eyeEAR(lm, false)) / 2;
    const now = Date.now();

    if (now < calibrateUntil) {
      if (ear > 0.20 && ear < 0.65) earSamples.push(ear);
      return;
    }

    if (earThreshold === null) {
      const base = earSamples.length
        ? earSamples.reduce((a,b)=>a+b,0) / earSamples.length
        : 0.28;
      earThreshold = Math.max(0.16, base * THRESH_MULT);
      hud.textContent = "Не моргай.";
      return;
    }

    if (ear > earThreshold * 1.20) seenOpenEyes = true;
    if (now < graceUntil) return;
    if (!seenOpenEyes) return;

    const isClosed = ear < earThreshold;
    closedFrames = isClosed ? (closedFrames + 1) : 0;

    if (closedFrames >= FRAMES_TO_CONFIRM && (now - lastBlinkTs) > DEBOUNCE_MS) {
      lastBlinkTs = now;
      lose();
    }
  });

  camera = new Camera(video, {
    onFrame: async () => {
      if (!faceMesh) return;
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });

  camera.start();
}

// ---------- Stop everything only on Quit
function stopSession(){
  playing = false;
  sessionStarted = false;

  if (camera) { try { camera.stop(); } catch {} camera = null; }
  if (faceMesh) { try { faceMesh.close(); } catch {} faceMesh = null; }

  if (stream) {
    try { stream.getTracks().forEach(t => t.stop()); } catch {}
    stream = null;
  }

  try { video.pause(); } catch {}
  try { video.srcObject = null; } catch {}
}

// ---------- Main actions
async function startGame(){
  if (starting) return;
  starting = true;
  try {
    show(screenPlay);
    await startSessionOnce();   // camera only once
    resetRound();               // round resets any time
  } catch (e) {
    console.error(e);
    alert("Камера не запустилась. Проверь разрешение камеры в Chrome.");
    show(screenStart);
  } finally {
    starting = false;
  }
}

// buttons
btnStart.onclick = () => startGame();
btnRetry.onclick = () => startGame();

btnQuit.onclick = () => {
  stopSession();     // only here we stop camera
  show(screenStart);
};
