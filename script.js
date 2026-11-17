// ========================================
// QUICKPLAY — DREAM ARCADE
// UPGRADED EDITION
// ========================================


// ========================================
// SUPABASE
// ========================================

const SUPABASE_URL =
  "https://pnrraouvmsvlqjwtoidu.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_d7q_nldLR539QSLJ5MkmXQ_-nFmSAT3";

if (!window.supabase) {
  throw new Error("Supabase library did not load.");
}

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ========================================
// ELEMENT HELPERS
// ========================================

const $ = selector => document.querySelector(selector);

const $$ = selector => [...document.querySelectorAll(selector)];

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
let leaderboardRequest = 0;


// ========================================
// GAME INFORMATION
// ========================================

const bestKeys = {
  reaction: "qp_reaction",
  memory: "qp_memory",
  number: "qp_number",
  dodge: "qp_dodge",
  runner: "qp_runner",
  bubble: "qp_bubble"
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
    instructions: "Watch the sequence, then repeat it.",
    start: startMemory
  },

  number: {
    name: "Brain Glitch",
    category: "LOGIC",
    instructions: "Solve as many maths questions as possible in 60 seconds.",
    start: startNumber
  },

  dodge: {
    name: "Last Survivor",
    category: "SURVIVAL",
    instructions: "Control your spaceship and dodge incoming asteroids!",
    start: startDodge
  },

  runner: {
    name: "Neon Runner",
    category: "ACTION",
    instructions: "Jump over obstacles and collect coins!",
    start: startRunner
  },

  bubble: {
    name: "Bubble Pop",
    category: "ARCADE",
    instructions: "Pop as many bubbles as possible before time runs out!",
    start: startBubble
  }

};


// ========================================
// AUDIO SYSTEM
// ========================================

let audioContext = null;

let soundEnabled =
  localStorage.getItem("qp_sound") !== "off";


function ensureAudio() {

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}


function tone(
  frequency = 440,
  duration = 0.12,
  type = "sine",
  volume = 0.06,
  endFrequency = null
) {

  if (!soundEnabled) return;

  const ctx = ensureAudio();

  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(
    frequency,
    ctx.currentTime
  );

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      ctx.currentTime + duration
    );
  }

  gain.gain.setValueAtTime(
    volume,
    ctx.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}


function playSfx(name) {

  if (!soundEnabled) return;

  const sounds = {

    click: () => {
      tone(520, 0.07, "sine", 0.04);
    },

    countdown: () => {
      tone(400, 0.12, "sine", 0.05);
    },

    ready: () => {
      tone(600, 0.12, "sine", 0.06, 1100);
      setTimeout(() => tone(1100, 0.15, "sine", 0.06), 100);
    },

    false: () => {
      tone(240, 0.25, "sawtooth", 0.06, 90);
    },

    success: () => {
      tone(520, 0.12);
      setTimeout(() => tone(660, 0.12), 100);
      setTimeout(() => tone(880, 0.2), 200);
    },

    correct: () => {
      tone(740, 0.12, "sine", 0.05);
    },

    wrong: () => {
      tone(220, 0.2, "triangle", 0.06, 130);
    },

    jump: () => {
      tone(300, 0.16, "sine", 0.05, 700);
    },

    coin: () => {
      tone(900, 0.09, "sine", 0.04, 1400);
    },

    hit: () => {
      tone(170, 0.3, "sawtooth", 0.07, 55);
    },

    pop: () => {
      tone(650, 0.1, "sine", 0.05, 220);
    },

    gameover: () => {
      tone(400, 0.2, "triangle", 0.05, 220);
      setTimeout(() => tone(220, 0.3, "triangle", 0.05, 100), 180);
    },

    memory0: () => tone(350, 0.22),
    memory1: () => tone(470, 0.22),
    memory2: () => tone(590, 0.22),
    memory3: () => tone(750, 0.22)

  };

  sounds[name]?.();
}


function createSoundButton() {

  const status = $(".game-status");

  if (!status || $("#soundToggle")) return;

  const button = document.createElement("button");

  button.id = "soundToggle";
  button.className = "sound-toggle";

  updateSoundButton(button);

  button.addEventListener("click", () => {

    soundEnabled = !soundEnabled;

    localStorage.setItem(
      "qp_sound",
      soundEnabled ? "on" : "off"
    );

    updateSoundButton(button);

    if (soundEnabled) {
      playSfx("click");
    }

  });

  status.appendChild(button);
}


function updateSoundButton(button) {

  button.textContent = soundEnabled
    ? "🔊 SOUND ON"
    : "🔇 SOUND OFF";

  button.setAttribute(
    "aria-label",
    soundEnabled ? "Mute sounds" : "Enable sounds"
  );

}


// ========================================
// CHARACTER HELPERS
// ========================================

function gameCharacter(image, alt, extraClass = "") {

  return `
    <div class="game-mascot ${extraClass}">
      <img src="assets/${image}.png" alt="${alt}">
    </div>
  `;

}


function mascotMessage(selector, message) {

  const element = $(selector);

  if (element) {
    element.textContent = message;
  }

}


// ========================================
// TIMER MANAGEMENT
// ========================================

function later(callback, delay) {

  const id = setTimeout(callback, delay);

  timers.push({
    id,
    type: "timeout"
  });

  return id;

}


function interval(callback, delay) {

  const id = setInterval(callback, delay);

  timers.push({
    id,
    type: "interval"
  });

  return id;

}


function clearTimers() {

  timers.forEach(timer => {

    if (timer.type === "interval") {
      clearInterval(timer.id);
    } else {
      clearTimeout(timer.id);
    }

  });

  timers = [];

}


function clearGameArea() {

  clearTimers();

  if (gameState.frame) {
    cancelAnimationFrame(gameState.frame);
  }

  if (gameState.removeListeners) {
    gameState.removeListeners();
  }

  if (area) {
    area.innerHTML = "";
  }

  if (timerEl) {
    timerEl.textContent = "";
  }

}


// ========================================
// PLAYER REGISTRATION
// ========================================

function escapeHTML(value) {

  return String(value).replace(/[&<>"']/g, character => {

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


function createPlayerUI(message = "") {

  if ($("#playerDialog")) return;

  const overlay = document.createElement("div");

  overlay.id = "playerDialog";
  overlay.className = "qp-overlay";

  overlay.innerHTML = `

    <div class="qp-dialog">

      <h2>Welcome to QUICKPLAY ✨</h2>

      <p>
        Choose a username to save your personal bests
        and join the global leaderboards.
      </p>

      <input
        id="qpUsername"
        type="text"
        maxlength="20"
        placeholder="Enter username"
        autocomplete="off"
      >

      <div class="qp-error" id="qpError">
        ${escapeHTML(message)}
      </div>

      <button class="primary-btn" id="qpRegister">
        Let's Play
      </button>

    </div>

  `;

  document.body.appendChild(overlay);

  $("#qpRegister").addEventListener(
    "click",
    registerPlayer
  );

  $("#qpUsername").addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        registerPlayer();
      }
    }
  );

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

    if (profile?.username) {

      playerName = profile.username;

      showPlayerName();

      refreshLeaderboards();

    } else {

      createPlayerUI();

    }

  } catch (error) {

    console.error("Player initialization error:", error);

    createPlayerUI(
      "Player service unavailable. Check your connection and Supabase settings."
    );

  }

}


async function registerPlayer() {

  const input = $("#qpUsername");
  const errorBox = $("#qpError");
  const button = $("#qpRegister");

  const username = input.value.trim();

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {

    errorBox.textContent =
      "Use 3–20 letters, numbers or underscores.";

    return;

  }

  if (!playerId) {

    errorBox.textContent =
      "Player connection is not ready. Refresh and try again.";

    return;

  }

  button.disabled = true;
  button.textContent = "Creating...";

  try {

    const { data, error } = await db
      .from("profiles")
      .insert({
        id: playerId,
        username
      })
      .select("username")
      .single();

    if (error) throw error;

    playerName = data.username;

    $("#playerDialog").remove();

    showPlayerName();

    refreshLeaderboards();

  } catch (error) {

    console.error("Registration error:", error);

    errorBox.textContent =
      error.code === "23505"
        ? "That username is already taken."
        : (error.message || "Could not create your profile.");

    button.disabled = false;
    button.textContent = "Let's Play";

  }

}


function showPlayerName() {

  const display = $("#qpPlayerDisplay");

  if (display) {

    display.textContent = playerName
      ? `👤 ${playerName}`
      : "";

  }

}


// ========================================
// PERSONAL BESTS
// ========================================

// Reaction score is measured in milliseconds.
// Lower is better for reaction.
// Higher is better for all other games.

function isBetterScore(id, score, previous) {

  if (id === "reaction") {

    return previous === 0 || score < previous;

  }

  return score > previous;

}


function formatBest(id, value) {

  if (!value) return "—";

  if (id === "reaction") {
    return `${value} ms`;
  }

  return value;

}


function updateBests() {

  Object.keys(bestKeys).forEach(id => {

    const best = Number(
      localStorage.getItem(bestKeys[id]) || 0
    );

    const element = $(`#best-${id}`);

    if (element) {
      element.textContent = formatBest(id, best);
    }

  });

  // Reaction time is not included in the total score.

  const total = [
    "memory",
    "number",
    "dodge",
    "runner",
    "bubble"
  ].reduce((sum, id) => {

    return sum + Number(
      localStorage.getItem(bestKeys[id]) || 0
    );

  }, 0);

  if ($("#bestScore")) {
    $("#bestScore").textContent = total;
  }

}


async function saveBest(id, value) {

  const score = Math.max(
    0,
    Math.floor(Number(value) || 0)
  );

  const key = bestKeys[id];

  if (!key || score <= 0) return false;

  const previous = Number(
    localStorage.getItem(key) || 0
  );

  if (!isBetterScore(id, score, previous)) {
    return false;
  }

  localStorage.setItem(
    key,
    String(score)
  );

  gameState.newBest = true;

  updateBests();

  await submitScore(id, score);

  return true;

}


// ========================================
// SUPABASE SCORE SUBMISSION
// ========================================

async function submitScore(id, score) {

  if (!playerId || !playerName) return;

  try {

    const { error } = await db
      .from("scores")
      .insert({
        user_id: playerId,
        game_id: id,
        score
      });

    if (error) {

      console.error(
        "Score submission error:",
        error
      );

      return;

    }

    if (leaderboardGame === id) {
      await loadLeaderboard(id);
    }

  } catch (error) {

    console.error(
      "Score submission failed:",
      error
    );

  }

}


// ========================================
// LEADERBOARD
// ========================================

function createLeaderboardUI() {

  const section = $("#qpLeaderboards");

  if (!section) return;

  // The main heading is already present in index.html.
  // Only create the tabs and leaderboard table here.

  section.innerHTML = `

    <div class="qp-tabs">

      <button class="qp-tab active" data-leaderboard="reaction">
        Don't Blink
      </button>

      <button class="qp-tab" data-leaderboard="memory">
        Memory
      </button>

      <button class="qp-tab" data-leaderboard="number">
        Brain Glitch
      </button>

      <button class="qp-tab" data-leaderboard="dodge">
        Last Survivor
      </button>

      <button class="qp-tab" data-leaderboard="runner">
        Neon Runner
      </button>

      <button class="qp-tab" data-leaderboard="bubble">
        Bubble Pop
      </button>

    </div>

    <div id="qpLeaderboardContent" class="qp-table-wrap">

      <div class="qp-empty">
        Loading leaderboard...
      </div>

    </div>

  `;

  $$(".qp-tab").forEach(button => {

    button.addEventListener("click", () => {

      $$(".qp-tab").forEach(tab => {
        tab.classList.remove("active");
      });

      button.classList.add("active");

      leaderboardGame = button.dataset.leaderboard;

      loadLeaderboard(leaderboardGame);

    });

  });

}


async function loadLeaderboard(id) {

  const content = $("#qpLeaderboardContent");

  if (!content) return;

  const requestNumber = ++leaderboardRequest;

  content.innerHTML = `
    <div class="qp-empty">Loading scores...</div>
  `;

  try {

    const ascending = id === "reaction";

    const { data, error } = await db
      .from("scores")
      .select("user_id,score,created_at,profiles(username)")
      .eq("game_id", id)
      .order("score", {
        ascending
      })
      .limit(1000);

    if (error) throw error;

    if (requestNumber !== leaderboardRequest) return;

    if (leaderboardGame !== id) return;

    if (!data || data.length === 0) {

      content.innerHTML = `
        <div class="qp-empty">
          No scores yet. Be the first!
        </div>
      `;

      return;

    }

    // Keep only the best score for each player.

    const uniquePlayers = new Map();

    data.forEach(item => {

      const profile = Array.isArray(item.profiles)
        ? item.profiles[0]
        : item.profiles;

      const username = profile?.username || "Player";

      const playerKey = item.user_id || username;

      const score = Number(item.score);

      if (!Number.isFinite(score)) return;

      const existing = uniquePlayers.get(playerKey);

      if (!existing) {

        uniquePlayers.set(playerKey, {
          user_id: playerKey,
          username,
          score
        });

        return;

      }

      const better = id === "reaction"
        ? score < existing.score
        : score > existing.score;

      if (better) {
        existing.score = score;
      }

    });

    const sortedPlayers = [...uniquePlayers.values()]
      .sort((a, b) => {

        return id === "reaction"
          ? a.score - b.score
          : b.score - a.score;

      })
      .slice(0, 10);

    if (!sortedPlayers.length) {

      content.innerHTML = `
        <div class="qp-empty">
          No scores yet. Be the first!
        </div>
      `;

      return;

    }

    const rows = sortedPlayers.map((player, index) => {

      const displayScore = id === "reaction"
        ? `${player.score} ms`
        : player.score;

      return `

        <tr>

          <td>${index + 1}</td>

          <td>${escapeHTML(player.username)}</td>

          <td>${displayScore}</td>

        </tr>

      `;

    }).join("");

    content.innerHTML = `

      <table class="qp-table">

        <thead>

          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>${id === "reaction" ? "Time" : "Score"}</th>
          </tr>

        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

    `;

  } catch (error) {

    console.error("Leaderboard error:", error);

    if (requestNumber !== leaderboardRequest) return;

    content.innerHTML = `

      <div class="qp-empty">
        Leaderboard could not load.
        Check Supabase permissions.
      </div>

    `;

  }

}


async function refreshLeaderboards() {

  await loadLeaderboard(leaderboardGame);

}


// ========================================
// GAME OPEN / CLOSE
// ========================================

function openGame(id) {

  if (!games[id] || !modal) return;

  // Clear the previous game BEFORE replacing gameState.
  clearGameArea();

  activeGame = id;

  gameState = {
    newBest: false
  };

  title.textContent = games[id].name;

  category.textContent = games[id].category;

  instructions.textContent = games[id].instructions;

  modal.classList.add("active");

  modal.setAttribute("aria-hidden", "false");

  createSoundButton();

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


$$("[data-open]").forEach(button => {

  button.addEventListener("click", () => {
    openGame(button.dataset.open);
  });

});


$$("[data-close]").forEach(button => {

  button.addEventListener("click", closeGame);

});


document.addEventListener("keydown", event => {

  if (event.key === "Escape" && activeGame) {
    closeGame();
  }

});


$("#randomBtn")?.addEventListener("click", () => {

  const ids = Object.keys(games);

  const randomId = ids[
    Math.floor(Math.random() * ids.length)
  ];

  openGame(randomId);

});


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

      "#b99aff",
      "#ff9bcf",
      "#a8f0d0",
      "#fff1d9"

    ][Math.floor(Math.random() * 4)];

    piece.style.animationDelay =
      `${Math.random() * 0.7}s`;

    piece.style.setProperty(
      "--drift",
      `${Math.random() * 180 - 90}px`
    );

    document.body.appendChild(piece);

    setTimeout(() => piece.remove(), 3500);

  }

}


function showResult(resultHTML, message, restart) {

  clearTimers();

  const celebration = celebrationMessages[
    Math.floor(Math.random() * celebrationMessages.length)
  ];

  const bestMessage = gameState.newBest
    ? `<div class="new-best">★ NEW PERSONAL BEST! ★</div>`
    : "";

  playSfx("success");

  area.innerHTML = `

    <div class="result-card">

      <h2>${celebration}</h2>

      ${resultHTML}

      <p class="result-message">
        ${message}
      </p>

      ${bestMessage}

      <br><br>

      <button class="primary-btn" id="restartGame">
        Play Again ↻
      </button>

    </div>

  `;

  createConfetti();

  $("#restartGame").addEventListener("click", () => {

    clearGameArea();

    gameState = {
      newBest: false
    };

    restart();

  });

}


// ========================================
// GAME 1 — DON'T BLINK
// ========================================

function startReaction() {

  clearGameArea();

  gameState = {
    started: false,
    finished: false,
    startTime: 0,
    newBest: gameState.newBest || false
  };

  area.innerHTML = `

    <div class="reaction-game">

      ${gameCharacter(
        "monster",
        "Purple cartoon monster",
        "monster-mascot"
      )}

      <p class="character-message" id="monsterMessage">
        Don't click yet! 👀
      </p>

      <button
        class="reaction-buzzer"
        id="reactionBuzzer"
      >
        WAIT FOR GREEN
      </button>

      <p class="survivor-tip">
        Click only when the button turns green.
      </p>

    </div>

  `;

  const button = $("#reactionBuzzer");

  const wait = 1800 + Math.random() * 3700;

  playSfx("countdown");

  later(() => {

    if (activeGame !== "reaction") return;

    if (gameState.finished) return;

    gameState.started = true;

    gameState.startTime = performance.now();

    button.classList.add("ready");

    button.textContent = "PRESS NOW!";

    mascotMessage(
      "#monsterMessage",
      "GO GO GO! 👾"
    );

    $(".monster-mascot")?.classList.add(
      "mascot-excited"
    );

    timerEl.textContent = "GO!";

    playSfx("ready");

  }, wait);


  button.addEventListener("click", async () => {

    if (gameState.finished) return;

    ensureAudio();

    if (!gameState.started) {

      gameState.finished = true;

      clearTimers();

      button.disabled = true;

      button.classList.add("false-start");

      button.textContent = "TOO EARLY!";

      mascotMessage(
        "#monsterMessage",
        "Oops! You jumped the gun! 😵"
      );

      $(".monster-mascot")?.classList.add(
        "mascot-confused"
      );

      timerEl.textContent = "FALSE START";

      playSfx("false");

      later(() => {

        if (activeGame === "reaction") {
          startReaction();
        }

      }, 1100);

      return;

    }

    gameState.finished = true;

    gameState.started = false;

    const milliseconds = Math.max(
      1,
      Math.round(
        performance.now() - gameState.startTime
      )
    );

    await saveBest(
      "reaction",
      milliseconds
    );

    showResult(
      `<strong>${milliseconds} ms</strong>`,
      "Your reaction time has been recorded. Lower is better!",
      startReaction
    );

  });

}


// ========================================
// GAME 2 — MEMORY OVERLOAD
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

    <div class="memory-game" style="width:100%;text-align:center">

      ${gameCharacter(
        "cubes",
        "Colourful cube characters",
        "cube-mascot"
      )}

      <h3 id="memoryRound">ROUND 1</h3>

      <div class="sequence-grid">

        <button class="sequence-pad" data-pad="0"></button>

        <button class="sequence-pad" data-pad="1"></button>

        <button class="sequence-pad" data-pad="2"></button>

        <button class="sequence-pad" data-pad="3"></button>

      </div>

      <p id="memoryMessage">
        Watch the sequence...
      </p>

    </div>

  `;

  $$(".sequence-pad").forEach(pad => {

    pad.addEventListener("click", () => {

      if (gameState.showing) return;

      const chosen = Number(pad.dataset.pad);

      const expected =
        gameState.sequence[gameState.inputIndex];

      playSfx(`memory${chosen}`);

      if (chosen !== expected) {

        playSfx("wrong");

        finishMemory();

        return;

      }

      flashPad(chosen);

      gameState.inputIndex++;

      if (
        gameState.inputIndex >=
        gameState.sequence.length
      ) {

        gameState.round++;

        playSfx("correct");

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

  playSfx(`memory${index}`);

  later(() => {
    pad.classList.remove("active");
  }, 280);

}


function nextMemoryRound() {

  if (activeGame !== "memory") return;

  gameState.sequence.push(
    Math.floor(Math.random() * 4)
  );

  gameState.inputIndex = 0;

  gameState.showing = true;

  $("#memoryRound").textContent =
    `ROUND ${gameState.round}`;

  $("#memoryMessage").textContent =
    "Watch carefully...";

  let index = 0;

  function showNext() {

    if (activeGame !== "memory") return;

    if (index >= gameState.sequence.length) {

      gameState.showing = false;

      $("#memoryMessage").textContent =
        "Your turn!";

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

  const score = Math.max(
    0,
    gameState.round - 1
  );

  await saveBest("memory", score);

  showResult(
    `<strong>ROUND ${score}</strong>`,
    "You reached this round. Can you beat it next time?",
    startMemory
  );

}


// ========================================
// GAME 3 — BRAIN GLITCH
// ========================================

function startNumber() {

  clearGameArea();

  gameState = {

    score: 0,

    time: 60,

    newBest: gameState.newBest || false

  };

  area.innerHTML = `

    <div class="number-game" style="width:100%;text-align:center">

      ${gameCharacter(
        "robot",
        "Cute robot",
        "robot-mascot"
      )}

      <p class="character-message" id="robotMessage">
        Let's solve some numbers! 🧠
      </p>

      <div
        class="number-question"
        id="numberQuestion">
      </div>

      <div
        class="answer-grid"
        id="answerGrid">
      </div>

      <p id="numberScore">
        Score: 0
      </p>

    </div>

  `;

  updateNumberQuestion();

  timerEl.textContent = "60s";

  interval(() => {

    gameState.time--;

    timerEl.textContent =
      `${gameState.time}s`;

    if (gameState.time <= 0) {
      finishNumber();
    }

  }, 1000);

}


function updateNumberQuestion() {

  if (activeGame !== "number") return;

  const first =
    Math.floor(Math.random() * 15) + 2;

  const second =
    Math.floor(Math.random() * 12) + 2;

  const operations = ["+", "-", "×"];

  const operation = operations[
    Math.floor(Math.random() * operations.length)
  ];

  let answer;

  if (operation === "+") {
    answer = first + second;
  }

  if (operation === "-") {
    answer = first - second;
  }

  if (operation === "×") {
    answer = first * second;
  }

  gameState.answer = answer;

  $("#numberQuestion").textContent =
    `${first} ${operation} ${second} = ?`;

  const choices = new Set([answer]);

  while (choices.size < 4) {

    const offset =
      Math.floor(Math.random() * 15) + 1;

    const wrong = answer + (
      Math.random() > 0.5
        ? offset
        : -offset
    );

    if (wrong >= 0) {
      choices.add(wrong);
    }

  }

  const shuffled = [...choices].sort(
    () => Math.random() - 0.5
  );

  $("#answerGrid").innerHTML = shuffled.map(value => `

    <button
      class="answer-choice"
      data-answer="${value}"
    >
      ${value}
    </button>

  `).join("");

  $$(".answer-choice").forEach(button => {

    button.addEventListener("click", () => {

      if (activeGame !== "number") return;

      if (
        Number(button.dataset.answer) === gameState.answer
      ) {

        gameState.score++;

        playSfx("correct");

        $("#numberScore").textContent =
          `Score: ${gameState.score}`;

        mascotMessage(
          "#robotMessage",
          "Correct! You're amazing! 🤖✨"
        );

      } else {

        playSfx("wrong");

        mascotMessage(
          "#robotMessage",
          "Not quite! Try the next one! 😵"
        );

      }

      updateNumberQuestion();

    });

  });

}


async function finishNumber() {

  clearTimers();

  await saveBest(
    "number",
    gameState.score
  );

  showResult(
    `<strong>${gameState.score} POINTS</strong>`,
    "Time is up! Your score has been saved.",
    startNumber
  );

}


// ========================================
// GAME 4 — LAST SURVIVOR
// ========================================

function startDodge() {

  clearGameArea();

  gameState = {

    time: 0,

    playerX: 280,

    keys: {},

    obstacles: [],

    stars: [],

    finished: false,

    lastSpawn: 0,

    newBest: gameState.newBest || false

  };

  area.innerHTML = `

    <div class="survivor-game">

      <div class="survivor-hud">

        <span>🚀 LAST SURVIVOR</span>

        <span id="dodgeScore">0 SECONDS</span>

      </div>

      <canvas
        id="survivorCanvas"
        width="560"
        height="380">
      </canvas>

      <div class="survivor-controls">

        <button id="moveLeft">◀</button>

        <button id="moveRight">▶</button>

      </div>

      <p class="survivor-tip">
        Dodge the asteroids. Survive as long as possible!
      </p>

    </div>

  `;

  const canvas = $("#survivorCanvas");

  const ctx = canvas.getContext("2d");

  const playerImage = new Image();

  playerImage.src = "assets/spaceship.png";

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  for (let i = 0; i < 65; i++) {

    gameState.stars.push({

      x: Math.random() * WIDTH,

      y: Math.random() * HEIGHT,

      size: Math.random() * 2 + 0.5,

      speed: Math.random() * 1.5 + 0.5

    });

  }


  function keyDown(event) {

    const key = event.key.toLowerCase();

    if (
      ["arrowleft", "arrowright", "a", "d"].includes(key)
    ) {

      event.preventDefault();

      gameState.keys[key] = true;

    }

  }


  function keyUp(event) {

    gameState.keys[
      event.key.toLowerCase()
    ] = false;

  }


  document.addEventListener("keydown", keyDown);

  document.addEventListener("keyup", keyUp);


  gameState.removeListeners = () => {

    document.removeEventListener("keydown", keyDown);

    document.removeEventListener("keyup", keyUp);

  };


  canvas.addEventListener("pointermove", event => {

    if (event.pointerType === "touch") return;

    const rect = canvas.getBoundingClientRect();

    gameState.playerX =
      ((event.clientX - rect.left) / rect.width) * WIDTH;

  });


  function holdButton(button, key) {

    button.addEventListener("pointerdown", event => {

      event.preventDefault();

      gameState.keys[key] = true;

      button.setPointerCapture(event.pointerId);

    });

    button.addEventListener("pointerup", () => {
      gameState.keys[key] = false;
    });

    button.addEventListener("pointercancel", () => {
      gameState.keys[key] = false;
    });

    button.addEventListener("lostpointercapture", () => {
      gameState.keys[key] = false;
    });

  }


  holdButton($("#moveLeft"), "arrowleft");

  holdButton($("#moveRight"), "arrowright");


  function spawnAsteroid() {

    const size = 13 + Math.random() * 17;

    gameState.obstacles.push({

      x: size + Math.random() * (WIDTH - size * 2),

      y: -35,

      size,

      speed: 2 + Math.random() * 1.5,

      rotation: Math.random() * Math.PI,

      spin: (Math.random() - 0.5) * 0.06

    });

  }


  function drawBackground(delta) {

    ctx.fillStyle = "#090b19";

    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    gameState.stars.forEach(star => {

      star.y += star.speed * delta * 0.06;

      if (star.y > HEIGHT) {

        star.y = 0;

        star.x = Math.random() * WIDTH;

      }

      ctx.fillStyle = "rgba(255,255,255,0.75)";

      ctx.beginPath();

      ctx.arc(
        star.x,
        star.y,
        star.size,
        0,
        Math.PI * 2
      );

      ctx.fill();

    });

  }


  function drawPlayer() {

    ctx.save();

    ctx.translate(gameState.playerX, 320);

    ctx.shadowColor = "#9e8cff";

    ctx.shadowBlur = 22;

    if (
      playerImage.complete &&
      playerImage.naturalWidth > 0
    ) {

      ctx.drawImage(
        playerImage,
        -25,
        -29,
        50,
        58
      );

    } else {

      ctx.fillStyle = "#a997ff";

      ctx.beginPath();

      ctx.moveTo(0, -27);
      ctx.lineTo(22, 23);
      ctx.lineTo(0, 13);
      ctx.lineTo(-22, 23);

      ctx.closePath();

      ctx.fill();

    }

    ctx.restore();

  }


  function drawAsteroid(rock) {

    ctx.save();

    ctx.translate(rock.x, rock.y);

    ctx.rotate(rock.rotation);

    ctx.fillStyle = "#77758c";

    ctx.strokeStyle = "#aaa5c2";

    ctx.lineWidth = 2;

    ctx.beginPath();

    for (let i = 0; i < 9; i++) {

      const angle = (Math.PI * 2 / 9) * i;

      const variation = i % 2 === 0 ? 1 : 0.78;

      const radius = rock.size * variation;

      const x = Math.cos(angle) * radius;

      const y = Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

    }

    ctx.closePath();

    ctx.fill();

    ctx.stroke();

    ctx.restore();

  }


  let lastFrame = performance.now();

  function animate(now) {

    if (
      activeGame !== "dodge" ||
      gameState.finished
    ) return;

    const delta = Math.min(
      40,
      now - lastFrame
    );

    lastFrame = now;

    gameState.time += delta;

    const seconds = Math.floor(
      gameState.time / 1000
    );

    const difficulty = Math.min(
      3,
      seconds / 20
    );

    const movementSpeed = delta * 0.30;

    if (
      gameState.keys.a ||
      gameState.keys.arrowleft
    ) {
      gameState.playerX -= movementSpeed;
    }

    if (
      gameState.keys.d ||
      gameState.keys.arrowright
    ) {
      gameState.playerX += movementSpeed;
    }

    gameState.playerX = Math.max(
      27,
      Math.min(WIDTH - 27, gameState.playerX)
    );

    const spawnDelay = Math.max(
      250,
      850 - difficulty * 180
    );

    if (now - gameState.lastSpawn > spawnDelay) {

      spawnAsteroid();

      gameState.lastSpawn = now;

    }

    drawBackground(delta);

    for (
      let i = gameState.obstacles.length - 1;
      i >= 0;
      i--
    ) {

      const rock = gameState.obstacles[i];

      rock.y +=
        (rock.speed + difficulty) * delta * 0.06;

      rock.rotation +=
        rock.spin * delta * 0.06;

      drawAsteroid(rock);

      const dx = rock.x - gameState.playerX;

      const dy = rock.y - 320;

      const distance = Math.sqrt(
        dx * dx + dy * dy
      );

      if (distance < rock.size + 19) {

        finishDodge();

        return;

      }

      if (rock.y > HEIGHT + 40) {

        gameState.obstacles.splice(i, 1);

      }

    }

    drawPlayer();

    $("#dodgeScore").textContent =
      `${seconds} SECONDS`;

    timerEl.textContent =
      `${seconds}s`;

    gameState.frame =
      requestAnimationFrame(animate);

  }

  gameState.frame =
    requestAnimationFrame(animate);

}


async function finishDodge() {

  if (gameState.finished) return;

  gameState.finished = true;

  if (gameState.frame) {
    cancelAnimationFrame(gameState.frame);
  }

  if (gameState.removeListeners) {
    gameState.removeListeners();
  }

  playSfx("hit");

  const seconds = Math.floor(
    gameState.time / 1000
  );

  await saveBest("dodge", seconds);

  showResult(
    `<strong>${seconds} SEC</strong>`,
    "Your spaceship collided with an asteroid! Can you survive longer?",
    startDodge
  );

}


// ========================================
// GAME 5 — NEON RUNNER
// ========================================

// CC0 runner sprite by David Harrington / Blue Yeti Studios.
// Source: OpenGameArt — Runner character.
// No manual download is required.

const RUNNER_SPRITE_URL =
  "https://opengameart.org/sites/default/files/runner-sheet.png";

const runnerSprite = new Image();

runnerSprite.src = RUNNER_SPRITE_URL;


function startRunner() {

  clearGameArea();

  gameState = {

    score: 0,

    coins: 0,

    speed: 4,

    frameCount: 0,

    obstacles: [],

    collectibles: [],

    jumping: false,

    jumpVelocity: 0,

    playerY: 215,

    finished: false,

    lastObstacle: 0,

    lastCoin: 0,

    newBest: gameState.newBest || false

  };

  area.innerHTML = `

    <div class="runner-game">

      <div class="runner-hud">

        <span>🏃 NEON RUNNER</span>

        <span id="runnerScore">
          SCORE: 0
        </span>

        <span id="runnerCoins">
          🪙 0
        </span>

      </div>

      <canvas
        id="runnerCanvas"
        width="560"
        height="300">
      </canvas>

      <button class="runner-jump" id="runnerJump">
        JUMP ↑
      </button>

      <p class="survivor-tip">
        Press SPACE / ↑ or tap JUMP to avoid obstacles.
      </p>

    </div>

  `;

  const canvas = $("#runnerCanvas");

  const ctx = canvas.getContext("2d");

  const WIDTH = canvas.width;

  const HEIGHT = canvas.height;

  const ground = 245;


  function jump() {

    if (gameState.finished) return;

    if (!gameState.jumping) {

      gameState.jumping = true;

      gameState.jumpVelocity = -13;

      playSfx("jump");

    }

  }


  function keyDown(event) {

    if (
      [" ", "arrowup", "w"].includes(
        event.key.toLowerCase()
      )
    ) {

      event.preventDefault();

      jump();

    }

  }


  document.addEventListener("keydown", keyDown);

  gameState.removeListeners = () => {

    document.removeEventListener("keydown", keyDown);

  };


  $("#runnerJump").addEventListener("click", jump);

  canvas.addEventListener("pointerdown", jump);


  function spawnObstacle() {

    const height = 25 + Math.random() * 25;

    gameState.obstacles.push({

      x: WIDTH + 30,

      y: ground - height,

      width: 22 + Math.random() * 12,

      height

    });

  }


  function spawnCoin() {

    gameState.collectibles.push({

      x: WIDTH + 20,

      y: 155 + Math.random() * 45,

      radius: 10

    });

  }


  function drawBackground() {

    const gradient = ctx.createLinearGradient(
      0, 0, 0, HEIGHT
    );

    gradient.addColorStop(0, "#15102c");

    gradient.addColorStop(1, "#090b19");

    ctx.fillStyle = gradient;

    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stars

    for (let i = 0; i < 25; i++) {

      const x = (
        i * 83 -
        gameState.frameCount * 0.5
      ) % WIDTH;

      const y = (i * 47) % 180;

      ctx.fillStyle = "#ffffff66";

      ctx.fillRect(
        (x + WIDTH) % WIDTH,
        y,
        2,
        2
      );

    }

    // Ground

    ctx.fillStyle = "#292046";

    ctx.fillRect(
      0,
      ground,
      WIDTH,
      HEIGHT - ground
    );

    ctx.fillStyle = "#b99aff";

    ctx.fillRect(0, ground, WIDTH, 3);

    // Moving ground marks

    ctx.fillStyle = "#8c72c8";

    for (let i = 0; i < 12; i++) {

      const x = (
        i * 60 -
        gameState.frameCount * gameState.speed
      ) % WIDTH;

      ctx.fillRect(
        (x + WIDTH) % WIDTH,
        270,
        25,
        3
      );

    }

  }


  function drawPlayer() {

    ctx.save();

    ctx.shadowColor = "#b99aff";

    ctx.shadowBlur = 15;

    const x = 55;

    const y = gameState.playerY - 48;

    if (
      runnerSprite.complete &&
      runnerSprite.naturalWidth >= 256 &&
      runnerSprite.naturalHeight >= 96
    ) {

      // Sprite sheet: 32px frames.
      // Row 1 is the running animation.
      // Row 2 is the jumping animation.

      const frame = Math.floor(
        gameState.frameCount / 5
      ) % 8;

      const row = gameState.jumping ? 2 : 1;

      ctx.drawImage(
        runnerSprite,
        frame * 32,
        row * 32,
        32,
        32,
        x,
        y,
        52,
        52
      );

    } else {

      // Fallback character if the remote sprite is unavailable.

      ctx.fillStyle = "#b99aff";

      ctx.fillRect(
        60,
        gameState.playerY - 40,
        35,
        40
      );

      ctx.fillStyle = "#fff";

      ctx.fillRect(
        82,
        gameState.playerY - 32,
        5,
        5
      );

    }

    ctx.restore();

  }


  function drawObstacle(obstacle) {

    ctx.save();

    ctx.shadowColor = "#ff75bc";

    ctx.shadowBlur = 12;

    ctx.fillStyle = "#ff75bc";

    ctx.beginPath();

    ctx.roundRect(
      obstacle.x,
      obstacle.y,
      obstacle.width,
      obstacle.height,
      5
    );

    ctx.fill();

    ctx.restore();

  }


  function drawCoin(coin) {

    ctx.save();

    ctx.shadowColor = "#ffe18a";

    ctx.shadowBlur = 15;

    ctx.fillStyle = "#ffd76d";

    ctx.beginPath();

    ctx.arc(
      coin.x,
      coin.y,
      coin.radius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle = "#fff1b2";

    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.restore();

  }


  let lastFrame = performance.now();


  function animate(now) {

    if (
      activeGame !== "runner" ||
      gameState.finished
    ) return;

    const delta = Math.min(
      40,
      now - lastFrame
    );

    lastFrame = now;

    gameState.frameCount += delta * 0.06;

    gameState.score = Math.floor(
      gameState.frameCount
    );

    gameState.speed = Math.min(
      8,
      4 + gameState.score / 120
    );

    drawBackground();


    // Jump physics

    if (gameState.jumping) {

      gameState.playerY +=
        gameState.jumpVelocity;

      gameState.jumpVelocity += 0.65;

      if (gameState.playerY >= 215) {

        gameState.playerY = 215;

        gameState.jumping = false;

        gameState.jumpVelocity = 0;

      }

    }


    // Spawn obstacles

    if (
      now - gameState.lastObstacle >
      Math.max(650, 1250 - gameState.speed * 60)
    ) {

      spawnObstacle();

      gameState.lastObstacle = now;

    }


    // Spawn coins

    if (now - gameState.lastCoin > 1100) {

      spawnCoin();

      gameState.lastCoin = now;

    }


    // Obstacles

    for (
      let i = gameState.obstacles.length - 1;
      i >= 0;
      i--
    ) {

      const obstacle = gameState.obstacles[i];

      obstacle.x -= gameState.speed;

      drawObstacle(obstacle);

      const playerLeft = 65;

      const playerRight = 95;

      const playerTop =
        gameState.playerY - 43;

      const playerBottom =
        gameState.playerY;

      if (
        playerRight > obstacle.x &&
        playerLeft < obstacle.x + obstacle.width &&
        playerBottom > obstacle.y &&
        playerTop < obstacle.y + obstacle.height
      ) {

        finishRunner();

        return;

      }

      if (obstacle.x < -50) {

        gameState.obstacles.splice(i, 1);

      }

    }


    // Coins

    for (
      let i = gameState.collectibles.length - 1;
      i >= 0;
      i--
    ) {

      const coin = gameState.collectibles[i];

      coin.x -= gameState.speed;

      drawCoin(coin);

      const dx = coin.x - 80;

      const dy =
        coin.y - (gameState.playerY - 20);

      if (
        Math.sqrt(dx * dx + dy * dy) < 28
      ) {

        gameState.coins++;

        playSfx("coin");

        gameState.collectibles.splice(i, 1);

        continue;

      }

      if (coin.x < -30) {

        gameState.collectibles.splice(i, 1);

      }

    }


    drawPlayer();

    $("#runnerScore").textContent =
      `SCORE: ${gameState.score}`;

    $("#runnerCoins").textContent =
      `🪙 ${gameState.coins}`;

    timerEl.textContent =
      `${gameState.score}`;

    gameState.frame =
      requestAnimationFrame(animate);

  }


  gameState.frame =
    requestAnimationFrame(animate);

}


async function finishRunner() {

  if (gameState.finished) return;

  gameState.finished = true;

  if (gameState.frame) {
    cancelAnimationFrame(gameState.frame);
  }

  if (gameState.removeListeners) {
    gameState.removeListeners();
  }

  playSfx("hit");

  const score =
    gameState.score + gameState.coins * 10;

  await saveBest("runner", score);

  showResult(
    `<strong>${score} POINTS</strong>`,
    `You collected ${gameState.coins} coins. Try to beat your distance!`,
    startRunner
  );

}


// ========================================
// GAME 6 — BUBBLE POP
// ========================================

function startBubble() {

  clearGameArea();

  gameState = {

    score: 0,

    time: 30,

    bubbles: [],

    finished: false,

    newBest: gameState.newBest || false

  };

  area.innerHTML = `

    <div class="bubble-game">

      <div class="runner-hud">

        <span>🫧 BUBBLE POP</span>

        <span id="bubbleScore">
          SCORE: 0
        </span>

      </div>

      <div
        class="bubble-board"
        id="bubbleBoard">
      </div>

      <p class="survivor-tip">
        Click or tap the bubbles before they disappear!
      </p>

    </div>

  `;

  const board = $("#bubbleBoard");

  const bubbleColors = [

    "#b99aff",
    "#ff9bcf",
    "#70d2ff",
    "#a8f0d0",
    "#ffe18a"

  ];


  function createBubble() {

    if (
      activeGame !== "bubble" ||
      gameState.finished
    ) return;

    const bubble = document.createElement("button");

    bubble.className = "bubble";

    const size = 28 + Math.random() * 37;

    const maxX = Math.max(
      0,
      board.clientWidth - size
    );

    const maxY = Math.max(
      0,
      board.clientHeight - size
    );

    const color = bubbleColors[
      Math.floor(Math.random() * bubbleColors.length)
    ];

    bubble.style.width = `${size}px`;

    bubble.style.height = `${size}px`;

    bubble.style.left =
      `${Math.random() * maxX}px`;

    bubble.style.top =
      `${Math.random() * maxY}px`;

    bubble.style.background =
      `radial-gradient(circle at 30% 25%, #ffffff, ${color} 45%, #ffffff22)`;

    bubble.setAttribute(
      "aria-label",
      "Pop bubble"
    );

    const bubbleData = {

      element: bubble,

      x: parseFloat(bubble.style.left),

      y: parseFloat(bubble.style.top),

      vx: (Math.random() - 0.5) * 1.5,

      vy: (Math.random() - 0.5) * 1.5,

      size

    };

    gameState.bubbles.push(bubbleData);


    bubble.addEventListener("click", () => {

      if (gameState.finished) return;

      gameState.score += 10;

      playSfx("pop");

      $("#bubbleScore").textContent =
        `SCORE: ${gameState.score}`;

      bubble.remove();

      gameState.bubbles =
        gameState.bubbles.filter(
          item => item !== bubbleData
        );

      createBubble();

    });


    board.appendChild(bubble);

  }


  // Initial bubbles

  for (let i = 0; i < 9; i++) {
    createBubble();
  }


  // Bubble movement

  gameState.frame = requestAnimationFrame(function animate() {

    if (
      activeGame !== "bubble" ||
      gameState.finished
    ) return;

    const width = board.clientWidth;

    const height = board.clientHeight;

    gameState.bubbles.forEach(bubble => {

      bubble.x += bubble.vx;

      bubble.y += bubble.vy;

      const maxX = width - bubble.size;

      const maxY = height - bubble.size;

      if (
        bubble.x <= 0 ||
        bubble.x >= maxX
      ) {
        bubble.vx *= -1;
      }

      if (
        bubble.y <= 0 ||
        bubble.y >= maxY
      ) {
        bubble.vy *= -1;
      }

      bubble.x = Math.max(
        0,
        Math.min(maxX, bubble.x)
      );

      bubble.y = Math.max(
        0,
        Math.min(maxY, bubble.y)
      );

      bubble.element.style.left =
        `${bubble.x}px`;

      bubble.element.style.top =
        `${bubble.y}px`;

    });

    gameState.frame =
      requestAnimationFrame(animate);

  });


  timerEl.textContent = "30s";

  interval(() => {

    gameState.time--;

    timerEl.textContent =
      `${gameState.time}s`;

    if (gameState.time <= 0) {
      finishBubble();
    }

  }, 1000);

}


async function finishBubble() {

  if (gameState.finished) return;

  gameState.finished = true;

  if (gameState.frame) {
    cancelAnimationFrame(gameState.frame);
  }

  playSfx("gameover");

  const score = gameState.score;

  await saveBest("bubble", score);

  showResult(
    `<strong>${score} POINTS</strong>`,
    "Bubble time is over! How many can you pop next time?",
    startBubble
  );

}


// ========================================
// INITIALIZE QUICKPLAY
// ========================================

updateBests();

createLeaderboardUI();

loadLeaderboard("reaction");

initializePlayer();

console.log(
  "QUICKPLAY initialized successfully! 🚀"
);
