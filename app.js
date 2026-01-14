const ROUND_SECONDS = 120;
const REVENGE_PAY_URL = "https://example.com/pay";

const $ = id => document.getElementById(id);
const screens = {
  start: $("screenStart"),
  play: $("screenPlay"),
  lose: $("screenLose"),
  win: $("screenWin")
};

let startTs, interval;

function show(name){
  Object.values(screens).forEach(s => s.style.display = "none");
  screens[name].style.display = "block";
}

function fmt(s){
  return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
}

function startRound(){
  show("play");
  startTs = Date.now();
  interval = setInterval(() => {
    const elapsed = Math.floor((Date.now()-startTs)/1000);
    const left = ROUND_SECONDS - elapsed;
    $("timer").textContent = fmt(Math.max(0,left));
    if(left<=0){
      clearInterval(interval);
      $("winMeta").textContent = "Время: 02:00";
      show("win");
    }
    if(Math.random() < 0.01){
      clearInterval(interval);
      $("loseMeta").textContent = "Проигрыш на "+fmt(left);
      show("lose");
    }
  },1000);
}

$("btnStart").onclick = startRound;
$("btnRetry").onclick = startRound;
$("btnAgain").onclick = startRound;
$("btnRevenge").onclick = () => window.location.href = REVENGE_PAY_URL;
$("btnQuit").onclick = () => show("start");
