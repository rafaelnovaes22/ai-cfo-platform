// Load test runner — simula N clientes fazendo upload e mede upload, tempo até a
// análise ficar pronta, e falhas. Pensado para ramp até centenas (Gate 1.6: 500).
//
// IMPORTANTE — pré-requisitos antes de blastar valores altos contra staging:
//   1. connection_limit/pool_timeout aplicados na DATABASE_URL do staging (Gate 1.1),
//      senão o teste estoura o pool do Postgres e dá falso-negativo.
//   2. RATE_LIMIT_MAX alto em staging durante o teste (ex: 10000) — o rate limit é
//      por IP e TODO o tráfego do teste vem do mesmo IP; sem isso, 429s mascaram o
//      resultado. O script conta os 429 separadamente para você detectar esse caso.
//   3. staging compartilha quota Vertex com produção — faça ramp (5 → 50 → 200 → 500)
//      observando a saúde de produção e as métricas do Railway, NÃO dispare 500 de cara.
//
// Uso:
//   tsx scripts/loadtest-run.mjs --count=500 --inflight=25 \
//     [--base=https://aicfo-staging-production.up.railway.app] \
//     [--file="C:/Users/Rafael/Downloads/RELATORIO FINANCEIRO 2026.xlsx"] \
//     [--password=LoadTest@2026] [--retries=4]
import fs from "node:fs";

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
// --count é o total de clientes; --concurrency mantido como alias retrocompatível.
const COUNT = Number(arg("count", arg("concurrency", "5")));
const INFLIGHT = Number(arg("inflight", "25"));   // máximo de uploads simultâneos em voo
const RETRIES = Number(arg("retries", "4"));      // retry em 429/503 com backoff
const BASE = arg("base", "https://aicfo-staging-production.up.railway.app");
const FILE = arg("file", "C:/Users/Rafael/Downloads/RELATORIO FINANCEIRO 2026.xlsx");
const PASSWORD = arg("password", "LoadTest@2026");
const POLL_MS = 3000, MAX_POLL = 200; // ~10 min teto por análise (sob carga, demora mais)

// Guard anti-produção: o domínio de PROD é aicfo-api-production (staging é
// aicfo-staging-production e é permitido).
if (/aicfo-api-production/.test(BASE)) {
  throw new Error(`ABORTADO: BASE aponta para PRODUÇÃO (${BASE}). Load test só em staging/local.`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

// Contadores globais de respostas de capacidade (não-fatais, contornados por retry).
const counters = { rateLimited429: 0, backpressure503: 0 };

// fetch com retry/backoff em 429 (rate limit) e 503 (backpressure). Respeita Retry-After.
async function fetchRetry(url, opts) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, opts);
    if ((r.status === 429 || r.status === 503) && attempt < RETRIES) {
      if (r.status === 429) counters.rateLimited429++;
      if (r.status === 503) counters.backpressure503++;
      const retryAfter = Number(r.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      await sleep(Math.min(wait, 8000));
      continue;
    }
    return r;
  }
}

// Pool: processa todos os clientes com no máximo `inflight` em voo simultaneamente.
async function pool(total, inflight, fn) {
  const results = new Array(total);
  let idx = 0;
  async function worker() {
    while (idx < total) { const i = idx++; results[i] = await fn(i); }
  }
  await Promise.all(Array.from({ length: Math.min(inflight, total) }, worker));
  return results;
}

async function login(email) {
  const r = await fetchRetry(`${BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  if (!r.ok) throw new Error(`login ${email} ${r.status}`);
  return (await r.json()).accessToken;
}

async function oneUser(i, buf) {
  const idx = i + 1;
  const m = { i: idx, ok: false, uploadMs: 0, readyMs: 0, status: "", error: "" };
  try {
    const token = await login(`loadtest+${idx}@acme.test`);
    const fd = new FormData();
    fd.append("file", new Blob([buf]), "lt.xlsx");
    const t0 = Date.now();
    const up = await fetchRetry(`${BASE}/ingest/upload?referenceMonth=2026-06`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    m.uploadMs = Date.now() - t0;
    if (!up.ok) { m.error = `upload_${up.status}`; m.status = String(up.status); return m; }
    const { analysisId } = await up.json();
    const t1 = Date.now();
    for (let p = 0; p < MAX_POLL; p++) {
      const r = await fetchRetry(`${BASE}/analysis/${analysisId}/action-plan`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const body = await r.json();
        if (["ready", "delivered", "approved", "failed"].includes(body.analysisStatus)) {
          m.readyMs = Date.now() - t1; m.status = body.analysisStatus; m.ok = body.analysisStatus !== "failed"; return m;
        }
      }
      await sleep(POLL_MS);
    }
    m.error = "poll_timeout"; m.status = "TIMEOUT"; return m;
  } catch (e) { m.error = e.message.slice(0, 80); return m; }
}

async function main() {
  const buf = fs.readFileSync(FILE);
  console.log(`== Load test: ${COUNT} clientes, até ${INFLIGHT} em voo, em ${BASE} ==`);
  const started = Date.now();
  const results = await pool(COUNT, INFLIGHT, (i) => oneUser(i, buf));
  const wall = Date.now() - started;

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const uploads = results.map((r) => r.uploadMs).filter(Boolean);
  const totals = ok.map((r) => r.uploadMs + r.readyMs);
  const throughput = wall > 0 ? (ok.length / (wall / 60000)).toFixed(1) : "0";

  console.log(`\nwall-clock total: ${secs(wall)}  |  ok: ${ok.length}/${COUNT}  |  falhas: ${fail.length}  |  throughput: ${throughput} análises/min`);
  console.log(`upload  — p50 ${secs(pct(uploads, 50))}  p95 ${secs(pct(uploads, 95))}  max ${secs(Math.max(0, ...uploads))}`);
  console.log(`total   — p50 ${secs(pct(totals, 50))}  p95 ${secs(pct(totals, 95))}  max ${secs(Math.max(0, ...totals))}`);
  console.log(`capacidade — 429 (rate limit): ${counters.rateLimited429}  |  503 (backpressure): ${counters.backpressure503}`);
  if (counters.rateLimited429 > 0) console.log(`  ⚠️ houve 429 — suba RATE_LIMIT_MAX em staging durante o teste para não mascarar o resultado.`);
  const byStatus = results.reduce((a, r) => { const k = r.status || r.error || "?"; a[k] = (a[k] || 0) + 1; return a; }, {});
  console.log(`status:`, JSON.stringify(byStatus));
  if (fail.length) console.log(`falhas (até 20):`, fail.slice(0, 20).map((f) => `#${f.i}:${f.error || f.status}`).join(", "));
}
main().catch((e) => { console.error("Falha:", e.message); process.exit(1); });
