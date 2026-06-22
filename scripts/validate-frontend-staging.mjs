#!/usr/bin/env node

const frontendUrl = process.env.FRONTEND_STAGING_URL;
const expectedApiUrl = process.env.EXPECTED_API_URL ?? "https://aicfo-staging-production.up.railway.app";

if (!frontendUrl) {
  console.error("FRONTEND_STAGING_URL obrigatório");
  process.exit(1);
}

async function read(path) {
  const url = new URL(path, frontendUrl).toString();
  const res = await fetch(url);
  const text = await res.text();
  return { url, status: res.status, ok: res.ok, text };
}

async function assertOk(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const root = await read("/");
await assertOk("frontend / responde 200", () => {
  if (!root.ok) throw new Error(`${root.url} => ${root.status}`);
});

await assertOk("HTML referencia bundle JS/CSS", () => {
  if (!root.text.includes(".js") || !root.text.includes(".css")) {
    throw new Error("index.html sem assets JS/CSS esperados");
  }
});

const env = await read("/env.js");
await assertOk("/env.js responde 200", () => {
  if (!env.ok) throw new Error(`${env.url} => ${env.status}`);
});

await assertOk("/env.js aponta para API staging", () => {
  if (!env.text.includes(expectedApiUrl)) {
    throw new Error(`esperado ${expectedApiUrl}; recebido: ${env.text.slice(0, 200)}`);
  }
});

await assertOk("API staging /health responde 200", async () => {
  const res = await fetch(`${expectedApiUrl}/health`);
  if (!res.ok) throw new Error(`${expectedApiUrl}/health => ${res.status}`);
  const body = await res.json();
  if (body.status !== "ok") throw new Error(`health inesperado: ${JSON.stringify(body)}`);
});

if (process.exitCode) process.exit(process.exitCode);
console.log("\nFrontend staging validado.");
