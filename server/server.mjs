// «Время развиваться»: приёмник анкет, счётчик бесплатных мест и админка.
// Без зависимостей: node:http + встроенный node:sqlite (Node 22.13+).
// Пароль админки приходит из окружения (EnvironmentFile на сервере), в репозитории его нет.
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8916);
const DB_PATH = process.env.DB_PATH || join(HERE, "leads.db");
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const SITE_URL = process.env.SITE_URL || "https://shumniyvlad-cell.github.io/vremya-razvivatsya/";
const FREE_SEATS = Number(process.env.FREE_SEATS || 10);
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://shumniyvlad-cell.github.io,http://localhost:8915")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MAX_LEADS = 5000;

const STAGES = ["Запускаю дело", "Есть бизнес, до 1 млн в месяц", "Бизнес от 1 до 5 млн в месяц", "Бизнес больше 5 млн в месяц", "Эксперт или специалист"];
const GOALS = ["Знакомства и партнёры", "Клиенты", "ИИ и новые инструменты", "Разбор моей задачи", "Рост и среда"];
const STATUSES = ["Новая", "Написал", "В группе", "Резидент", "Отказ"];

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    name TEXT NOT NULL,
    telegram TEXT NOT NULL,
    tg_key TEXT NOT NULL UNIQUE,
    what TEXT NOT NULL,
    stage TEXT NOT NULL,
    goals TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Новая',
    deleted INTEGER NOT NULL DEFAULT 0
  );
`);

const upsert = db.prepare(`
  INSERT INTO leads (created_at, updated_at, name, telegram, tg_key, what, stage, goals, topic, phone, deleted)
  VALUES (@now, @now, @name, @telegram, @tg_key, @what, @stage, @goals, @topic, @phone, 0)
  ON CONFLICT(tg_key) DO UPDATE SET
    updated_at = @now, name = @name, telegram = @telegram, what = @what, stage = @stage,
    goals = @goals, topic = @topic, phone = @phone
`);
const listLeads = db.prepare("SELECT * FROM leads WHERE deleted = 0 ORDER BY created_at DESC");
const countAll = db.prepare("SELECT COUNT(*) AS n FROM leads");
// отказ освобождает бесплатное место, удалённые анкеты тоже
const countSeats = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE deleted = 0 AND status <> 'Отказ'");
const softDelete = db.prepare("UPDATE leads SET deleted = 1 WHERE id = ?");
const setStatus = db.prepare("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?");

/* ограничение частоты: по адресу, в памяти */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) if (!arr.some((t) => now - t < 3600e3)) hits.delete(k);
}, 600e3).unref();

// сервис слушает только 127.0.0.1, перед ним Caddy: он дописывает настоящий адрес последним в X-Forwarded-For
const clientIp = (req) => {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : String(req.socket.remoteAddress || "");
};

function send(res, status, body, headers = {}) {
  const isObj = typeof body === "object" && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    "Content-Type": isObj ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(data);
}

function readJson(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);

function normTelegram(v) {
  let s = clean(v, 80).replace(/^https?:\/\//i, "").replace(/^(www\.)?t(elegram)?\.me\//i, "").replace(/^@+/, "");
  return "@" + s;
}

function parseLead(body) {
  const name = clean(body.name, 80);
  const telegram = normTelegram(body.telegram);
  const what = clean(body.what, 160);
  const stage = clean(body.stage, 60);
  const goals = Array.isArray(body.goals) ? [...new Set(body.goals.map(String))].filter((g) => GOALS.includes(g)) : [];
  if (name.length < 2) return { error: "name" };
  if (!/^@[A-Za-z0-9_]{4,32}$/.test(telegram)) return { error: "telegram" };
  if (what.length < 2) return { error: "what" };
  if (!STAGES.includes(stage)) return { error: "stage" };
  if (!goals.length) return { error: "goals" };
  return {
    lead: {
      name, telegram, tg_key: telegram.toLowerCase(), what, stage, goals: goals.join(", "),
      topic: clean(body.topic, 500),
      phone: clean(body.phone, 40).replace(/[^0-9+() -]/g, "").slice(0, 30),
    },
  };
}

function seats() {
  const taken = countSeats.get().n;
  return { total: FREE_SEATS, taken: Math.min(taken, FREE_SEATS), left: Math.max(0, FREE_SEATS - taken) };
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const digest = (s) => createHash("sha256").update(s).digest();
function isAdmin(req) {
  if (!ADMIN_USER || !ADMIN_PASS) return false;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const raw = Buffer.from(m[1], "base64").toString("utf8");
  const i = raw.indexOf(":");
  if (i < 0) return false;
  const okUser = timingSafeEqual(digest(raw.slice(0, i)), digest(ADMIN_USER));
  const okPass = timingSafeEqual(digest(raw.slice(i + 1)), digest(ADMIN_PASS));
  return okUser && okPass;
}

function adminData() {
  const leads = listLeads.all();
  const count = (field, options, multi) => options.map((o) => ({
    label: o,
    count: leads.filter((l) => (multi ? l[field].split(", ").includes(o) : l[field] === o)).length,
  }));
  return {
    leads, total: leads.length, seats: seats(), statuses: STATUSES,
    stages: count("stage", STAGES), goals: count("goals", GOALS, true), byStatus: count("status", STATUSES),
  };
}

function csv(leads) {
  const cell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  // свободный текст анкеты Excel может принять за формулу, ник и телефон уже проверены на входе
  const text = (v) => (/^[=+\-@\t]/.test(String(v ?? "")) ? "'" + v : v);
  const when = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" });
  const head = ["Подана (МСК)", "Имя", "Telegram", "Чем занимается", "Стадия", "Зачем идёт", "Тема для разбора", "Телефон", "Статус"];
  const rows = leads.map((l) => [when.format(new Date(l.created_at)), text(l.name), l.telegram, text(l.what), l.stage, l.goals, text(l.topic), l.phone, l.status]);
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  const ip = clientIp(req);

  try {
    if (path === "/health") return send(res, 200, { ok: true });

    if (path === "/api/seats") {
      const cors = corsHeaders(req);
      if (req.method === "OPTIONS") return send(res, 204, "", cors);
      if (limited("seats:" + ip, 120, 600e3)) return send(res, 429, { error: "rate" }, cors);
      return send(res, 200, seats(), cors);
    }

    if (path === "/api/lead") {
      const cors = corsHeaders(req);
      if (req.method === "OPTIONS") return send(res, 204, "", cors);
      if (req.method !== "POST") return send(res, 405, { error: "method" }, cors);
      // порог с запасом: за одним адресом мобильного оператора сидит много людей
      if (limited("lead:" + ip, 12, 600e3)) return send(res, 429, { error: "rate" }, cors);
      let body;
      try { body = await readJson(req); } catch { return send(res, 400, { error: "body" }, cors); }
      if (body.company) return send(res, 200, { ok: true, seats: seats() }, cors); // приманка для ботов
      const { lead, error } = parseLead(body);
      if (error) return send(res, 422, { error }, cors);
      if (countAll.get().n >= MAX_LEADS) return send(res, 503, { error: "full" }, cors);
      const before = seats();
      upsert.run({ ...lead, now: new Date().toISOString() });
      // free: попал ли человек в бесплатные места (повторная анкета с тем же ником место не занимает)
      return send(res, 200, { ok: true, free: before.left > 0, seats: seats() }, cors);
    }

    if (path === "/admin" || path.startsWith("/admin/")) {
      if (limited("auth:" + ip, 200, 600e3)) return send(res, 429, "Слишком много запросов, подожди 10 минут.");
      if (!isAdmin(req)) {
        if (req.headers.authorization && (limited("authfail:" + ip, 10, 600e3) || limited("authfail:all", 60, 600e3))) return send(res, 429, "Слишком много попыток, подожди 10 минут.");
        return send(res, 401, "Нужен пароль.", { "WWW-Authenticate": 'Basic realm="Vremya", charset="UTF-8"' });
      }
      if (path === "/admin" && req.method === "GET") {
        return send(res, 200, readFileSync(join(HERE, "admin.html")), {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer",
        });
      }
      if (path === "/admin/leads.json" && req.method === "GET") return send(res, 200, adminData());
      if (path === "/admin/leads.csv" && req.method === "GET") {
        return send(res, 200, csv(listLeads.all()), {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="vremya-ankety.csv"',
        });
      }
      // заголовок нельзя выставить формой с чужого сайта, это защита от подделки запроса
      if ((path === "/admin/delete" || path === "/admin/status") && req.method === "POST") {
        if (req.headers["x-admin"] !== "1") return send(res, 403, { error: "forbidden" });
        const body = await readJson(req);
        const id = Number(body.id) || 0;
        if (path === "/admin/delete") softDelete.run(id);
        else {
          if (!STATUSES.includes(body.status)) return send(res, 422, { error: "status" });
          setStatus.run(body.status, new Date().toISOString(), id);
        }
        return send(res, 200, { ok: true });
      }
      return send(res, 404, "Нет такой страницы.");
    }

    if (path === "/") return send(res, 302, "", { Location: SITE_URL });
    return send(res, 404, "Нет такой страницы.");
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "server" });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log("vremya-leads on 127.0.0.1:" + PORT));
