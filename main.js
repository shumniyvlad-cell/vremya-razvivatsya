/* «Время развиваться». Страница — вечер с 16:00 до 19:00: листаешь, и время идёт. */
(() => {
  "use strict";

  const CONFIG = {
    api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8916" : "https://vremya.83-141-94-106.sslip.io",
    telegram: "https://t.me/marchvlvv",
    // дата первой встречи; если пусто или прошла — ближайшая пятница
    firstMeeting: "",
    freeSeats: 10,
  };
  const STAGES = ["Запускаю дело", "Есть бизнес, до 1 млн в месяц", "Бизнес от 1 до 5 млн в месяц", "Бизнес больше 5 млн в месяц", "Эксперт или специалист"];
  const GOALS = ["Знакомства и партнёры", "Клиенты", "ИИ и новые инструменты", "Разбор моей задачи", "Рост и среда"];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* приватный режим */ } },
  };
  const root = document.documentElement;

  /* ---------- движение: уважаем «Уменьшить движение», ?motion=1 включает принудительно ---------- */
  const qs = new URLSearchParams(location.search);
  if (qs.get("motion") === "1") store.set("motion", "1");
  if (qs.get("motion") === "0") store.del("motion");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = !reduce || store.get("motion") === "1";
  if (motion) root.classList.add("motion");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // сборка первого экрана: только с движением и если страница открыта сверху
  const intro = motion && root.classList.contains("assembling") && scrollY < 80;
  if (!intro) root.classList.remove("assembling");
  else $$(".hero .reveal").forEach((el) => el.classList.remove("reveal"));

  /* ---------- небо, солнце, часы ---------- */
  const layers = { sunset: $(".sky-sunset"), dusk: $(".sky-dusk"), night: $(".sky-night") };
  const sun = $(".sun"), sunDeep = $(".sun-deep"), stars = $("#stars");
  const vtime = $("#vtime"), miniH = $(".mini-h"), miniM = $(".mini-m");
  const handH = $("#hand-h"), handM = $("#hand-m"), dialTime = $("#dial-time");
  const slots = $$(".slot");
  const metaTheme = $('meta[name="theme-color"]');

  // звёзды и риски циферблата рисуем один раз
  (function makeStars() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("i");
      s.style.left = (rnd() * 100).toFixed(2) + "%";
      s.style.top = (rnd() * 72).toFixed(2) + "%";
      s.style.opacity = (0.35 + rnd() * 0.65).toFixed(2);
      if (rnd() > 0.85) { s.style.width = s.style.height = "3px"; }
      frag.append(s);
    }
    stars.append(frag);
  })();
  (function makeTicks() {
    const g = $("#ticks");
    const ns = "http://www.w3.org/2000/svg";
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180;
      const major = i % 5 === 0;
      const r1 = major ? 80 : 86, r2 = 92;
      const l = document.createElementNS(ns, "line");
      l.setAttribute("x1", (100 + r1 * Math.sin(a)).toFixed(2));
      l.setAttribute("y1", (100 - r1 * Math.cos(a)).toFixed(2));
      l.setAttribute("x2", (100 + r2 * Math.sin(a)).toFixed(2));
      l.setAttribute("y2", (100 - r2 * Math.cos(a)).toFixed(2));
      if (major) l.setAttribute("class", "major");
      g.append(l);
    }
  })();

  // точки, где слот проходит середину экрана: между ними время идёт линейно
  let marks = [];
  let heroH = 1;
  function measure() {
    const y = scrollY, mid = innerHeight * 0.55;
    marks = slots.map((s) => ({ at: s.getBoundingClientRect().top + y - mid, t: Number(s.dataset.t) }));
    heroH = Math.max(1, $(".hero").offsetHeight);
  }
  function minutesAt(y) {
    if (!marks.length || y <= marks[0].at) return 0;
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1], b = marks[i];
      if (y < b.at) return a.t + ((y - a.at) / (b.at - a.at)) * (b.t - a.t);
    }
    return 180;
  }
  const fmtTime = (m) => {
    const h = 16 + Math.floor(m / 60), mm = Math.floor(m % 60);
    return h + ":" + String(mm).padStart(2, "0");
  };

  let lastLabel = "", lastDark = null, ticking = false;
  function paint() {
    ticking = false;
    const y = scrollY;
    const m = minutesAt(y);
    const p = m / 180;

    layers.sunset.style.opacity = clamp(p * 3);
    layers.dusk.style.opacity = clamp(p * 3 - 1);
    layers.night.style.opacity = clamp(p * 3 - 2);
    stars.style.opacity = clamp(p * 3 - 2.2);
    sunDeep.style.opacity = clamp(p * 2.2);
    if (motion) {
      const pre = clamp(y / heroH) * 14;          // пока читаешь первый экран, солнце чуть опускается
      const set = p * 112;                        // за вечер садится за край
      sun.style.transform = `translate3d(${-p * 18}vw, ${pre + set}vh, 0)`;
    } else {
      sun.style.opacity = String(1 - clamp(p * 1.6));
    }

    const label = fmtTime(m);
    if (label !== lastLabel) {
      lastLabel = label;
      vtime.textContent = label;
      dialTime.textContent = label;
      const hourDeg = 120 + m * 0.5, minDeg = m * 6;
      handH.style.transform = `rotate(${hourDeg}deg)`;
      handM.style.transform = `rotate(${minDeg}deg)`;
      miniH.style.transform = `rotate(${hourDeg}deg)`;
      miniM.style.transform = `rotate(${minDeg}deg)`;
      let now = 0;
      slots.forEach((s, i) => { if (m >= Number(s.dataset.t) - 0.01) now = i; });
      slots.forEach((s, i) => s.classList.toggle("is-now", i === now));
    }

    const dark = p > 0.42;
    if (dark !== lastDark) {
      lastDark = dark;
      root.toggleAttribute("data-dark", dark);
      metaTheme.setAttribute("content", dark ? "#14152B" : "#D8E1E7");
    }
    if (motion) paintKinetic(y);
  }
  /* ---------- кинетическая фраза: слово за словом по прокрутке ---------- */
  const kin = $("#kinetic"), kinSticky = $(".kin-sticky"), words = $$(".kinetic .w"), stamp = $(".stamp");
  const kinCurs = [];
  if (motion) {
    [["юрист", "#2F6FDE", "#fff"], ["кофейня", "#E4673F", "#121417"]].forEach(([n, c, t]) => {
      const el = cursorEl(n, c, t);
      el.style.opacity = "0";
      kinSticky.append(el);
      kinCurs.push(el);
    });
  }
  let kinShown = -1;
  function paintKinetic(y) {
    const span = Math.max(1, kin.offsetHeight - innerHeight);
    const kp = clamp((y - kin.offsetTop + innerHeight * 0.35) / span);
    const shown = Math.min(words.length, Math.floor(kp * 1.3 * words.length));
    if (shown === kinShown) return;
    kinShown = shown;
    words.forEach((w, i) => w.classList.toggle("on", i < shown));
    stamp.classList.toggle("on", shown >= words.length);
    // юрист указывает на последнее влетевшее слово, кофейня ставит печать
    const box = kinSticky.getBoundingClientRect();
    const last = words[shown - 1];
    if (last) {
      const r = last.getBoundingClientRect();
      kinCurs[0].style.opacity = "1";
      kinCurs[0].style.transform = `translate(${r.right - box.left - 14}px, ${r.bottom - box.top - 10}px)`;
    } else kinCurs[0].style.opacity = "0";
    if (shown >= words.length) {
      const r = stamp.getBoundingClientRect();
      kinCurs[1].style.opacity = "1";
      kinCurs[1].style.transform = `translate(${r.left - box.left + r.width * 0.6}px, ${r.top - box.top + r.height * 0.55}px)`;
    } else {
      kinCurs[1].style.opacity = "0";
      kinCurs[1].style.transform = `translate(${box.width * 0.9}px, ${box.height}px)`;
    }
  }
  function cursorEl(name, color, text) {
    const el = document.createElement("div");
    el.className = "cur";
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("--c", color);
    if (text) el.style.setProperty("--t", text);
    el.innerHTML = '<svg viewBox="0 0 20 22"><path d="M2 2 L2 18 L6.4 14 L9.6 20.6 L12.6 19.3 L9.5 12.9 L15.4 12.9 Z"/></svg><span></span>';
    el.lastChild.textContent = name;
    return el;
  }

  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { measure(); onScroll(); });
  addEventListener("load", () => { measure(); paint(); });
  if (document.fonts) document.fonts.ready.then(() => { measure(); paint(); });
  measure();
  paint();

  /* ---------- появление ---------- */
  const reveals = $$(".reveal");
  if (motion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add("is-in"));

  /* ---------- наклон до 7° и блик за курсором, только мышь ---------- */
  if (motion && finePointer) {
    $$(".tilt").forEach((el) => {
      let raf = 0;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transition = "transform .08s linear";
          el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 10).toFixed(2)}deg) rotateY(${((x - 0.5) * 14).toFixed(2)}deg)`;
          el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
          el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
        });
      });
      el.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf);
        el.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
      });
    });
  }

  /* ---------- ближайшая пятница по Москве (Вологда в том же поясе) ---------- */
  const MSK = 3 * 3600e3;
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const weekdays = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  function nextMeeting(now = Date.now()) {
    if (CONFIG.firstMeeting) {
      const [y, mo, d] = CONFIG.firstMeeting.split("-").map(Number);
      const start = Date.UTC(y, mo - 1, d, 16) - MSK;
      if (now < start + 3 * 3600e3) return start;
    }
    const msk = new Date(now + MSK);
    const day = msk.getUTCDay();
    let add = (5 - day + 7) % 7;
    if (add === 0 && msk.getUTCHours() >= 19) add = 7;
    return Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() + add, 16) - MSK;
  }
  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
  const pad = (n) => String(n).padStart(2, "0");
  const cd = $("#countdown");
  function tickCountdown() {
    const now = Date.now();
    const start = nextMeeting(now);
    const d = new Date(start + MSK);
    const isToday = new Date(now + MSK).getUTCDate() === d.getUTCDate() && start - now < 86400e3;
    $("#next-day").textContent = (isToday ? "сегодня, " : "") + weekdays[d.getUTCDay()];
    $("#next-date").textContent = d.getUTCDate() + " " + months[d.getUTCMonth()];
    const left = start - now;
    if (left <= 0) {
      cd.innerHTML = "<b>Идёт прямо сейчас</b>";
      return;
    }
    const s = Math.floor(left / 1000);
    const days = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
    const head = days ? days + " " + plural(days, "день", "дня", "дней") + " " : "";
    cd.innerHTML = "<span>до начала</span> <b>" + head + pad(h) + ":" + pad(mi) + ":" + pad(se) + "</b>";
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  /* ---------- стол на десять: живой счётчик мест ---------- */
  const chairsSvg = $("#chairs"), seatsText = $("#seats-text");
  const ns = "http://www.w3.org/2000/svg";
  const chairEls = [];
  (function drawTable() {
    const cloth = document.createElementNS(ns, "circle");
    cloth.setAttribute("cx", 80); cloth.setAttribute("cy", 80); cloth.setAttribute("r", 42); cloth.setAttribute("class", "t-cloth");
    const top = document.createElementNS(ns, "circle");
    top.setAttribute("cx", 80); top.setAttribute("cy", 80); top.setAttribute("r", 42); top.setAttribute("class", "t-top");
    chairsSvg.append(cloth, top);
    for (let i = 0; i < CONFIG.freeSeats; i++) {
      const g = document.createElementNS(ns, "g");
      g.setAttribute("transform", `rotate(${i * (360 / CONFIG.freeSeats)} 80 80)`);
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", 70); r.setAttribute("y", 8); r.setAttribute("width", 20); r.setAttribute("height", 16); r.setAttribute("rx", 5);
      r.setAttribute("class", "chair");
      g.append(r);
      chairsSvg.append(g);
      chairEls.push(r);
    }
  })();
  let seatsKnown = null;
  function renderSeats(raw, pop) {
    const s = { total: Number(raw.total) || CONFIG.freeSeats, taken: Number(raw.taken) || 0, left: Number(raw.left) || 0 };
    seatsKnown = s;
    chairsSvg.classList.remove("is-loading");
    chairEls.forEach((c, i) => {
      const was = c.classList.contains("is-taken");
      const now = i < s.taken;
      c.classList.toggle("is-taken", now);
      if (pop && now && !was && motion) { c.classList.remove("is-pop"); void c.getBBox(); c.classList.add("is-pop"); }
    });
    seatsText.innerHTML = s.left > 0
      ? `Первая встреча бесплатна для первых десяти. Свободно <b>${s.left} из ${s.total}</b> ${plural(s.left, "место", "места", "мест")}.`
      : "Бесплатные места разобраны. Анкета открыта: напишу, когда освободится стул.";
    $("#seats").setAttribute("aria-label", s.left > 0 ? `Свободно ${s.left} из ${s.total} бесплатных мест` : "Бесплатные места разобраны");
  }
  async function loadSeats() {
    chairsSvg.classList.add("is-loading");
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(CONFIG.api + "/api/seats", { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) throw new Error(res.status);
      renderSeats(await res.json(), true);
    } catch {
      // нет связи с сервером: показываем правило без цифр
      chairsSvg.classList.remove("is-loading");
      seatsText.innerHTML = "Первая встреча бесплатна для первых десяти по&nbsp;анкете.";
    }
  }
  loadSeats();

  /* ---------- анкета: лист снизу по шагам ---------- */
  const sheet = $("#sheet"), scrim = $("#scrim"), form = $("#form");
  const panes = $$(".pane", form), nextBtn = $("#next"), backBtn = $("#sheet-back");
  const stepLabel = $("#sheet-step"), progress = $("#progress"), foot = $("#sheet-foot"), formErr = $("#form-err");
  let step = 1, isOpen = false, lastFocus = null, sending = false;
  const state = { stage: "", goals: [] };

  // варианты ответа
  const stagesBox = $("#stages"), goalsBox = $("#goals");
  STAGES.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false"); b.textContent = s;
    b.addEventListener("click", () => { state.stage = s; syncChoices(); clearErr("stage"); saveDraft(); });
    stagesBox.append(b);
  });
  stagesBox.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const opts = $$(".opt", stagesBox);
    const i = Math.max(0, STAGES.indexOf(state.stage));
    const j = (i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + opts.length) % opts.length;
    state.stage = STAGES[j]; syncChoices(); opts[j].focus(); saveDraft();
  });
  GOALS.forEach((g) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "false"); b.textContent = g;
    b.addEventListener("click", () => {
      state.goals = state.goals.includes(g) ? state.goals.filter((x) => x !== g) : [...state.goals, g];
      syncChoices(); clearErr("goals"); saveDraft();
    });
    goalsBox.append(b);
  });
  function syncChoices() {
    $$(".opt", stagesBox).forEach((b) => {
      const on = b.textContent === state.stage;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (!state.stage && b === stagesBox.firstChild) ? 0 : -1;
    });
    $$(".chip", goalsBox).forEach((b) => b.setAttribute("aria-pressed", String(state.goals.includes(b.textContent))));
  }

  // черновик, чтобы не потерять ответы при случайном закрытии
  const DRAFT = "vremya-draft";
  function saveDraft() {
    store.set(DRAFT, JSON.stringify({
      name: form.name.value, telegram: form.telegram.value, what: form.what.value,
      topic: form.topic.value, phone: form.phone.value, stage: state.stage, goals: state.goals,
    }));
  }
  (function loadDraft() {
    try {
      const d = JSON.parse(store.get(DRAFT) || "null");
      if (!d) return;
      ["name", "telegram", "what", "topic", "phone"].forEach((k) => { if (d[k]) form[k].value = d[k]; });
      if (STAGES.includes(d.stage)) state.stage = d.stage;
      if (Array.isArray(d.goals)) state.goals = d.goals.filter((g) => GOALS.includes(g));
    } catch { /* битый черновик */ }
  })();
  syncChoices();
  form.addEventListener("input", saveDraft);

  const normTg = (v) => v.trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?t(elegram)?\.me\//i, "").replace(/^@+/, "").replace(/\s+/g, "");
  form.telegram.addEventListener("blur", () => { form.telegram.value = normTg(form.telegram.value); });

  const errIds = { name: "e-name", telegram: "e-tg", what: "e-what", stage: "e-stage", goals: "e-goals" };
  function setErr(key, text) {
    const e = $("#" + errIds[key]);
    e.textContent = text;
    e.closest(".field").classList.toggle("is-bad", Boolean(text));
    const input = form[key];
    if (input && input.setAttribute) input.setAttribute("aria-invalid", text ? "true" : "false");
  }
  const clearErr = (key) => setErr(key, "");
  ["name", "telegram", "what"].forEach((k) => form[k].addEventListener("input", () => clearErr(k)));

  function validate(n) {
    const bad = [];
    if (n === 1) {
      if (form.name.value.trim().length < 2) bad.push(["name", "Напиши имя, чтобы я знал, как к тебе обращаться."]);
      const tg = normTg(form.telegram.value);
      if (!tg) bad.push(["telegram", "Без ника не смогу написать. Он есть в Telegram: Настройки, Имя пользователя."]);
      else if (!/^[A-Za-z0-9_]{4,32}$/.test(tg)) bad.push(["telegram", "Ник пишется латиницей, цифрами и _, от 4 до 32 символов."]);
      if (form.what.value.trim().length < 2) bad.push(["what", "Пара слов о деле: так подберу, с кем тебя познакомить."]);
    }
    if (n === 2) {
      if (!state.stage) bad.push(["stage", "Выбери один вариант."]);
      if (!state.goals.length) bad.push(["goals", "Выбери хотя бы одно."]);
    }
    Object.keys(errIds).forEach((k) => { if (!bad.some((b) => b[0] === k)) { const f = $("#" + errIds[k]).closest(".field"); if (f && f.closest(`[data-pane="${n}"]`)) clearErr(k); } });
    bad.forEach(([k, t]) => setErr(k, t));
    if (bad.length) focusField(bad[0][0]);
    return !bad.length;
  }
  function focusField(key) {
    if (key === "stage") ($(".opt[aria-checked='true']", stagesBox) || $(".opt", stagesBox)).focus();
    else if (key === "goals") $(".chip", goalsBox).focus();
    else form[key].focus();
  }

  function show(n, focus = true) {
    step = n;
    panes.forEach((p) => { p.hidden = p.dataset.pane !== String(n); });
    const done = n === "done";
    foot.hidden = done;
    backBtn.hidden = done || n === 1;
    progress.style.width = done ? "100%" : (n / 3) * 100 + "%";
    stepLabel.textContent = done ? "Готово" : `Шаг ${n} из 3`;
    nextBtn.textContent = n === 3 ? "Отправить анкету" : "Дальше";
    $(".sheet-body").scrollTop = 0;
    if (!focus) return;
    if (done) $("#done").focus();
    else if (n === 1) form.name.focus({ preventScroll: true });
    else if (n === 2) ($(".opt[aria-checked='true']", stagesBox) || $(".opt", stagesBox)).focus({ preventScroll: true });
    else form.topic.focus({ preventScroll: true });
  }

  function openSheet() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    scrim.hidden = false; sheet.hidden = false;
    document.body.classList.add("locked");
    requestAnimationFrame(() => { scrim.classList.add("is-open"); sheet.classList.add("is-open"); });
    history.pushState({ sheet: 1 }, "");
    show(step === "done" ? 1 : step, false);
    setTimeout(() => show(step, true), finePointer ? 50 : 420);
  }
  function hideSheet() {
    if (!isOpen) return;
    isOpen = false;
    scrim.classList.remove("is-open"); sheet.classList.remove("is-open");
    sheet.style.transform = "";
    document.body.classList.remove("locked");
    setTimeout(() => { if (!isOpen) { scrim.hidden = true; sheet.hidden = true; } }, 450);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (step === "done") step = 1;
  }
  // «Назад» телефона закрывает лист
  function closeSheet() { if (history.state && history.state.sheet) history.back(); else hideSheet(); }
  addEventListener("popstate", () => { if (isOpen) hideSheet(); });

  $$("[data-open-form]").forEach((b) => b.addEventListener("click", openSheet));
  $("#sheet-close").addEventListener("click", closeSheet);
  $("#done-close").addEventListener("click", closeSheet);
  scrim.addEventListener("click", closeSheet);
  backBtn.addEventListener("click", () => { if (typeof step === "number" && step > 1) show(step - 1); });
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
    if (e.key !== "Tab") return;
    const f = $$("button, input, textarea, a[href], [tabindex='0']", sheet).filter((el) => !el.closest("[hidden]") && !el.disabled && el.tabIndex >= 0 && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // смахнуть лист вниз за ручку
  (function drag() {
    const grip = $("#grip");
    let y0 = 0, dy = 0, t0 = 0, on = false;
    grip.addEventListener("pointerdown", (e) => { on = true; y0 = e.clientY; dy = 0; t0 = performance.now(); grip.setPointerCapture(e.pointerId); sheet.classList.add("is-dragging"); });
    grip.addEventListener("pointermove", (e) => {
      if (!on) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = `translate(-50%, ${dy}px)`;
    });
    const end = () => {
      if (!on) return;
      on = false;
      sheet.classList.remove("is-dragging");
      const v = dy / Math.max(1, performance.now() - t0);
      sheet.style.transform = "";
      if (dy > 120 || v > 0.6) closeSheet();
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
  })();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    if (step === 1 || step === 2) { if (validate(step)) show(step + 1); return; }
    if (step !== 3) return;
    send();
  });
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "submit") { e.preventDefault(); form.requestSubmit(); }
  });

  async function send() {
    formErr.hidden = true;
    sending = true;
    nextBtn.disabled = true;
    nextBtn.textContent = "Отправляю…";
    const body = {
      name: form.name.value.trim(), telegram: "@" + normTg(form.telegram.value), what: form.what.value.trim(),
      stage: state.stage, goals: state.goals, topic: form.topic.value.trim(), phone: form.phone.value.trim(),
      company: form.company.value,
    };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(CONFIG.api + "/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await res.json().catch(() => ({}));
      if (res.status === 422) {
        const map = { name: [1, "name"], telegram: [1, "telegram"], what: [1, "what"], stage: [2, "stage"], goals: [2, "goals"] };
        const hit = map[data.error];
        if (hit) { show(hit[0]); validate(hit[0]); return; }
      }
      if (!res.ok || !data.ok) throw new Error(data.error || res.status);
      store.del(DRAFT);
      const tg = body.telegram;
      $("#done-text").innerHTML = data.free === false
        ? `Бесплатные места на&nbsp;первую встречу уже разобраны, но&nbsp;анкета у&nbsp;меня. Напишу на&nbsp;<b>${escapeHtml(tg)}</b>, когда освободится стул.`
        : `Место за&nbsp;столом за&nbsp;тобой. Напишу на&nbsp;<b>${escapeHtml(tg)}</b> в&nbsp;течение дня и&nbsp;добавлю в&nbsp;чат участников.`;
      show("done");
      if (data.seats) renderSeats(data.seats, true);
    } catch {
      formErr.innerHTML = 'Анкета не&nbsp;ушла: похоже, пропал интернет. <button type="button" id="retry">Повторить</button> или напиши мне в&nbsp;<a href="' + CONFIG.telegram + '" target="_blank" rel="noopener">Telegram</a>.';
      formErr.hidden = false;
      $("#retry").addEventListener("click", send);
      $("#retry").focus();
    } finally {
      sending = false;
      nextBtn.disabled = false;
      if (step === 3) nextBtn.textContent = "Отправить анкету";
    }
  }
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------- сборка первого экрана: пять участников выкладывают его курсорами ---------- */
  if (intro) runIntro();
  async function runIntro() {
    const t1 = $(".hero .t1"), t2 = $(".hero .t2");
    const dateTile = $(".tile-date"), tableTile = $(".tile-table"), portrait = $(".hero .portrait");
    const word2 = t2.textContent;
    t2.innerHTML = [...word2].map((ch) => `<span class="ch">${ch}</span>`).join("") + '<i class="caret" aria-hidden="true"></i>';
    t2.setAttribute("aria-label", word2);
    const chars = $$(".ch", t2), caret = $(".caret", t2);
    caret.style.opacity = "0";

    let skipped = false;
    const anims = [];
    const W = innerWidth, H = innerHeight, small = W < 700;
    const people = [
      { n: "Влад", c: "#121417", x: -40, y: H * 0.3 },
      { n: "кофейня", c: "#E4673F", t: "#121417", x: W * 0.3, y: H + 30 },
      { n: "юрист", c: "#2F6FDE", x: W + 30, y: H * 0.8 },
      { n: "SMM", c: "#B03A8C", x: W + 30, y: H * 0.45 },
      { n: "мебель", c: "#1F7A52", x: W * 0.8, y: -40 },
    ].map((p) => { const el = cursorEl(p.n, p.c, p.t); el.style.transform = `translate(${p.x}px, ${p.y}px)`; document.body.append(el); return { ...p, el }; });
    const [vlad, cafe, law, smm, mebel] = people;

    const rec = document.createElement("div");
    rec.className = "rec off";
    rec.setAttribute("aria-hidden", "true");
    rec.innerHTML = '<div class="rec-h"><i class="dot"></i><span>REC · пятница_16-00 · собирают 5 участников</span><span class="who">' +
      people.map((p) => `<i style="background:${p.c}"></i>`).join("") + "</span></div><div class=\"rec-b\"></div>";
    document.body.append(rec);
    const recBody = $(".rec-b", rec);
    const sel = document.createElement("div");
    sel.className = "selbox";
    sel.innerHTML = "<i></i><i></i><i></i><i></i><b></b>";
    document.body.append(sel);

    const wait = (ms) => new Promise((r) => setTimeout(r, skipped ? 0 : ms));
    const anim = (el, kf, opt) => { const a = el.animate(kf, { fill: "forwards", ...opt }); anims.push(a); return a.finished.catch(() => {}); };
    const move = (p, x, y, ms = 650) => { const from = `translate(${p.x}px, ${p.y}px)`; p.x = x; p.y = y; return anim(p.el, [{ transform: from }, { transform: `translate(${x}px, ${y}px)` }], { duration: skipped ? 0 : ms, easing: "cubic-bezier(.55,0,.2,1)" }); };
    const click = (p) => { p.el.classList.add("is-click"); setTimeout(() => p.el.classList.remove("is-click"), 150); };
    const log = (p, text) => {
      if (skipped) return;
      const l = document.createElement("div");
      l.className = "rec-l";
      l.style.setProperty("--c", p.c === "#121417" ? "#D8E1E7" : p.c);
      l.innerHTML = "<b></b><span></span>";
      l.firstChild.textContent = p.n + ":";
      l.lastChild.textContent = text;
      recBody.append(l);
      while (recBody.children.length > (small ? 3 : 5)) recBody.firstChild.remove();
    };
    const drop = (el) => anim(el, [
      { opacity: 0, transform: "translateY(-24px) scale(.86) rotate(-4deg)" },
      { opacity: 1, transform: "none" },
    ], { duration: skipped ? 0 : 620, easing: "cubic-bezier(.2,1.4,.3,1)" });
    const center = (el, fx = 0.5, fy = 0.5) => { const r = el.getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; };

    function finish() {
      if (skipped) return;
      skipped = true;
      anims.forEach((a) => { try { a.finish(); } catch { /* уже готово */ } });
      cleanup();
    }
    function cleanup() {
      ["wheel", "touchstart", "keydown", "pointerdown", "scroll"].forEach((ev) => removeEventListener(ev, finish, true));
      root.classList.remove("assembling");
      anims.forEach((a) => { try { a.cancel(); } catch { /* уже снято */ } });
      t2.textContent = word2;
      t2.removeAttribute("aria-label");
      people.forEach((p) => p.el.remove());
      sel.remove();
      rec.classList.add("off");
      setTimeout(() => rec.remove(), 600);
      try { sessionStorage.setItem("vr-intro", "1"); } catch { /* приватный режим */ }
      if (seatsKnown) renderSeats(seatsKnown, true);
    }
    ["wheel", "touchstart", "keydown", "pointerdown", "scroll"].forEach((ev) => addEventListener(ev, finish, { capture: true, passive: true }));

    await wait(250);
    rec.classList.remove("off");
    // все влетают
    // «Время» пока сжато до 22%: настоящую ширину текста берём из диапазона и делим обратно
    const rng = document.createRange();
    rng.selectNodeContents(t1);
    const rr = rng.getBoundingClientRect(), tb = t1.getBoundingClientRect();
    const r1 = { left: tb.left, top: tb.top, height: tb.height, width: rr.width / 0.22 };
    r1.right = r1.left + r1.width;
    await Promise.all([
      move(vlad, r1.left + r1.width * 0.2, r1.top + r1.height * 0.55),
      move(cafe, W * 0.25, H * 0.62), move(law, W * 0.7, H * 0.78), move(smm, W * 0.86, H * 0.6), move(mebel, W * 0.78, H * 0.22),
    ]);
    if (skipped) return;

    // Влад растягивает «Время»
    sel.style.setProperty("--c", "#2F6FDE");
    sel.style.width = r1.width + "px"; sel.style.height = r1.height + "px";
    sel.style.transform = `translate(${r1.left}px, ${r1.top}px) scaleX(.22)`;
    sel.classList.add("on");
    click(vlad);
    log(vlad, "растягивает «Время» по ширине");
    const label = $("b", sel);
    const t0 = performance.now();
    const counter = setInterval(() => { const k = clamp((performance.now() - t0) / 900); label.textContent = "ширина " + Math.round(22 + 78 * (1 - Math.pow(1 - k, 3))) + "%"; label.style.transform = `scaleX(${1 / (0.22 + 0.78 * (1 - Math.pow(1 - k, 3)))})`; label.style.transformOrigin = "0 0"; }, 30);
    await Promise.all([
      anim(t1, [{ opacity: 1, transform: "scaleX(.22)" }, { opacity: 1, transform: "scaleX(1.05)", offset: 0.75 }, { opacity: 1, transform: "scaleX(1)" }], { duration: 900, easing: "cubic-bezier(.3,.7,.2,1)" }),
      anim(sel, [{ transform: `translate(${r1.left}px, ${r1.top}px) scaleX(.22)` }, { transform: `translate(${r1.left}px, ${r1.top}px) scaleX(1.05)`, offset: 0.75 }, { transform: `translate(${r1.left}px, ${r1.top}px) scaleX(1)` }], { duration: 900, easing: "cubic-bezier(.3,.7,.2,1)" }),
      move(vlad, r1.right - 6, r1.top + r1.height * 0.55, 900),
    ]);
    clearInterval(counter);
    label.style.transform = "";
    label.textContent = "ширина 100%";
    if (skipped) return;
    await wait(200);
    sel.classList.remove("on");

    // кофейня печатает «развиваться»; параллельно юрист и SMM выкладывают плитки
    const typing = (async () => {
      const [cx, cy] = center(chars[0], 0, 0.8);
      await move(cafe, cx, cy, 500);
      if (skipped) return;
      log(cafe, "печатает «развиваться»");
      caret.style.opacity = "1";
      for (const ch of chars) {
        if (skipped) return;
        ch.style.opacity = "1";
        const r = ch.getBoundingClientRect();
        cafe.el.getAnimations().forEach((a) => a.cancel());
        cafe.x = r.right + 4; cafe.y = r.top + r.height * 0.8;
        cafe.el.style.transform = `translate(${cafe.x}px, ${cafe.y}px)`;
        await wait(60);
      }
      caret.style.opacity = "0";
    })();
    const tiles = (async () => {
      await wait(250);
      let [x, y] = center(dateTile, 0.55, 0.45);
      await move(law, x, y, 600);
      if (skipped) return;
      click(law); log(law, "+ ближайшая пятница");
      await drop(dateTile);
      [x, y] = center(tableTile, 0.5, 0.4);
      await move(smm, x, y, 500);
      if (skipped) return;
      click(smm); log(smm, "+ стол на десять человек");
      await drop(tableTile);
      if (seatsKnown) renderSeats(seatsKnown, true);
    })();
    const photo = (async () => {
      await wait(700);
      const [x, y] = center(portrait, 0.7, 0.75);
      await move(mebel, x, y, 650);
      if (skipped) return;
      click(mebel); log(mebel, "ставит портрет ведущего");
      await anim(portrait, [{ opacity: 0, transform: "scale(.4) rotate(-90deg)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,1.3,.3,1)" });
    })();
    await Promise.all([typing, tiles, photo]);
    if (skipped) return;

    // текст и кнопка, Влад показывает на анкету
    root.classList.remove("assembling");
    const btn = $(".hero .cta-row .btn");
    const [bx, by] = center(btn, 0.6, 0.6);
    await move(vlad, bx, by, 700);
    if (skipped) return;
    log(vlad, "собрали за 4 секунды. Твоё место за столом");
    await wait(1400);
    if (skipped) return;
    await Promise.all(people.map((p, i) => Promise.all([
      move(p, p.x + (i % 2 ? 1 : -1) * W * 0.5, p.y + (i < 2 ? H * 0.4 : -H * 0.4), 800),
      anim(p.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, delay: 200 }),
    ])));
    skipped = true;
    cleanup();
  }

  // открыть анкету по ссылке …#anketa
  if (location.hash === "#anketa") openSheet();
})();
