const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const modal = $("#gameModal"), area = $("#gameArea"), title = $("#gameTitle"), category = $("#gameCategory"), timerEl = $("#gameTimer"), instructions = $("#gameInstructions");
let activeGame = null, timers = [], gameState = {};
const bestKeys = {reaction:"qp_reaction",memory:"qp_memory",number:"qp_number",dodge:"qp_dodge"};
const readBest = (id) => Number(localStorage.getItem(bestKeys[id]) || 0);
const saveBest = (id, value) => { if (value > readBest(id)) localStorage.setItem(bestKeys[id], value); updateBests(); };
function updateBests(){
  const vals = Object.keys(bestKeys).map(k=>readBest(k));
  $("#bestScore").textContent = Math.max(0,...vals);
  Object.keys(bestKeys).forEach(k=>{ const el=$("#best-"+k); if(el) el.textContent=readBest(k)||"—"; });
}
function later(fn, ms){ const t=setTimeout(fn,ms); timers.push(t); return t; }
function interval(fn, ms){ const t=setInterval(fn,ms); timers.push(t); return t; }
function clearTimers(){ timers.forEach(t=>{clearTimeout(t);clearInterval(t)});timers=[]; }
function openGame(id){
  clearTimers(); activeGame=id; gameState={}; modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");
  const configs={reaction:["REFLEX TEST","Don't Blink","Wait for green, then click as quickly as possible."],memory:["MEMORY TEST","Memory Overload","Watch the sequence, then repeat it in the same order."],number:["LOGIC TEST","Brain Glitch","Solve as many quick number puzzles as you can in 60 seconds."],dodge:["SURVIVAL TEST","Last Survivor","Move left and right to dodge the falling blocks. Survive for 30 seconds."]};
  [category.textContent,title.textContent,instructions.textContent]=configs[id];
  timerEl.innerHTML='60<span>SEC</span>';
  ({reaction:startReaction,memory:startMemory,number:startNumber,dodge:startDodge}[id])();
}
function closeGame(){clearTimers();modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");activeGame=null;updateBests();}
$$("[data-open]").forEach(b=>b.addEventListener("click",()=>openGame(b.dataset.open)));
$$("[data-close]").forEach(b=>b.addEventListener("click",closeGame));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("open"))closeGame();});
$("#randomBtn").addEventListener("click",()=>{const ids=Object.keys(bestKeys);openGame(ids[Math.floor(Math.random()*ids.length)]);});

function showResult(html, text, restart){
  area.innerHTML=`<div class="result-text">${html}<br><button class="action-btn" id="restartGame">${restart||"PLAY AGAIN"}</button></div>`;
  instructions.textContent=text||"Nice run. Ready for another?";
  $("#restartGame").addEventListener("click",()=>openGame(activeGame));
}
function startReaction(){
  area.innerHTML=`<button class="reaction-pad wait" id="reactionPad">WAIT FOR GREEN</button>`;
  const pad=$("#reactionPad");let phase="waiting",start=0,tries=0;
  const delay=1200+Math.random()*3200;
  pad.addEventListener("click",()=>{
    if(phase==="waiting"){phase="early";clearTimers();pad.className="reaction-pad too-soon";pad.textContent="TOO SOON!";later(()=>{pad.textContent="TRY AGAIN";pad.className="reaction-pad";pad.onclick=()=>startReaction();},900);}
    else if(phase==="ready"){const ms=Math.round(performance.now()-start);saveBest("reaction",Math.max(0,5000-ms));showResult(`Your reaction time<strong>${ms} ms</strong>${ms<250?"⚡ Lightning fast!":ms<350?"Nice reflexes!":"You can beat that."}`,"Lower reaction time is better.","TRY AGAIN");}
  });
  later(()=>{if(activeGame!=="reaction"||phase!=="waiting")return;phase="ready";start=performance.now();pad.className="reaction-pad ready";pad.textContent="CLICK NOW!";},delay);
}
function startMemory(){
  gameState={seq:[],input:[],round:0,locked:true};area.innerHTML=`<div><div class="sequence-grid">${[0,1,2,3].map(i=>`<button class="seq-pad" data-pad="${i}" aria-label="Pad ${i+1}"></button>`).join("")}</div><div class="game-small" id="memoryStatus">PRESS START TO WATCH</div><div style="text-align:center;margin-top:12px"><button class="action-btn" id="memoryStart">START</button></div></div>`;
  const pads=$$(".seq-pad");
  function flash(i){pads[i].classList.add("lit");later(()=>pads[i].classList.remove("lit"),340);}
  function nextRound(){gameState.round++;gameState.seq.push(Math.floor(Math.random()*4));gameState.input=[];gameState.locked=true;$("#memoryStatus").textContent=`ROUND ${gameState.round} — WATCH`;let n=0;const t=interval(()=>{if(n>=gameState.seq.length){clearInterval(t);gameState.locked=false;$("#memoryStatus").textContent="YOUR TURN — REPEAT IT";return;}flash(gameState.seq[n++]);},620);}
  $("#memoryStart").addEventListener("click",()=>{ $("#memoryStart").remove();nextRound(); });
  pads.forEach(p=>p.addEventListener("click",()=>{if(gameState.locked||!gameState.round)return;const v=Number(p.dataset.pad);flash(v);const idx=gameState.input.length;if(v!==gameState.seq[idx]){saveBest("memory",gameState.round-1);showResult(`You reached<strong>ROUND ${gameState.round}</strong>Best sequence: ${gameState.round-1}`,"Memory is a muscle. Give it another go.");return;}gameState.input.push(v);if(gameState.input.length===gameState.seq.length){gameState.locked=true;saveBest("memory",gameState.round);$("#memoryStatus").textContent="PERFECT — NEXT ROUND";later(nextRound,650);}}));
  instructions.textContent="Watch the glowing pads, then repeat the exact sequence. Each round adds one.";
}
function startNumber(){
  gameState={score:0,time:60,ended:false};area.innerHTML=`<div style="width:100%;text-align:center"><div class="number-question" id="numberQuestion"></div><div class="answer-row" id="answerRow"></div><div class="feedback" id="numberFeedback"></div><div class="game-small">SCORE <b id="numberScore">0</b></div></div>`;
  function question(){if(gameState.ended)return;const a=2+Math.floor(Math.random()*13),b=2+Math.floor(Math.random()*12),op=Math.random()<.65?"+":"×",ans=op==="+"?a+b:a*b;gameState.answer=ans;$("#numberQuestion").textContent=`${a} ${op} ${b} = ?`;let opts=new Set([ans]);while(opts.size<4)opts.add(Math.max(1,ans+Math.floor(Math.random()*13)-6));$("#answerRow").innerHTML=[...opts].sort(()=>Math.random()-.5).map(n=>`<button class="answer-choice" data-answer="${n}">${n}</button>`).join("");$$("[data-answer]").forEach(btn=>btn.addEventListener("click",()=>{if(gameState.ended)return;if(Number(btn.dataset.answer)===gameState.answer){gameState.score++;$("#numberFeedback").textContent="CORRECT ✦";}else $("#numberFeedback").textContent="NOT QUITE";$("#numberScore").textContent=gameState.score;question();}));}
  question();let remain=60;timerEl.innerHTML=`${remain}<span>SEC</span>`;const t=interval(()=>{remain--;timerEl.innerHTML=`${remain}<span>SEC</span>`;if(remain<=0){clearInterval(t);gameState.ended=true;saveBest("number",gameState.score);showResult(`TIME'S UP!<strong>${gameState.score} POINTS</strong>Best your score next time.`,"Quick maths. Quick decisions.");}},1000);
}
function startDodge(){
  gameState={x:50,score:0,alive:true,rocks:[],keys:{}};area.innerHTML=`<div><div class="dodge-board" id="dodgeBoard"><div class="dodge-player" id="dodgePlayer"></div></div><div class="dodge-controls"><button id="leftBtn">← LEFT</button><button id="rightBtn">RIGHT →</button></div><div class="game-small">USE ← → OR A / D TO MOVE</div></div>`;
  const board=$("#dodgeBoard"),player=$("#dodgePlayer");let spawnCount=0;
  const keyDown=e=>{if(["ArrowLeft","ArrowRight","a","d","A","D"].includes(e.key)){gameState.keys[e.key.toLowerCase()]=true;e.preventDefault();}};
  const keyUp=e=>{gameState.keys[e.key.toLowerCase()]=false;};
  document.addEventListener("keydown",keyDown);document.addEventListener("keyup",keyUp);
  $("#leftBtn").addEventListener("pointerdown",()=>gameState.keys.left=true);$("#leftBtn").addEventListener("pointerup",()=>gameState.keys.left=false);$("#leftBtn").addEventListener("pointerleave",()=>gameState.keys.left=false);
  $("#rightBtn").addEventListener("pointerdown",()=>gameState.keys.right=true);$("#rightBtn").addEventListener("pointerup",()=>gameState.keys.right=false);$("#rightBtn").addEventListener("pointerleave",()=>gameState.keys.right=false);
  const cleanup=()=>{document.removeEventListener("keydown",keyDown);document.removeEventListener("keyup",keyUp);};gameState.cleanup=cleanup;
  let last=performance.now(),elapsed=0;
  const loop=interval(()=>{if(!gameState.alive)return;const now=performance.now(),dt=Math.min(40,now-last);last=now;elapsed+=dt;
    if(gameState.keys.arrowleft||gameState.keys.a||gameState.keys.left)gameState.x-=dt*.025;
    if(gameState.keys.arrowright||gameState.keys.d||gameState.keys.right)gameState.x+=dt*.025;
    gameState.x=Math.max(4,Math.min(96,gameState.x));player.style.left=gameState.x+"%";
    if(elapsed>Math.max(260,650-gameState.score*15)){elapsed=0;const rock=document.createElement("i");rock.className="dodge-rock";rock.style.left=(Math.random()*94)+"%";board.appendChild(rock);gameState.rocks.push({el:rock,y:-20,x:parseFloat(rock.style.left)});}
    gameState.rocks=gameState.rocks.filter(r=>{r.y+=dt*.16; r.el.style.top=r.y+"px";const px=gameState.x/100*board.clientWidth,rx=r.x/100*board.clientWidth;if(r.y>165&&r.y<205&&Math.abs(px-rx)<22){gameState.alive=false;clearInterval(loop);cleanup();saveBest("dodge",gameState.score);showResult(`YOU SURVIVED<strong>${gameState.score} SEC</strong>Try to last longer next run.`,"The longer you survive, the faster it gets.");return false;}if(r.y>220){r.el.remove();gameState.score++;return false;}return true;});
    if(Math.floor((performance.now()-last)/1000)===-1){} 
    $("#gameInstructions");
    timerEl.innerHTML=`${gameState.score}<span>SEC</span>`;
  },16);
  const maxTimer=later(()=>{if(!gameState.alive)return;gameState.alive=false;clearInterval(loop);cleanup();saveBest("dodge",30);showResult(`YOU SURVIVED<strong>30 SECONDS!</strong>That's a clean escape.`,"You beat the challenge!");},30000);
}
updateBests();
