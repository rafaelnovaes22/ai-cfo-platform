// Sampler do load test (Gate 2.4) — amostra memória do Redis e profundidade da fila
// a cada 30s e escreve CSV. Rodar em paralelo ao loadtest-run.mjs --mode=burst.
//
// Uso: REDIS_URL=<staging público> node scripts/loadtest-sample.mjs --out=loadtest-sample.csv [--minutes=600]
import fs from "node:fs";
import IORedis from "ioredis";
import { Queue } from "bullmq";

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const OUT = arg("out", "loadtest-sample.csv");
const MINUTES = Number(arg("minutes", "600"));
const INTERVAL_MS = 30_000;

if (!process.env.REDIS_URL) throw new Error("REDIS_URL obrigatório (Redis de staging, público)");
if (/redis\.railway\.internal|(^|@)redis-[^3]/.test(process.env.REDIS_URL) && !/redis-3xav|proxy\.rlwy\.net/.test(process.env.REDIS_URL)) {
  throw new Error("ABORTADO: REDIS_URL não parece ser o Redis-staging.");
}

const redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const q = new Queue("monthly-analysis-graph", { connection: redis });

const info = (text, key) => text.match(new RegExp(`^${key}:(\\S+)`, "m"))?.[1] ?? "";

fs.writeFileSync(OUT, "ts,used_memory_mb,used_memory_peak_mb,maxmemory_mb,waiting,active,delayed,failed,completed\n");
console.log(`amostrando a cada ${INTERVAL_MS / 1000}s → ${OUT} (Ctrl+C para parar)`);

const deadline = Date.now() + MINUTES * 60_000;
while (Date.now() < deadline) {
  try {
    const [mem, counts] = await Promise.all([
      redis.info("memory"),
      q.getJobCounts("waiting", "active", "delayed", "failed", "completed"),
    ]);
    const mb = (v) => v ? (Number(v) / 1024 / 1024).toFixed(1) : "";
    const row = [
      new Date().toISOString(),
      mb(info(mem, "used_memory")),
      mb(info(mem, "used_memory_peak")),
      mb(info(mem, "maxmemory")),
      counts.waiting ?? 0, counts.active ?? 0, counts.delayed ?? 0,
      counts.failed ?? 0, counts.completed ?? 0,
    ].join(",");
    fs.appendFileSync(OUT, row + "\n");
  } catch (e) {
    fs.appendFileSync(OUT, `${new Date().toISOString()},ERR ${String(e.message).slice(0, 60)}\n`);
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}
await q.close();
await redis.quit();
