import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CaseFile, CaseFrontmatter, ClassificationGroundTruth, ClassificationInput, SourceMode } from "./types.js";

const EVALS_ROOT = resolve(process.cwd(), "evals");

const SOURCE_MODES = new Set<SourceMode>(["real", "synthetic", "edge", "adversarial"]);

export function loadCases(module: string): CaseFile[] {
  const casesDir = join(EVALS_ROOT, module, "cases");
  if (!existsSync(casesDir)) {
    throw new Error(`Diretório de cases ausente: ${casesDir}`);
  }

  const files = readdirSync(casesDir).filter((f) => f.endsWith(".md")).sort();
  return files.map((name) => {
    const filePath = join(casesDir, name);
    const raw = readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(raw);
    if (!fm) throw new Error(`Frontmatter ausente em ${filePath}`);
    const meta = coerceFrontmatter(fm, filePath);
    return { ...meta, filePath, body: stripFrontmatter(raw) };
  });
}

function parseFrontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match || !match[1]) return null;

  const obj: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    obj[key] = value;
  }
  return obj;
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

function coerceFrontmatter(fm: Record<string, string>, filePath: string): CaseFrontmatter {
  const caseId = fm.case_id;
  const module = fm.module;
  const outcome = fm.outcome;
  const sourceMode = fm.source_mode as SourceMode;
  if (!caseId || !module || !outcome || !sourceMode) {
    throw new Error(`Frontmatter incompleto em ${filePath}: requer case_id, module, outcome, source_mode`);
  }
  if (!SOURCE_MODES.has(sourceMode)) {
    throw new Error(`source_mode inválido "${sourceMode}" em ${filePath}`);
  }
  return {
    caseId,
    module,
    outcome,
    sourceMode,
    priority: fm.priority,
    createdAt: fm.created_at,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Classification-specific parsing

const FIELD_RX = /^- `(\w+)`:\s*(.+?)\s*$/;

export interface ParsedClassificationCase {
  meta: CaseFile;
  input: ClassificationInput;
  groundTruth: ClassificationGroundTruth;
}

export function parseClassificationCase(file: CaseFile): ParsedClassificationCase {
  const input = parseInputBlock(file);
  const groundTruth = parseGroundTruthBlock(file);
  return { meta: file, input, groundTruth };
}

function parseInputBlock(file: CaseFile): ClassificationInput {
  // Pega a seção "## Input" até o próximo "##"
  const m = file.body.match(/##\s*Input[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  if (!m || !m[1]) throw new Error(`Sem bloco "## Input" em ${file.filePath}`);

  const fields: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const fm = line.match(FIELD_RX);
    if (!fm || !fm[1] || !fm[2]) continue;
    fields[fm[1]] = fm[2];
  }

  const description = unquote(fields.description ?? "");
  const direction = unquote(fields.direction ?? "");
  const date = unquote(fields.date ?? "");
  const amountCentsRaw = fields.amountCents ?? "";
  const amountCents = Number(amountCentsRaw);

  if (!description || !date || Number.isNaN(amountCents) || (direction !== "credit" && direction !== "debit")) {
    throw new Error(
      `Campos obrigatórios ausentes/inválidos em ${file.filePath}: ` +
      `description=${description}, date=${date}, amountCents=${amountCentsRaw}, direction=${direction}`,
    );
  }

  let tenantContext: Record<string, unknown> | undefined;
  if (fields.tenant_context) {
    tenantContext = parseInlineObject(fields.tenant_context);
  }

  return { description, direction, date, amountCents, tenantContext };
}

function parseGroundTruthBlock(file: CaseFile): ClassificationGroundTruth {
  // Pega a seção "## Ground truth" e dentro dela o bloco YAML
  const m = file.body.match(/##\s*Ground truth[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!m || !m[1]) throw new Error(`Sem bloco "## Ground truth" em ${file.filePath}`);

  const yamlMatch = m[1].match(/```yaml\s*\n([\s\S]*?)\n```/);
  const body = yamlMatch && yamlMatch[1] ? yamlMatch[1] : m[1];

  const fields: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    fields[key] = trimmed.slice(colon + 1).trim();
  }

  const expectedCategory = unquote(fields.expected_category ?? "");
  if (!expectedCategory) {
    throw new Error(`expected_category ausente em ${file.filePath}`);
  }

  const expectedConfidenceMin =
    fields.expected_confidence_min !== undefined ? Number(fields.expected_confidence_min) : undefined;
  const expectedConfidenceMax =
    fields.expected_confidence_max !== undefined ? Number(fields.expected_confidence_max) : undefined;

  const altsRaw = fields.acceptable_alternatives ?? "[]";
  const acceptableAlternatives = parseInlineStringArray(altsRaw);

  return { expectedCategory, expectedConfidenceMin, expectedConfidenceMax, acceptableAlternatives };
}

function unquote(s: string): string {
  const trimmed = s.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineStringArray(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === "[]" || trimmed === "") return [];
  const inner = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  return inner
    .split(",")
    .map((s) => unquote(s.trim()))
    .filter(Boolean);
}

function parseInlineObject(raw: string): Record<string, unknown> {
  // Aceita formato leve "{ key: value, key: "value" }" usado nos cases
  const trimmed = raw.trim().replace(/^\{|\}$/g, "");
  const out: Record<string, unknown> = {};
  for (const part of trimmed.split(",")) {
    const [k, ...rest] = part.split(":");
    if (!k || rest.length === 0) continue;
    out[k.trim()] = unquote(rest.join(":").trim());
  }
  return out;
}
