#!/usr/bin/env tsx
/**
 * forge:doctor — valida a consistência da estrutura Forge no consumidor (Aicfo).
 *
 * Gate de governança rodável localmente e no CI. Detecta drift que hoje passava
 * despercebido (ex: constitution_version do manifest divergindo da CONSTITUTION.md).
 * Sai com código != 0 se qualquer check falhar — o hook manifest-sync apenas avisa
 * em tempo de edição; este é o gate real.
 *
 * Uso: npm run forge:doctor
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

const root = process.cwd();
const manifestPath = resolve(root, "docs/forge/manifest.json");

if (!existsSync(manifestPath)) {
  console.error("❌ forge:doctor — docs/forge/manifest.json não encontrado.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
  manifest_version?: string;
  framework?: { version?: string; constitution_version?: string; constitution_path?: string; constitution_sha256?: string | null };
};

const fw = manifest.framework ?? {};

// 1. Coerência interna: manifest_version == framework.version
check(
  "manifest_version == framework.version",
  manifest.manifest_version === fw.version,
  `manifest_version=${manifest.manifest_version} framework.version=${fw.version}`,
);

// 2. constitution_path existe
const constitutionPath = fw.constitution_path ?? ".claude/CONSTITUTION.md";
const constitutionAbs = resolve(root, constitutionPath);
const constitutionExists = existsSync(constitutionAbs);
check("constitution_path existe", constitutionExists, constitutionPath);

if (constitutionExists) {
  const constitutionRaw = readFileSync(constitutionAbs, "utf-8");

  // 3. constitution_version (manifest) == versão declarada no header da CONSTITUTION.md
  //    Header: "> **Versão**: 0.4.0"
  const versionMatch = constitutionRaw.match(/\*\*Vers[ãa]o\*\*:\s*([0-9]+\.[0-9]+\.[0-9]+)/i);
  const docVersion = versionMatch?.[1] ?? null;
  check(
    "constitution_version sincronizada",
    !!docVersion && docVersion === fw.constitution_version,
    `manifest.constitution_version=${fw.constitution_version} CONSTITUTION.md=${docVersion ?? "não encontrada"}`,
  );

  // 4. constitution_sha256: se declarado (não-null), deve bater com o arquivo.
  //    Se null, é apenas um aviso (não bloqueia) — sugere popular.
  if (fw.constitution_sha256) {
    const actual = createHash("sha256").update(constitutionRaw).digest("hex");
    check(
      "constitution_sha256 confere",
      actual === fw.constitution_sha256,
      `declarado=${fw.constitution_sha256.slice(0, 16)}… atual=${actual.slice(0, 16)}…`,
    );
  } else {
    console.warn("⚠️  constitution_sha256 é null no manifest — considere popular para travar integridade.");
  }
}

// Relatório
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✅" : "❌"} ${c.name} — ${c.detail}`);
  if (!c.ok) failed++;
}

if (failed > 0) {
  console.error(`\nforge:doctor — ${failed} check(s) falharam. Forge drift detectado.`);
  process.exit(1);
}
console.log(`\nforge:doctor — ${checks.length} checks OK.`);
