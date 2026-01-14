// =====================
// ЛУПОГЛАЗ: real eye-warp + blink detect
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

function show(which){
  screenStart.style.display = "none";
  screenPlay.style.display = "none";
  screenLose.style.display = "none";
  which.style.display = "block";
}

function stopAll(){
  if (camera) { try { camera.stop(); } catch {} camera = null; }
  if (faceMesh) { try { faceMesh.close(); } catch {} faceMesh = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

// ---------- helpers
function dist(a,b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// Eye Aspect Ratio (for blink)
function eyeEAR(lm, isLeft){
  const idx = isLeft
    ? [33, 160, 158, 133, 153, 144]      // left
    : [362, 385, 387, 263, 373, 380];    // right

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

// ---------- REAL eye warp (crop eye region and scale it back)
const off = document.createElement("canvas");
const offCtx = off.getContext("2d");

// indices around eyes for bounds (rough, stable)
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

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function warpEye(lm, ringIds, scale){
  // get eye bounds in pixels
  const b = boundsOf(lm, ringIds);

  // add padding so it feels like x2.5
  const pad = 0.18;
  let x1 = b.minX - pad, y1 = b.minY - pad;
  let x2 = b.maxX + pad, y2 = b.maxY + pad;

  x1 = clamp(x1, 0, 1); y1 = clamp(y1, 0, 1);
  x2 = clamp(x2, 0, 1); y2 = clamp(y2, 0, 1);

  const W = canvas.width, H = canvas.height;

  const sx = Math.floor(x1 * W);
  const sy = Math.floor(y1 * H);
  const sw = Math.max(2, Math.floor((x2 - x1) * W));
  const sh = Math.max(2, Math.floor((y2 - y1) * H));

  // offscreen crop
  off.width = sw;
  off.height = sh;
  offCtx.clearRect(0,0,sw,sh);
  offCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  // draw scaled crop back, centered
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = sx - (dw - sw) / 2;
  const dy = sy - (dh - sh) / 2;

  // soft mask (ellipse) for smooth edges
  ctx.save();
  ctx.globalAlpha = 0.98;

  const cx = sx + sw/2;
  const cy = sy + sh/2;
  const rx = (sw * 0.60) * scale;
  const ry = (sh * 0.55) * scale;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(off, 0, 0, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

// ---------- state for blink detector
let calibrateUntil = 0;
let earSamples = [];
let earThreshold = null;
let closedFrames = 0;
let lastBlinkTs = 0;
let running = false;

// TUNE:
const EYE_SCALE = 2.5;        // agreed
const CALIB_MS = 2000;        // 2 sec calibration (no blink)
const FRAMES_TO_CONFIRM = 3;  // if misses -> 2 ; if false -> 4
const DEBOUNCE_MS = 650;

function lose(reason){
  if (!running) return;
  running = false;
  stopAll();
  document.getElementById("loseMeta").textContent = reason;
  show(screenLose);
}

async function start(){
  show(screenPlay);
  hud.textContent = "Калибровка… 2 секунды не моргай";

  earSamples = [];
  earThreshold = null;
  closedFrames = 0;
  lastBlinkTs = 0;
  calibrateUntil = Date.now() + CALIB_MS;
  running = true;

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();

  // set canvas size from real video
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

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
    if (!running) return;

    // draw mirrored base video to canvas
    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const faces = res.multiFaceLandmarks;
    if (!faces || faces.length === 0) return;

    const lm = faces[0];

    // 1) apply REAL eye enlargement (only eyes; neutral face)
    warpEye(lm, LEFT_EYE_RING, EYE_SCALE);
    warpEye(lm, RIGHT_EYE_RING, EYE_SCALE);

    // 2) blink detection (EAR)
    const ear = (eyeEAR(lm, true) + eyeEAR(lm, false)) / 2;
    const now = Date.now();

    if (now < calibrateUntil) {
      // collect baseline when eyes are open-ish
      if (ear > 0.12 && ear < 0.65) earSamples.push(ear);
      return;
    }

    if (earThreshold === null) {
      const base = earSamples.length
        ? earSamples.reduce((a,b)=>a+b,0) / earSamples.length
        : 0.28;

      // IMPORTANT: higher multiplier => harder to trigger (less sensitive).
      // If it does NOT catch your blink, change 0.78 -> 0.82
      // If false triggers, change 0.78 -> 0.74
      earThreshold = Math.max(0.16, base * 0.78);

      hud.textContent = "Отслеживание включено. Не моргай.";
      return;
    }

    const isClosed = ear < earThreshold;
    closedFrames = isClosed ? (closedFrames + 1) : 0;

    if (closedFrames >= FRAMES_TO_CONFIRM && (now - lastBlinkTs) > DEBOUNCE_MS) {
      lastBlinkTs = now;
      lose("Обнаружено моргание.");
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

// buttons
btnStart.onclick = () => start().catch(e => {
  console.error(e);
  alert("Не удалось запустить камеру. Проверь разрешение камеры в браузере.");
});

btnQuit.onclick = () => { running = false; stopAll(); show(screenStart); };
btnRetry.onclick = () => { running = false; stopAll(); start(); };
