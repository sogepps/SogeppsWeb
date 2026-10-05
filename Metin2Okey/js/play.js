(() => {
  const COLORS = [
    { key: "red", label: "Kırmızı" },
    { key: "yellow", label: "Sarı" },
    { key: "blue", label: "Mavi" },
  ];
  const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];
  const TRIPLE_POINTS = { 1: 20, 2: 30, 3: 40, 4: 50, 5: 60, 6: 70, 7: 80, 8: 90 };
  const RUNS = [
    { nums: [1, 2, 3], same: 50, mixed: 10 },
    { nums: [2, 3, 4], same: 60, mixed: 20 },
    { nums: [3, 4, 5], same: 70, mixed: 30 },
    { nums: [4, 5, 6], same: 80, mixed: 40 },
    { nums: [5, 6, 7], same: 90, mixed: 50 },
    { nums: [6, 7, 8], same: 100, mixed: 60 },
  ];
  const CHESTS = [
    { min: 0, max: 299, name: "Bronz Okey Sandığı", short: "Bronz Sandık", tone: "bronze" },
    { min: 300, max: 399, name: "Gümüş Okey Sandığı", short: "Gümüş Sandık", tone: "silver" },
    { min: 400, max: 999, name: "Altın Okey Sandığı", short: "Altın Sandık", tone: "gold" },
  ];
  const MAX_FIELD = 5;
  const KIND_LABEL = { same: "SERİ", triple: "ÜÇLÜ", mixed: "KARIŞIK" };

  const helperEls = {
    red: document.getElementById("helper-red"),
    yellow: document.getElementById("helper-yellow"),
    blue: document.getElementById("helper-blue"),
    combos: document.getElementById("helperCombos"),
    reset: document.getElementById("helperResetBtn"),
  };

  const playEls = {
    score: document.getElementById("playScore"),
    chest: document.getElementById("playChest"),
    remaining: document.getElementById("playRemaining"),
    top: document.getElementById("playTop"),
    slots: document.getElementById("playSlots"),
    drawBtn: document.getElementById("drawBtn"),
    burstLayer: document.getElementById("burstLayer"),
    burstPts: document.getElementById("burstPts"),
    running: document.getElementById("playRunning"),
    ended: document.getElementById("playEnded"),
    finalScore: document.getElementById("playFinalScore"),
    finalChest: document.getElementById("playFinalChest"),
    endBtn: document.getElementById("endBtn"),
    resetBtn: document.getElementById("resetPlayBtn"),
    newBtn: document.getElementById("newPlayBtn"),
    combos: document.getElementById("playCombos"),
  };

  const helperState = { used: new Set() };

  const playState = {
    deck: [],
    top: [],
    slots: [null, null, null],
    score: 0,
    endReason: "none",
  };

  function cardId(color, n) {
    return `${color}-${n}`;
  }

  function allCards() {
    const list = [];
    for (const c of COLORS) {
      for (const n of NUMBERS) {
        list.push({ id: cardId(c.key, n), color: c.key, n });
      }
    }
    return list;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function chestForScore(score) {
    if (score >= 400) return CHESTS[2];
    if (score >= 300) return CHESTS[1];
    return CHESTS[0];
  }

  function scoreCombo(cards) {
    if (cards.length !== 3) return { valid: false, kind: "triple", points: 0, title: "" };

    const nums = cards.map((c) => c.n);
    const colors = cards.map((c) => c.color);
    const n0 = nums[0];

    if (nums.every((n) => n === n0)) {
      if (new Set(colors).size === 3) {
        return {
          valid: true,
          kind: "triple",
          points: TRIPLE_POINTS[n0],
          title: `Üçlü ${n0}`,
        };
      }
      return { valid: false, kind: "triple", points: 0, title: "" };
    }

    const sorted = [...nums].sort((a, b) => a - b);
    const run = RUNS.find(
      (r) => r.nums[0] === sorted[0] && r.nums[1] === sorted[1] && r.nums[2] === sorted[2]
    );
    if (!run) return { valid: false, kind: "mixed", points: 0, title: "" };

    if (colors.every((c) => c === colors[0])) {
      const lbl = COLORS.find((c) => c.key === colors[0]).label;
      return {
        valid: true,
        kind: "same",
        points: run.same,
        title: `${lbl} ${run.nums.join("-")}`,
      };
    }

    return {
      valid: true,
      kind: "mixed",
      points: run.mixed,
      title: `Karışık ${run.nums.join("-")}`,
    };
  }

  function remainingCombos(used) {
    const isLeft = (color, n) => !used.has(cardId(color, n));
    const list = [];

    for (const n of NUMBERS) {
      if (COLORS.every((c) => isLeft(c.key, n))) {
        list.push({
          id: `triple-${n}`,
          kind: "triple",
          title: `Üçlü ${n}`,
          detail: "Kırmızı + sarı + mavi",
          points: TRIPLE_POINTS[n],
        });
      }
    }

    for (const c of COLORS) {
      for (const run of RUNS) {
        if (run.nums.every((n) => isLeft(c.key, n))) {
          list.push({
            id: `same-${c.key}-${run.nums.join("")}`,
            kind: "same",
            title: `${c.label} ${run.nums.join("-")}`,
            detail: "Aynı renk seri — en değerli hamle",
            points: run.same,
          });
        }
      }
    }

    for (const run of RUNS) {
      const hasEach = run.nums.every((n) => COLORS.some((c) => isLeft(c.key, n)));
      const hasSameColor = COLORS.some((c) => run.nums.every((n) => isLeft(c.key, n)));
      if (hasEach && !hasSameColor) {
        list.push({
          id: `mixed-${run.nums.join("")}`,
          kind: "mixed",
          title: `Karışık ${run.nums.join("-")}`,
          detail: "Farklı renk seri",
          points: run.mixed,
        });
      }
    }

    return list.sort((a, b) => b.points - a.points || a.title.localeCompare(b.title, "tr"));
  }

  function renderComboList(targetEl, combos, playStyle = false) {
    targetEl.innerHTML = "";
    const top = combos.slice(0, playStyle ? 10 : 8);
    if (!top.length) {
      targetEl.innerHTML = playStyle
        ? '<li class="empty-note">Kalan kartlarla yüksek kombinasyon kalmadı. Düşük serilerle desteyi bitirebilirsin.</li>'
        : '<li class="empty-note">Yüksek kombinasyon kalmadı.</li>';
      return;
    }

    for (const combo of top) {
      const li = document.createElement("li");
      li.className = playStyle ? "combo-item play-combo" : "combo-item";
      if (playStyle) {
        li.innerHTML = `
          <span class="combo-badge ${combo.kind === "triple" ? "triple" : ""}">${KIND_LABEL[combo.kind]}</span>
          <div class="meta">
            <div class="title">${combo.title}</div>
            <div class="detail">${combo.detail}</div>
          </div>
          <div class="pts">${combo.points}</div>
        `;
      } else {
        li.innerHTML = `
          <div class="head">
            <div>
              <div class="title">${combo.title}</div>
              <div class="detail">${combo.detail}</div>
            </div>
            <div class="pts">+${combo.points}</div>
          </div>
        `;
      }
      targetEl.appendChild(li);
    }
  }

  // ---------- Helper (unchanged) ----------
  function makeHelperTile(color, n) {
    const id = cardId(color, n);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tile ${color}`;
    btn.innerHTML = `<span class="n">${n}</span><span class="c">${COLORS.find((c) => c.key === color).label}</span>`;
    btn.addEventListener("click", () => {
      if (helperState.used.has(id)) helperState.used.delete(id);
      else helperState.used.add(id);
      renderHelper();
    });
    if (helperState.used.has(id)) btn.classList.add("flipped");
    return btn;
  }

  function renderHelper() {
    for (const c of COLORS) {
      const box = helperEls[c.key];
      box.innerHTML = "";
      for (const n of NUMBERS) box.appendChild(makeHelperTile(c.key, n));
    }
    renderComboList(helperEls.combos, remainingCombos(helperState.used));
  }

  function resetHelper() {
    helperState.used = new Set();
    renderHelper();
  }

  helperEls.reset.addEventListener("click", resetHelper);

  // ---------- Oyna (mobile OkeyPlay) ----------
  function refillTop(deck, top, slotsInUse = 0) {
    const nextDeck = [...deck];
    const nextTop = [...top];
    const targetTop = MAX_FIELD - slotsInUse;
    while (nextTop.length < targetTop && nextDeck.length > 0) {
      nextTop.push(nextDeck.shift());
    }
    return { nextDeck, nextTop };
  }

  function inSlotsCount() {
    return playState.slots.filter(Boolean).length;
  }

  function remainingCount() {
    return playState.deck.length + playState.top.length + inSlotsCount();
  }

  function fieldCount() {
    return playState.top.length + inSlotsCount();
  }

  function playCombosFromState() {
    const available = new Set([
      ...playState.deck.map((c) => c.id),
      ...playState.top.map((c) => c.id),
      ...playState.slots.filter(Boolean).map((c) => c.id),
    ]);
    const used = new Set(allCards().map((c) => c.id));
    for (const card of allCards()) {
      if (available.has(card.id)) used.delete(card.id);
    }
    return remainingCombos(used).filter((c) => c.kind !== "mixed").slice(0, 10);
  }

  function playBurst(points) {
    playEls.burstPts.textContent = `+${points}`;
    playEls.burstLayer.hidden = false;
    playEls.burstLayer.style.animation = "none";
    void playEls.burstLayer.offsetWidth;
    playEls.burstLayer.style.animation = "";
    clearTimeout(playBurst._t);
    playBurst._t = setTimeout(() => {
      playEls.burstLayer.hidden = true;
    }, 900);
  }

  function resolveCombo(points, nextTop) {
    playBurst(points);
    playState.score += points;
    playState.slots = [null, null, null];
    const { nextDeck, nextTop: filledTop } = refillTop(playState.deck, nextTop);
    playState.deck = nextDeck;
    playState.top = filledTop;
    checkAutoEnd();
    renderPlay();
  }

  function checkAutoEnd() {
    if (playState.endReason !== "none") return;
    const rem = remainingCount();
    if (rem > 0 && rem !== 3) return;

    if (rem === 0) {
      playState.endReason = "auto";
      return;
    }

    const lastThree = [
      ...playState.deck,
      ...playState.top,
      ...playState.slots.filter(Boolean),
    ];
    if (lastThree.length !== 3) return;
    const res = scoreCombo(lastThree);
    if (!res.valid) playState.endReason = "auto";
  }

  function onTopPress(card) {
    if (playState.endReason !== "none") return;
    const emptyIndex = playState.slots.findIndex((s) => s === null);
    if (emptyIndex === -1) return;

    const nextSlots = [...playState.slots];
    nextSlots[emptyIndex] = card;
    const nextTop = playState.top.filter((c) => c.id !== card.id);
    playState.top = nextTop;
    playState.slots = nextSlots;

    if (nextSlots.every((s) => s !== null)) {
      const res = scoreCombo(nextSlots);
      if (res.valid) {
        resolveCombo(res.points, nextTop);
        return;
      }
    }

    checkAutoEnd();
    renderPlay();
  }

  function returnSlotToTop(index) {
    if (playState.endReason !== "none") return;
    const card = playState.slots[index];
    if (!card) return;
    const nextSlots = [...playState.slots];
    nextSlots[index] = null;
    playState.slots = nextSlots;
    playState.top = [...playState.top, card];
    renderPlay();
  }

  function deleteTopCard(card) {
    if (playState.endReason !== "none") return;
    playState.top = playState.top.filter((c) => c.id !== card.id);
    checkAutoEnd();
    renderPlay();
  }

  function redrawTop() {
    if (playState.endReason !== "none") return;
    const slotsInUse = inSlotsCount();
    if (fieldCount() >= MAX_FIELD || playState.deck.length === 0) return;
    const { nextDeck, nextTop } = refillTop(playState.deck, playState.top, slotsInUse);
    playState.deck = nextDeck;
    playState.top = nextTop;
    renderPlay();
  }

  function makePlayCard(card, mode, onClick, onContextMenu) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `play-card ${mode === "top" ? "top-card" : "slot-card"} ${card.color}`;
    btn.innerHTML =
      mode === "slot"
        ? `<span class="num">${card.n}</span><span class="shade">${COLORS.find((c) => c.key === card.color).label}</span>`
        : `<span class="num">${card.n}</span>`;
    btn.addEventListener("click", onClick);
    if (onContextMenu) {
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        onContextMenu();
      });
    }
    return btn;
  }

  function renderPlay() {
    const chest = chestForScore(playState.score);
    const ended = playState.endReason !== "none";
    const canRedraw = !ended && fieldCount() < MAX_FIELD && playState.deck.length > 0;

    playEls.score.textContent = String(playState.score);
    playEls.remaining.textContent = String(remainingCount());
    playEls.chest.textContent = chest.short;
    playEls.chest.className = `val chest chest-${chest.tone}`;

    playEls.top.innerHTML = "";
    for (const card of playState.top) {
      playEls.top.appendChild(
        makePlayCard(card, "top", () => onTopPress(card), () => deleteTopCard(card))
      );
    }

    playEls.slots.innerHTML = "";
    playState.slots.forEach((slot, i) => {
      const box = document.createElement("div");
      box.className = "slot-box";
      if (!slot) {
        box.innerHTML = '<span class="slot-empty">—</span>';
      } else {
        box.appendChild(makePlayCard(slot, "slot", () => returnSlotToTop(i)));
      }
      playEls.slots.appendChild(box);
    });

    playEls.drawBtn.disabled = !canRedraw;
    playEls.running.hidden = ended;
    playEls.ended.hidden = !ended;

    if (ended) {
      playEls.finalScore.textContent = String(playState.score);
      playEls.finalChest.textContent = chest.name;
    }

    renderComboList(playEls.combos, playCombosFromState(), true);
  }

  function startPlay() {
    const full = shuffle(allCards());
    playState.top = full.slice(0, 5);
    playState.deck = full.slice(5);
    playState.slots = [null, null, null];
    playState.score = 0;
    playState.endReason = "none";
    renderPlay();
  }

  playEls.drawBtn.addEventListener("click", redrawTop);
  playEls.endBtn.addEventListener("click", () => {
    if (playState.endReason !== "none") return;
    playState.endReason = "manual";
    renderPlay();
  });
  playEls.resetBtn.addEventListener("click", startPlay);
  playEls.newBtn.addEventListener("click", startPlay);

  resetHelper();
  startPlay();
})();
