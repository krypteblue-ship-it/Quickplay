// ========================================
// QUICKPLAY - DREAM ARCADE
// ========================================

const SUPABASE_URL = "https://pnrraouvmsvlqjwtoidu.supabase.co";
const SUPABASE_KEY = "sb_publishable_d7q_nldLR539QSLJ5MkmXQ_-nFmSAT3";

if (!window.supabase) {
  throw new Error("Supabase library did not load. Check the Supabase script tag in index.html.");
}

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const modal = $("#gameModal");
const area = $("#gameArea");
const title = $("#gameTitle");
const category = $("#gameCategory");
const timerEl = $("#gameTimer");
const instructions = $("#gameInstructions");

let activeGame = null;
let timers = [];
let gameState = {};
let playerId = null;
let playerName = null;
let leaderboardGame = "reaction";

const bestKeys = {
  reaction: "qp_reaction",
  memory: "qp_memory",
  number: "qp_number",
  dodge: "qp_dodge"
};

const games = {
  reaction: {
    name: "Don't Blink",
    category: "REFLEX",
    instructions: "Wait for green, then click as quickly as possible.",
    start: startReaction
  },
  memory: {
    name: "Memory Overload",
    category: "MEMORY",
    instructions: "Watch the sequence, then repeat it in the correct order.",
    start: startMemory
  },
  number: {
    name: "Brain Glitch",
    category: "LOGIC",
    instructions: "Solve as many maths questions as you can in 60 seconds.",
    start: startNumber
  },
  dodge: {
    name: "Last Survivor",
    category: "SURVIVAL",
    instructions: "Use the arrow keys, A/D or your pointer to dodge obstacles.",
    start: startDodge
  }
};

// ========================================
// TIMER MANAGEMENT
// ========================================

function later(callback, delay) {
  const id = setTimeout(callback, delay);
  timers.push({ id, type: "timeout" });
  return id;
}

function interval(callback, delay) {
  const id = setInterval(callback, delay);
  timers.push({ id, type: "interval" });
  return id;
}

function clearTimers() {
  timers.forEach((timer) => {
    if (timer.type === "interval") clearInterval(timer.id);
    else clearTimeout(timer.id);
  });
  timers = [];
}

function clearGameArea() {
  clearTimers();

  if (gameState.frame) cancelAnimationFrame(gameState.frame);
  if (gameState.removeListeners) gameState.removeListeners();

  if (area) area.innerHTML = "";
  if (timerEl) timerEl.textContent = "";
}

// ========================================
// PLAYER REGISTRATION
// ========================================

function createPlayerUI(message = "") {
  if ($("#playerDialog")) return;

  const overlay = document.createElement("div");
  overlay.id = "playerDialog";
  overlay.className = "qp-overlay";

  overlay.innerHTML = `
    <div class="qp-dialog">
      <h2>Welcome to QUICKPLAY ✨</h2>
      <p>Choose a username to save your personal bests and join the global leaderboards.</p>
      <input id="qpUsername" type="text" maxlength="20"
        placeholder="Enter username" autocomplete="off">
      <div class="qp-error" id="qpError">${escapeHTML(message)}</div>
      <button class="primary-btn" id="qpRegister">Let's Play</button>
    </div>
  `;

  document.body.appendChild(overlay);

  $("#qpRegister").addEventListener("click", registerPlayer);
  $("#qpUsername").addEventListener("keydown", (event) => {
    if (event.key === "Enter") registerPlayer();
  });
}

async function initializePlayer() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    let session = data.session;

    if (!session) {
      const result = await db.auth.signInAnonymously();
      if (result.error) throw result.error;
      session = result.data.session;
    }

    playerId = session.user.id;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("username")
      .eq("id", playerId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile && profile.username) {
      playerName = profile.username;
      showPlayerName();
      refreshLeaderboards();
    } else {
      createPlayerUI();
    }
  } catch (error) {
    console.error("Player initialization error:", error);
    createPlayerUI("Player service unavailable. Check your connection and Supabase settings.");
  }
}

async function registerPlayer() {
  const input = $("#qpUsername");
  const errorBox = $("#qpError");
  const button = $("#qpRegister");
  const username = input.value.trim();

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    errorBox.textContent = "Use 3–20 letters, numbers or underscores.";
    return;
  }

  if (!playerId) {
    errorBox.textContent = "Player connection is not ready. Refresh and try again.";
    return;
  }

  button.disabled = true;
  button.textContent = "Creating...";

  try {
    const { data, error } = await db
      .from("profiles")
      .insert({ id: playerId, username })
      .select("username")
      .single();

    if (error) throw error;

    playerName = data.username;
    $("#playerDialog").remove();
    showPlayerName();
    refreshLeaderboards();
  } catch (error) {
    console.error("Registration error:", error);
    errorBox.textContent = error.code === "23505"
      ? "That username is already taken."
      : (error.message || "Could not create your profile.");

    button.disabled = false;
    button.textContent = "Let's Play";
  }
}

function showPlayerName() {
  let display = $("#qpPlayerDisplay");

  if (!display) {
    display = document.createElement("div");
    display.id = "qpPlayerDisplay";
    display.className = "qp-player";

    const topbar = $(".topbar");
    if (topbar) topbar.appendChild(display);
  }

  display.textContent = playerName ? `👤 ${playerName}` : "";
}

// ========================================
// PERSONAL BESTS
// ========================================

function updateBests() {
  Object.keys(bestKeys).forEach((id) => {
    const best = Number(localStorage.getItem(bestKeys[id]) || 0);
    const element = $(`#best-${id}`);
    if (element) element.textContent = best || "—";
  });

  const total = Object.keys(bestKeys).reduce((sum, id) => {
    return sum + Number(localStorage.getItem(bestKeys[id]) || 0);
  }, 0);

  if ($("#bestScore")) $("#bestScore").textContent = total;
}

async function saveBest(id, value) {
  const score = Math.max(0, Math.floor(Number(value) || 0));
  const key = bestKeys[id];
  if (!key) return false;

  const previous = Number(localStorage.getItem(key) || 0);
  if (score <= previous) return false;

  localStorage.setItem(key, String(score));
  gameState.newBest = true;
  updateBests();

  await submitScore(id, score);
  return true;
}

async function submitScore(id, score) {
  if (!playerId) return;

  try {
    const { error } = await db.from("scores").insert({
      user_id: playerId,
      game_id: id,
      score
    });

    if (error) {
      console.error("Score submission error:", error);
      return;
    }

    await loadLeaderboard(leaderboardGame);
  } catch (error) {
    console.error("Score submission failed:", error);
  }
}

// ========================================
// LEADERBOARD
// ========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function createLeaderboardUI() {
  if ($("#qpLeaderboards")) return;

  const grid = $(".game-grid");
  if (!grid) return;

  const section = document.createElement("section");
  section.id = "qpLeaderboards";

  section.innerHTML = `
    <h2>🏆 Global Leaderboards</h2>
    <p>See how you compare with other players.</p>

    <div class="qp-tabs">
      <button class="qp-tab active" data-leaderboard="reaction">Don't Blink</button>
      <button class="qp-tab" data-leaderboard="memory">Memory</button>
      <button class="qp-tab" data-leaderboard="number">Brain Glitch</button>
      <button class="qp-tab" data-leaderboard="dodge">Last Survivor</button>
    </div>

    <div id="qpLeaderboardContent" class="qp-table-wrap">
      <div class="qp-empty">Loading leaderboard...</div>
    </div>
  `;

  grid.after(section);

  $$(".qp-tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".qp-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      leaderboardGame = button.dataset.leaderboard;
      loadLeaderboard(leaderboardGame);
    });
  });
}

async function loadLeaderboard(id) {
  const content = $("#qpLeaderboardContent");
  if (!content) return;

  content.innerHTML = `<div class="qp-empty">Loading scores...</div>`;

  try {
    const { data, error } = await db
      .from("scores")
      .select("score,created_at,profiles(username)")
      .eq("game_id", id)
      .order("score", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML = `<div class="qp-empty">No scores yet. Be the first!</div>`;
      return;
    }

    const rows = data.map((item, index) => {
      const username = item.profiles?.username || "Player";
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(username)}</td>
          <td>${Number(item.score)}</td>
        </tr>
      `;
    }).join("");

    content.innerHTML = `
      <table class="qp-table">
        <thead>
          <tr><th>Rank</th><th>Player</th><th>Score</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (error) {
    console.error("Leaderboard error:", error);
    content.innerHTML = `
      <div class="qp-empty">Leaderboard could not load. Check Supabase permissions.</div>
    `;
  }
}

async function refreshLeaderboards() {
  await loadLeaderboard(leaderboardGame);
}

// ========================================
// OPEN AND CLOSE GAMES
// ========================================

function openGame(id) {
  if (!games[id] || !modal) return;

  activeGame = id;
  gameState = { newBest: false };
  clearGameArea();

  title.textContent = games[id].name;
  category.textContent = games[id].category;
  instructions.textContent = games[id].instructions;

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  games[id].start();
}

function closeGame() {
  clearGameArea();
  activeGame = null;

  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
}

$$("[data-open]").forEach((button) => {
  button.addEventListener("click", () => openGame(button.dataset.open));
});

$$("[data-close]").forEach((button) => {
  button.addEventListener("click", closeGame);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeGame) closeGame();
});

if ($("#randomBtn")) {
  $("#randomBtn").addEventListener("click", () => {
    const ids = Object.keys(games);
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    openGame(randomId);
  });
}

// ========================================
// RESULTS AND CELEBRATIONS
// ========================================

const celebrationMessages = [
  "YOU'RE UNSTOPPABLE!",
  "THAT WAS CLEAN!",
  "LEGENDARY PERFORMANCE!",
  "ABSOLUTE CHAMPION!",
  "LOOK AT YOU GO!"
];

function createConfetti() {
  for (let i = 0; i < 45; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = [
      "#b99aff", "#ff9bcf", "#a8f0d0", "#fff1d9"
    ][Math.floor(Math.random() * 4)];
    piece.style.animationDelay = `${Math.random() * 0.7}s`;
    piece.style.setProperty("--drift", `${Math.random() * 180 - 90}px`);

    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3500);
  }
}

function showResult(resultHTML, message, restart) {
  const celebration = celebrationMessages[
    Math.floor(Math.random() * celebrationMessages.length)
  ];

  const bestMessage = gameState.newBest
    ? `<div class="new-best">★ NEW PERSONAL BEST! ★</div>`
    : "";

  area.innerHTML = `
    <div class="result-card">
      <h2>${celebration}</h2>
      ${resultHTML}
      <p class="result-message">${message}</p>
      ${bestMessage}
      <br><br>
      <button class="primary-btn" id="restartGame">Play Again ↻</button>
    </div>
  `;

  createConfetti();

  $("#restartGame").addEventListener("click", () => {
    gameState = { newBest: false };
    clearGameArea();
    restart();
  });
}

// ========================================
// GAME 1 - DON'T BLINK
// ========================================

function startReaction() {
  clearGameArea();

  gameState = {
    started: false,
    startTime: 0,
    newBest: gameState.newBest || false
  };

  area.innerHTML = `
    <button class="reaction-pad" id="reactionPad">WAIT FOR GREEN...</button>
  `;

  const pad = $("#reactionPad");
  const wait = 1500 + Math.random() * 3500;

  later(() => {
    if (activeGame !== "reaction") return;
    gameState.started = true;
    gameState.startTime = performance.now();
    pad.classList.add("ready");
    pad.textContent = "CLICK NOW!";
  }, wait);

  pad.addEventListener("click", async () => {
    if (!gameState.started) {
      clearTimers();
      pad.disabled = true;
      pad.textContent = "TOO SOON! TRY AGAIN...";

      later(() => {
        if (activeGame === "reaction") startReaction();
      }, 900);
      return;
    }

    gameState.started = false;
    const milliseconds = Math.round(performance.now() - gameState.startTime);
    const score = Math.max(1, 5000 - milliseconds);

    await saveBest("reaction", score);

    showResult(
      `<strong>${milliseconds} ms</strong>`,
      "Your reaction time has been recorded.",
      startReaction
    );
  });
}

// ========================================
// GAME 2 - MEMORY OVERLOAD
// ========================================

function startMemory() {
  clearGameArea();

  gameState = {
    round: 1,
    sequence: [],
    inputIndex: 0,
    showing: false,
    newBest: gameState.newBest || false
  };

  area.innerHTML = `
    <div style="width:100%;text-align:center">
      <h3 id="memoryRound">ROUND 1</h3>
      <div class="sequence-grid">
        <button class="sequence-pad" data-pad="0" aria-label="Pad 1"></button>
        <button class="sequence-pad" data-pad="1" aria-label="Pad 2"></button>
        <button class="sequence-pad" data-pad="2" aria-label="Pad 3"></button>
        <button class="sequence-pad" data-pad="3" aria-label="Pad 4"></button>
      </div>
      <p id="memoryMessage">Watch the sequence...</p>
    </div>
  `;

  $$(".sequence-pad").forEach((pad) => {
    pad.addEventListener("click", () => {
      if (gameState.showing) return;

      const chosen = Number(pad.dataset.pad);
      const expected = gameState.sequence[gameState.inputIndex];

      if (chosen !== expected) {
        finishMemory();
        return;
      }

      flashPad(chosen);
      gameState.inputIndex++;

      if (gameState.inputIndex >= gameState.sequence.length) {
        gameState.round++;
        later(nextMemoryRound, 650);
      }
    });
  });

  nextMemoryRound();
}

function flashPad(index) {
  const pad = $(`[data-pad="${index}"]`);
  if (!pad) return;

  pad.classList.add("active");
  later(() => pad.classList.remove("active"), 220);
}

function nextMemoryRound() {
  if (activeGame !== "memory") return;

  gameState.sequence.push(Math.floor(Math.random() * 4));
  gameState.inputIndex = 0;
  gameState.showing = true;

  $("#memoryRound").textContent = `ROUND ${gameState.round}`;
  $("#memoryMessage").textContent = "Watch carefully...";

  let index = 0;

  function showNext() {
    if (activeGame !== "memory") return;

    if (index >= gameState.sequence.length) {
      gameState.showing = false;
      $("#memoryMessage").textContent = "Your turn!";
      return;
    }

    flashPad(gameState.sequence[index]);
    index++;
    later(showNext, 650);
  }

  later(showNext, 450);
}

async function finishMemory() {
  clearTimers();

  const score = Math.max(0, gameState.round - 1);
  await saveBest("memory", score);

  showResult(
    `<strong>ROUND ${score}</strong>`,
    "You reached this round. Can you beat it next time?",
    startMemory
  );
}

// ========================================
// GAME 3 - BRAIN GLITCH
// ========================================

function startNumber() {
  clearGameArea();

  gameState = {
    score: 0,
    time: 60,
    newBest: gameState.newBest || false
  };

  area.innerHTML = `
    <div style="width:100%;text-align:center">
      <div class="number-question" id="numberQuestion"></div>
      <div class="answer-grid" id="answerGrid"></div>
      <p id="numberScore">Score: 0</p>
    </div>
  `;

  updateNumberQuestion();
  timerEl.textContent = "60s";

  interval(() => {
    gameState.time--;
    timerEl.textContent = `${gameState.time}s`;

    if (gameState.time <= 0) finishNumber();
  }, 1000);
}

function updateNumberQuestion() {
  if (activeGame !== "number") return;

  const first = Math.floor(Math.random() * 15) + 2;
  const second = Math.floor(Math.random() * 12) + 2;
  const operations = ["+", "-", "×"];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  let answer;
  if (operation === "+") answer = first + second;
  if (operation === "-") answer = first - second;
  if (operation === "×") answer = first * second;

  gameState.answer = answer;
  $("#numberQuestion").textContent = `${first} ${operation} ${second} = ?`;

  const choices = new Set([answer]);

  while (choices.size < 4) {
    const offset = Math.floor(Math.random() * 15) + 1;
    const wrong = answer + (Math.random() > 0.5 ? offset : -offset);
    if (wrong >= 0) choices.add(wrong);
  }

  const shuffled = [...choices].sort(() => Math.random() - 0.5);

  $("#answerGrid").innerHTML = shuffled.map((value) => `
    <button class="answer-choice" data-answer="${value}">${value}</button>
  `).join("");

  $$(".answer-choice").forEach((button) => {
    button.addEventListener("click", () => {
      if (Number(button.dataset.answer) === gameState.answer) {
        gameState.score++;
        $("#numberScore").textContent = `Score: ${gameState.score}`;
      }
      updateNumberQuestion();
    });
  });
}

async function finishNumber() {
  clearTimers();
  await saveBest("number", gameState.score);

  showResult(
    `<strong>${gameState.score} POINTS</strong>`,
    "Time is up! Your score has been saved.",
    startNumber
  );
}

// ========================================
// GAME 4 - LAST SURVIVOR
// ========================================

function startDodge() {
  clearGameArea();

  gameState = {
    time: 0,
    playerX: 50,
    keys: {},
    finished: false,
    newBest: gameState.newBest || false
  };

  area.innerHTML = `
    <div style="width:100%;text-align:center">
      <p>Use ← → or A / D to move. You can also move your pointer.</p>
      <div class="dodge-board" id="dodgeBoard">
        <div class="dodge-player" id="dodgePlayer"></div>
      </div>
      <p id="dodgeScore">Survived: 0 seconds</p>
    </div>
  `;

  const board = $("#dodgeBoard");
  const player = $("#dodgePlayer");

  function keyDown(event) {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
      event.preventDefault();
      gameState.keys[key] = true;
    }
  }

  function keyUp(event) {
    gameState.keys[event.key.toLowerCase()] = false;
  }

  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);

  gameState.removeListeners = () => {
    document.removeEventListener("keydown", keyDown);
    document.removeEventListener("keyup", keyUp);
  };

  board.addEventListener("pointermove", (event) => {
    const rect = board.getBoundingClientRect();

    gameState.playerX = Math.max(
      5,
      Math.min(95, ((event.clientX - rect.left) / rect.width) * 100)
    );
  });

  let lastObstacle = 0;
  let lastFrame = performance.now();

  function animate(now) {
    if (activeGame !== "dodge" || gameState.finished) return;

    const delta = Math.min(40, now - lastFrame);
    lastFrame = now;
    gameState.time += delta;

    if (gameState.keys.a || gameState.keys.arrowleft) {
      gameState.playerX -= delta * 0.035;
    }

    if (gameState.keys.d || gameState.keys.arrowright) {
      gameState.playerX += delta * 0.035;
    }

    gameState.playerX = Math.max(5, Math.min(95, gameState.playerX));
    player.style.left = `${gameState.playerX}%`;

    if (now - lastObstacle > 650) {
      createObstacle(board);
      lastObstacle = now;
    }

    const obstacles = [...board.querySelectorAll(".dodge-rock")];

    for (const rock of obstacles) {
      const top = Number(rock.dataset.top || 0) + delta * 0.12;
      rock.dataset.top = top;
      rock.style.top = `${top}px`;

      const rockLeft = Number(rock.dataset.left);

      if (top > 225 && top < 265 && Math.abs(rockLeft - gameState.playerX) < 8) {
        finishDodge();
        return;
      }

      if (top > 300) rock.remove();
    }

    const seconds = Math.floor(gameState.time / 1000);
    $("#dodgeScore").textContent = `Survived: ${seconds} seconds`;
    timerEl.textContent = `${seconds}s`;

    gameState.frame = requestAnimationFrame(animate);
  }

  gameState.frame = requestAnimationFrame(animate);
}

function createObstacle(board) {
  const rock = document.createElement("div");
  const left = 5 + Math.random() * 90;

  rock.className = "dodge-rock";
  rock.dataset.top = "0";
  rock.dataset.left = String(left);
  rock.style.left = `${left}%`;

  board.appendChild(rock);
}

async function finishDodge() {
  if (gameState.finished) return;

  gameState.finished = true;
  if (gameState.frame) cancelAnimationFrame(gameState.frame);
  if (gameState.removeListeners) gameState.removeListeners();

  const seconds = Math.floor(gameState.time / 1000);
  await saveBest("dodge", seconds);

  showResult(
    `<strong>${seconds} SEC</strong>`,
    "You survived for this long. Give it another shot!",
    startDodge
  );
}

// ========================================
// INITIALIZE
// ========================================

updateBests();
createLeaderboardUI();
initializePlayer();

console.log("QUICKPLAY initialized successfully.");
