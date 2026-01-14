const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("btnStart");
const quitBtn = document.getElementById("btnQuit");

const screenStart = document.getElementById("screenStart");
const screenPlay = document.getElementById("screenPlay");

let faceMesh;
let camera;

function show(play) {
  screenStart.style.display = play ? "none" : "block";
  screenPlay.style.display = play ? "block" : "none";
}

function resize() {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
}

function drawBigEyes(lm) {
  // Left eye outer corner: 33, right eye outer corner: 263
  const left = lm[33];
  const right = lm[263];

  // Convert to pixels
  const lx = left.x * canvas.width;
  const ly = left.y * canvas.height;
  const rx = right.x * canvas.width;
  const ry = right.y * canvas.height;

  // Eye distance
  const dx = rx - lx;
  const dy = ry - ly;
  const d = Math.hypot(dx, dy);

  // Big eyes strength (≈ x2.5 feeling)
  const R = Math.max(18, d * 0.9);

  function eye(x, y) {
    // White part
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(x, y, R * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fill();
  }

  // Neutral: we do NOT modify mouth/brows. Only eyes.
  eye(lx, ly);
  eye(rx, ry);
}

async function start() {
  show(true);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  resize();

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
    // Draw base video
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Overlay big eyes if face found
    if (res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0) {
      drawBigEyes(res.multiFaceLandmarks[0]);
    }
  });

  camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });

  camera.start();

  // If the phone rotates / resizes
  window.addEventListener("resize", () => resize());
}

startBtn.onclick = () => {
  start().catch((e) => {
    console.error(e);
    alert("Не удалось запустить камеру. Проверь разрешение камеры в браузере.");
  });
};

quitBtn.onclick = () => {
  // simplest reset
  location.reload();
};
