(() => {
  const GRID = 5;
  const POINTS = { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, K: 100 };
  const RANK = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, K: 999 };

  const state = {
    cells: Array.from({ length: 25 }, () => ({ kind: "closed" })),
    hand: [1, 1, 1, 2, 2, 5],
    completed: [],
    score: 0,
    over: false,
    selectedPos: null,
    selectedValue: 1,
    collect5: false,
    neighborPos: null,
    last: null
  };

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const activeEl = document.getElementById("active");
  const solvedEl = document.getElementById("solved");
  const statusEl = document.getElementById("status");
  const valueEl = document.getElementById("openedValue");
  const collectEl = document.getElementById("collect5");
  const neighborWrap = document.getElementById("neighborWrap");
  const neighborBtns = document.getElementById("neighbors");
  const saveBtn = document.getElementById("saveBtn");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const lastEl = document.getElementById("lastMove");

  const snapshots = [];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function indexToRC(i) {
    return [Math.floor(i / GRID), i % GRID];
  }

  function adjacents(pos) {
    const [r, c] = indexToRC(pos);
    const out = [];
    if (r > 0) out.push((r - 1) * GRID + c);
    if (r < GRID - 1) out.push((r + 1) * GRID + c);
    if (c > 0) out.push(r * GRID + (c - 1));
    if (c < GRID - 1) out.push(r * GRID + (c + 1));
    return out;
  }

  function lowestCard() {
    if (!state.hand.length) return null;
    return state.hand.reduce((best, cur) => (RANK[cur] < RANK[best] ? cur : best));
  }

  function consumeCard(card) {
    const i = state.hand.indexOf(card);
    if (i >= 0) state.hand.splice(i, 1);
  }

  function resolvedMask() {
    return state.cells.map((c) => c.kind === "opened" || c.kind === "removed");
  }

  function completeLines(mask) {
    const done = [];
    for (let r = 0; r < GRID; r++) {
      let ok = true;
      for (let c = 0; c < GRID; c++) if (!mask[r * GRID + c]) ok = false;
      if (ok) done.push(`r${r}`);
    }
    for (let c = 0; c < GRID; c++) {
      let ok = true;
      for (let r = 0; r < GRID; r++) if (!mask[r * GRID + c]) ok = false;
      if (ok) done.push(`c${c}`);
    }
    return done;
  }

  function canSave() {
    if (state.over) return false;
    if (state.selectedPos === null) return false;
    if (String(state.selectedValue) === "5" && state.collect5) {
      const closedNeighbors = adjacents(state.selectedPos).filter((p) => state.cells[p].kind === "closed");
      if (closedNeighbors.length > 0 && state.neighborPos === null) return false;
    }
    return true;
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    state.cells.forEach((cell, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const selected = state.selectedPos === i;
      btn.className = `cell ${cell.kind} ${selected ? "selected" : ""}`;
      const label = cell.kind === "closed" ? String(i + 1) : cell.kind === "opened" ? String(cell.value) : "✓";
      btn.textContent = label;
      btn.disabled = cell.kind !== "closed" || state.over;
      btn.addEventListener("click", () => {
        state.selectedPos = i;
        state.neighborPos = null;
        render();
      });
      boardEl.appendChild(btn);
    });
  }

  function renderNeighbors() {
    neighborBtns.innerHTML = "";
    if (state.selectedPos === null || !state.collect5 || String(state.selectedValue) !== "5") {
      neighborWrap.style.display = "none";
      return;
    }
    neighborWrap.style.display = "block";
    const list = adjacents(state.selectedPos).filter((p) => state.cells[p].kind === "closed");
    if (!list.length) {
      neighborBtns.innerHTML = "<span class='muted'>Komsu kapali kart yok.</span>";
      return;
    }
    list.forEach((pos) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `nbtn ${state.neighborPos === pos ? "on" : ""}`;
      b.textContent = `${pos + 1}`;
      b.addEventListener("click", () => {
        state.neighborPos = pos;
        render();
      });
      neighborBtns.appendChild(b);
    });
  }

  function renderLast() {
    if (!state.last) {
      lastEl.textContent = "Henuz hamle yok.";
      return;
    }
    lastEl.textContent = `Puan: +${state.last.scoreDelta} (Kart: ${state.last.pointsFromComparison}, Bingo: ${state.last.bingoBonus})`;
  }

  function render() {
    const active = lowestCard();
    const solved = state.cells.filter((c) => c.kind !== "closed").length;
    scoreEl.textContent = String(state.score);
    activeEl.textContent = active === null ? "-" : String(active);
    solvedEl.textContent = `${solved}/25`;
    valueEl.value = String(state.selectedValue);
    collectEl.checked = state.collect5;
    saveBtn.disabled = !canSave();
    statusEl.textContent = state.over ? "Oyun bitti (K yakalandi veya el karti bitti)." : "Hamleyi secip Kaydet'e bas.";
    renderBoard();
    renderNeighbors();
    renderLast();
  }

  function applyMove() {
    if (!canSave()) return;
    const active = lowestCard();
    if (active === null) return;

    snapshots.push(clone(state));
    if (snapshots.length > 50) snapshots.shift();

    const pos = state.selectedPos;
    const openedValue = state.selectedValue === "K" ? "K" : Number(state.selectedValue);
    state.cells[pos] = { kind: "opened", value: openedValue };

    let pointsFromComparison = 0;
    let turnEnded = false;
    let isGameOver = false;

    if (openedValue === "K") {
      pointsFromComparison = 100;
      turnEnded = true;
      isGameOver = true;
    } else if (openedValue === 5 && state.collect5) {
      pointsFromComparison = 0;
      turnEnded = true;
      if (typeof state.neighborPos === "number" && adjacents(pos).includes(state.neighborPos) && state.cells[state.neighborPos].kind === "closed") {
        state.cells[state.neighborPos] = { kind: "removed", reason: "collected5" };
      }
    } else {
      const a = RANK[active];
      const b = RANK[openedValue];
      if (a > b) {
        pointsFromComparison = POINTS[openedValue];
        turnEnded = false;
      } else if (a === b) {
        pointsFromComparison = POINTS[openedValue];
        turnEnded = true;
      } else {
        pointsFromComparison = 0;
        turnEnded = true;
      }
    }

    if (turnEnded) {
      consumeCard(active);
      if (!state.hand.length) isGameOver = true;
    }

    const now = completeLines(resolvedMask());
    const prev = new Set(state.completed);
    const newly = now.filter((x) => !prev.has(x));
    state.completed.push(...newly);
    const bingoBonus = newly.length * 10;
    const scoreDelta = pointsFromComparison + bingoBonus;
    state.score += scoreDelta;
    state.over = isGameOver;
    state.last = { scoreDelta, pointsFromComparison, bingoBonus };

    state.selectedPos = null;
    state.collect5 = false;
    state.neighborPos = null;
    if (state.over) statusEl.textContent = "Oyun bitti.";
    render();
  }

  valueEl.addEventListener("change", (e) => {
    state.selectedValue = e.target.value === "K" ? "K" : Number(e.target.value);
    if (String(state.selectedValue) !== "5") {
      state.collect5 = false;
      state.neighborPos = null;
    }
    render();
  });

  collectEl.addEventListener("change", (e) => {
    state.collect5 = e.target.checked;
    state.neighborPos = null;
    render();
  });

  saveBtn.addEventListener("click", applyMove);
  undoBtn.addEventListener("click", () => {
    if (!snapshots.length) return;
    const prev = snapshots.pop();
    Object.assign(state, prev);
    render();
  });
  resetBtn.addEventListener("click", () => {
    Object.assign(state, {
      cells: Array.from({ length: 25 }, () => ({ kind: "closed" })),
      hand: [1, 1, 1, 2, 2, 5],
      completed: [],
      score: 0,
      over: false,
      selectedPos: null,
      selectedValue: 1,
      collect5: false,
      neighborPos: null,
      last: null
    });
    snapshots.length = 0;
    render();
  });

  render();
})();
