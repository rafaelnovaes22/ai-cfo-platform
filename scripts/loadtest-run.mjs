// Load test runner — dispara N uploads CONCORRENTES (1 por tenant de teste) contra a
// API e mede upload, tempo até a análise ficar pronta e falhas. NÃO blastar valores
// altos: staging compartilha a quota Vertex de produção (pode degradar a cliente real).
// Faça um ramp (3 → 5 → 10) observando a saúde de produção e as métricas do Railway.
//
// Uso: tsx scripts/loadtest-run.mjs --concurrency=5 [--base=https://aicfo-staging-production.up.railway.app] [--file="C:/Users/Rafael/Downloads/RELATORIO FINANCEIRO 2026.xlsx"] [--password=LoadTest@2026]
import fs from "node:fs";

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const N = Number(arg("concurrency", "5"));
const BASE = arg("base", "https://aicfo-staging-production.up.railway.app");
const FILE = arg("file", "C:/Users/Rafael/Downloads/RELATORIO FINANCEIRO 2026.xlsx");
const PASSWORD = arg("password", "LoadTest@2026");
const POLL_MS = 3000, MAX_POLL = 140; // ~7 min teto por análise

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

async function login(email) {
  const r = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  if (!r.ok) throw new Error(`login ${email} ${r.status}`);
  return (await r.json()).accessToken;
}

async function oneUser(i, buf) {
  const m = { i, ok: false, uploadMs: 0, readyMs: 0, status: "", error: "" };
  try {
    const token = await login(`loadtest+${i}@acme.test`);
    const fd = new FormData();
    fd.append("file", new Blob([buf]), "lt.xlsx");
    const t0 = Date.now();
    const up = await fetch(`${BASE}/ingest/upload?referenceMonth=2026-06`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    m.uploadMs = Date.now() - t0;
    if (!up.ok) { m.error = `upload_${up.status}`; m.status = String(up.status); return m; }
    const { analysisId } = await up.json();
    const t1 = Date.now();
    for (let p = 0; p < MAX_POLL; p++) {
      const r = await fetch(`${BASE}/analysis/${analysisId}/action-plan`, { headers: { Authorization: `Bearer ${token}` } });
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
  console.log(`== Load test: ${N} uploads concorrentes em ${BASE} ==`);
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: N }, (_, k) => oneUser(k + 1, buf)));
  const wall = Date.now() - started;

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const uploads = results.map((r) => r.uploadMs).filter(Boolean);
  const totals = ok.map((r) => r.uploadMs + r.readyMs);

  console.log(`\nwall-clock total: ${secs(wall)}  |  ok: ${ok.length}/${N}  |  falhas: ${fail.length}`);
  console.log(`upload  — p50 ${secs(pct(uploads, 50))}  p95 ${secs(pct(uploads, 95))}  max ${secs(Math.max(0, ...uploads))}`);
  console.log(`total   — p50 ${secs(pct(totals, 50))}  p95 ${secs(pct(totals, 95))}  max ${secs(Math.max(0, ...totals))}`);
  const byStatus = results.reduce((a, r) => { const k = r.status || r.error || "?"; a[k] = (a[k] || 0) + 1; return a; }, {});
  console.log(`status:`, JSON.stringify(byStatus));
  if (fail.length) console.log(`falhas:`, fail.map((f) => `#${f.i}:${f.error || f.status}`).join(", "));
}
main().catch((e) => { console.error("Falha:", e.message); process.exit(1); });
