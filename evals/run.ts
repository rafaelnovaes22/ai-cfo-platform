// Eval runner — validador estrutural offline (não invoca LLM).
//
// Para cada módulo em evals/{module}/:
//   1. Lê manifest.json e valida shape.
//   2. Conta arquivos em cases/ e confere `total_cases`.
//   3. Confere cada case file: frontmatter mínimo válido + module/outcome consistentes.
//   4. Confere distribuição declarada (real/synthetic/edge/adversarial) por módulo.
//
// Exit 0 se tudo passar; exit 1 se algum manifest/case violar invariantes.
//
// Não depende de LLM, banco ou rede — pode rodar no CI.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { z } from "zod";

const EVALS_ROOT = resolve(process.cwd(), "evals");

// ────────────────────────────────────────────────────────────────────────────
// Schemas

const SourceDistribution = z.object({
  real: z.string(),
  synthetic: z.string(),
  edge: z.string(),
  adversarial: z.string(),
});

const ManifestSchema = z.object({
  module: z.string().min(1),
  outcomes: z.array(z.string().min(1)).min(1),
  pass_rate_threshold: z.number().min(0).max(1),
  source_distribution: SourceDistribution.partial().optional(),
  min_cases_per_outcome: z.number().int().positive().optional(),
  total_cases: z.number().int().positive().optional(),
  // Métodos podem ser string única ou objeto {outcome: method}.
  eval_method: z.union([z.string(), z.record(z.union([z.string(), z.array(z.string())]))]).optional(),
  eval_methods: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  // manifest_kind: leaf (default) tem cases/ direto; sku_aggregate delega para sub-agentes.
  manifest_kind: z.enum(["leaf", "sku_aggregate"]).optional(),
  last_updated: z.string().optional(),
}).passthrough();

type Manifest = z.infer<typeof ManifestSchema>;

const CaseFrontmatterSchema = z.object({
  case_id: z.string().min(1),
  module: z.string().min(1),
  outcome: z.string().min(1),
  source_mode: z.enum(["real", "synthetic", "edge", "adversarial"]),
  priority: z.string().optional(),
  created_at: z.string().optional(),
}).passthrough();

// ────────────────────────────────────────────────────────────────────────────
// Helpers

interface ValidationIssue {
  module: string;
  file?: string;
  message: string;
}

function listModules(): string[] {
  if (!existsSync(EVALS_ROOT)) return [];
  return readdirSync(EVALS_ROOT).filter((name) => {
    const full = join(EVALS_ROOT, name);
    try {
      return statSync(full).isDirectory() && existsSync(join(full, "manifest.json"));
    } catch {
      return false;
    }
  });
}

function parseManifest(modulePath: string, issues: ValidationIssue[]): Manifest | null {
  const file = join(modulePath, "manifest.json");
  try {
    const raw = readFileSync(file, "utf-8");
    const data: unknown = JSON.parse(raw);
    const parsed = ManifestSchema.safeParse(data);
    if (!parsed.success) {
      issues.push({
        module: basename(modulePath),
        file: "manifest.json",
        message: `manifest inválido: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      });
      return null;
    }
    return parsed.data;
  } catch (err) {
    issues.push({
      module: basename(modulePath),
      file: "manifest.json",
      message: `erro lendo manifest: ${String(err)}`,
    });
    return null;
  }
}

// Frontmatter minimal parser (YAML-light): aceita pares "chave: valor" entre `---`.
function parseFrontmatter(text: string): Record<string, unknown> | null {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match || !match[1]) return null;

  const obj: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value: string = trimmed.slice(colon + 1).trim();
    // Aspas
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    obj[key] = value;
  }
  return obj;
}

function validateModule(module: string, issues: ValidationIssue[]): void {
  const modulePath = join(EVALS_ROOT, module);
  const manifest = parseManifest(modulePath, issues);
  if (!manifest) return;

  if (manifest.module !== module) {
    issues.push({
      module,
      file: "manifest.json",
      message: `manifest.module="${manifest.module}" não bate com diretório "${module}"`,
    });
  }

  // Aggregate manifests delegam para sub-agentes (cases/ vive em evals/{module}/{sub-agente}/cases/).
  // Validar apenas que o manifest e' shape-valido; cases sao validados nos sub-manifests.
  if (manifest.manifest_kind === "sku_aggregate") {
    console.log(`  - ${module}: SKU aggregate (delegates to sub-agent manifests)`);
    return;
  }

  const casesDir = join(modulePath, "cases");
  if (!existsSync(casesDir)) {
    issues.push({ module, message: "diretório cases/ ausente" });
    return;
  }

  const caseFiles = readdirSync(casesDir).filter((f) => f.endsWith(".md"));
  if (caseFiles.length === 0) {
    issues.push({ module, message: "nenhum caso encontrado em cases/" });
    return;
  }

  // Confere total_cases declarado.
  if (typeof manifest.total_cases === "number" && manifest.total_cases !== caseFiles.length) {
    issues.push({
      module,
      message: `total_cases declarado=${manifest.total_cases}, encontrados=${caseFiles.length}`,
    });
  }

  // Conta source_mode e outcome por case.
  const sourceCount: Record<string, number> = { real: 0, synthetic: 0, edge: 0, adversarial: 0 };
  const outcomeCount: Record<string, number> = {};

  for (const fileName of caseFiles) {
    const filePath = join(casesDir, fileName);
    const raw = readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(raw);

    if (!fm) {
      issues.push({ module, file: fileName, message: "sem frontmatter YAML válido" });
      continue;
    }

    const parsed = CaseFrontmatterSchema.safeParse(fm);
    if (!parsed.success) {
      issues.push({
        module,
        file: fileName,
        message: `frontmatter inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      });
      continue;
    }

    // Cross-checks
    if (parsed.data.module !== module) {
      issues.push({
        module,
        file: fileName,
        message: `module="${parsed.data.module}" não bate com diretório`,
      });
    }
    if (!manifest.outcomes.includes(parsed.data.outcome)) {
      issues.push({
        module,
        file: fileName,
        message: `outcome="${parsed.data.outcome}" não listado em manifest.outcomes`,
      });
    }

    sourceCount[parsed.data.source_mode] = (sourceCount[parsed.data.source_mode] ?? 0) + 1;
    outcomeCount[parsed.data.outcome] = (outcomeCount[parsed.data.outcome] ?? 0) + 1;
  }

  // Confere min_cases_per_outcome.
  if (typeof manifest.min_cases_per_outcome === "number") {
    for (const outcome of manifest.outcomes) {
      const count = outcomeCount[outcome] ?? 0;
      if (count < manifest.min_cases_per_outcome) {
        issues.push({
          module,
          message: `outcome "${outcome}" tem ${count} cases; manifest exige >= ${manifest.min_cases_per_outcome}`,
        });
      }
    }
  }

  // Source distribution — somente WARNING (não bloqueia CI).
  // Targets vêm da Foundry (real≥0.40, edge≥0.10, adversarial≥0.10); manifests podem
  // declarar override. Aqui apenas reportamos para o operador agir manualmente.
  const totalCases = caseFiles.length;
  const real = (sourceCount.real ?? 0) / totalCases;
  const edge = (sourceCount.edge ?? 0) / totalCases;
  const adversarial = (sourceCount.adversarial ?? 0) / totalCases;

  const warnings: string[] = [];
  if (real < 0.4) warnings.push(`real=${(real * 100).toFixed(0)}% <40%`);
  if (edge < 0.1) warnings.push(`edge=${(edge * 100).toFixed(0)}% <10%`);
  if (adversarial < 0.1) warnings.push(`adversarial=${(adversarial * 100).toFixed(0)}% <10%`);
  if (warnings.length > 0) {
    console.warn(`  ⚠ ${module} distribuição abaixo do alvo: ${warnings.join(", ")}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Entrypoint

function main(): void {
  const modules = listModules();
  if (modules.length === 0) {
    // Sem evals ainda — saída amigável (não falha CI por ausência).
    console.log(`[eval-run] Nenhum módulo encontrado em ${EVALS_ROOT}/`);
    return;
  }

  console.log(`[eval-run] Validando ${modules.length} módulos em evals/`);
  const issues: ValidationIssue[] = [];

  for (const module of modules) {
    validateModule(module, issues);
  }

  if (issues.length === 0) {
    console.log(`[eval-run] OK — ${modules.length} módulos passaram na validação estrutural.`);
    for (const m of modules) {
      const casesDir = join(EVALS_ROOT, m, "cases");
      const count = existsSync(casesDir) ? readdirSync(casesDir).filter((f) => f.endsWith(".md")).length : 0;
      console.log(`  - ${m}: ${count} cases`);
    }
    return;
  }

  console.error(`[eval-run] FALHA — ${issues.length} problema(s) encontrado(s):`);
  for (const issue of issues) {
    const where = issue.file ? `${issue.module}/${issue.file}` : issue.module;
    console.error(`  [${where}] ${issue.message}`);
  }
  process.exit(1);
}

main();
