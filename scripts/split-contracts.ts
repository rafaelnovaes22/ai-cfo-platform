import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

interface OpenApiSpec {
  openapi: string;
  info: Record<string, unknown>;
  servers?: unknown[];
  components?: Record<string, unknown>;
  paths: Record<string, unknown>;
}

const spec = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), "docs", "contracts", "aicfo.openapi.json"),
    "utf-8"
  )
) as OpenApiSpec;

const moduleRules: Array<{ key: string; title: string; predicate: (p: string) => boolean }> = [
  {
    key: "auth-tenant",
    title: "Auth & Tenant",
    predicate: (p) =>
      p.startsWith("/auth/"),
  },
  {
    key: "workspace-setup",
    title: "Workspace Setup",
    predicate: (p) => p.startsWith("/workspace/"),
  },
  {
    key: "billing",
    title: "Billing & Payments",
    predicate: (p) => p.startsWith("/billing/"),
  },
  {
    key: "tenant-config",
    title: "Tenant Configuration",
    predicate: (p) =>
      p.startsWith("/config") && !p.startsWith("/config/whatsapp"),
  },
  {
    key: "ingest",
    title: "Ingest",
    predicate: (p) => p.startsWith("/ingest/"),
  },
  {
    key: "classification",
    title: "Classification",
    predicate: (p) => p.startsWith("/classification/"),
  },
  {
    key: "dre-narrative",
    title: "DRE & Narrative",
    predicate: (p) =>
      p.startsWith("/analysis/{analysisId}/dre") ||
      p.startsWith("/analysis/{analysisId}/narrative") ||
      p.startsWith("/analyses") ||
      p === "/analysis/{analysisId}/status" ||
      p === "/analysis/{analysisId}/approve" ||
      p === "/analysis/{analysisId}/retry",
  },
  {
    key: "action-plan",
    title: "Action Plan",
    predicate: (p) => p.startsWith("/analysis/{analysisId}/action-plan"),
  },
  {
    key: "hub",
    title: "Hub",
    predicate: (p) => p === "/hub",
  },
  {
    key: "export",
    title: "Export",
    predicate: (p) => p.startsWith("/analysis/{analysisId}/export/"),
  },
  {
    key: "cashflow",
    title: "Cashflow",
    predicate: (p) => p.startsWith("/cashflow"),
  },
  {
    key: "whatsapp-channel",
    title: "WhatsApp Channel",
    predicate: (p) =>
      p.startsWith("/config/whatsapp") ||
      p.startsWith("/whatsapp/") ||
      p.startsWith("/webhooks/whatsapp"),
  },
];

const outDir = path.resolve(process.cwd(), "docs", "contracts");
mkdirSync(outDir, { recursive: true });

for (const rule of moduleRules) {
  const yamlPath = path.join(outDir, `${rule.key}.openapi.yml`);

  // Não sobrescreve contratos manuais já existentes (ex: whatsapp-channel).
  if (existsSync(yamlPath)) {
    // eslint-disable-next-line no-console
    console.log(`Skipped ${yamlPath} (already exists)`);
    continue;
  }

  const paths: Record<string, unknown> = {};
  for (const [pathKey, pathValue] of Object.entries(spec.paths)) {
    if (rule.predicate(pathKey)) {
      paths[pathKey] = pathValue;
    }
  }

  if (Object.keys(paths).length === 0) continue;

  const moduleSpec = {
    openapi: spec.openapi,
    info: {
      ...spec.info,
      title: `${rule.title} — Aicfo API`,
      description: `Contract for the ${rule.key} module. Extracted from the canonical Aicfo OpenAPI spec.`,
    },
    servers: spec.servers,
    paths,
    components: {
      securitySchemes: spec.components?.securitySchemes,
    },
  };

  writeFileSync(yamlPath, yaml.dump(moduleSpec, { noRefs: true, lineWidth: 120 }));
  // eslint-disable-next-line no-console
  console.log(`Generated ${yamlPath} (${Object.keys(paths).length} paths)`);
}
