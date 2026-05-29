/**
 * seed-synthetic-profiles.ts
 *
 * Gera 2 perfis sintéticos de tenant no staging e dispara 10 análises LangGraph
 * para cada um — completando a Rota B de Synthetic pre-validation (ADR-013).
 *
 * Uso:
 *   DATABASE_URL="<staging>" REDIS_URL="<staging>" npx tsx scripts/seed-synthetic-profiles.ts
 *
 * Perfil B — Varejo pequeno (R$ 80k/mês, alto volume NF, margem baixa)
 * Perfil C — Prestadora de serviços (R$ 120k/mês irregular, pro-labore alto)
 */

import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import { Queue } from "bullmq";

// ─── Configuração ────────────────────────────────────────────────────────────

const MONTHS = [
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05",
  "2025-06", "2025-07", "2025-08", "2025-09", "2025-10",
];

const PROFILES = [
  {
    tenantId: "synthetic-varejo-pequeno-b1",
    name: "Varejo Pequeno SP (Perfil B — Sintético)",
    industrySegment: "varejo",
    taxRegime: "simples",
    description: "Loja de material de construção, faturamento ~R$ 80k/mês, alta rotatividade de NF, CPV elevado",
  },
  {
    tenantId: "synthetic-consultoria-ti-c1",
    name: "Consultoria TI SP (Perfil C — Sintético)",
    industrySegment: "servicos-b2b",
    taxRegime: "lucro-presumido",
    description: "Empresa de TI/consultoria, faturamento ~R$ 120k/mês irregular, pro-labore alto, poucos lançamentos",
  },
];

// ─── Gerador de lançamentos por perfil ───────────────────────────────────────

type Entry = {
  date: string;
  description: string;
  amountCents: number;
  direction: "credit" | "debit";
};

function day(month: string, d: number): string {
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** Variação sazonal: jan/fev mais fraco, mai-ago pico, dez forte */
function sazonalFactor(month: string): number {
  const m = parseInt(month.split("-")[1]!, 10);
  const table: Record<number, number> = {
    1: 0.75, 2: 0.80, 3: 0.90, 4: 0.95,
    5: 1.05, 6: 1.10, 7: 1.15, 8: 1.10,
    9: 0.95, 10: 1.00, 11: 1.05, 12: 1.20,
  };
  return table[m] ?? 1.0;
}

/** Perfil B — Varejo pequeno: ~60 lançamentos/mês, CPV alto, muitas vendas pequenas */
function gerarPerfilVarejo(month: string): Entry[] {
  const fator = sazonalFactor(month);
  const entries: Entry[] = [];

  // Receita: 40–60 vendas pequenas ao longo do mês (~R$ 1.5k cada em média)
  const numVendas = Math.round(45 * fator);
  for (let i = 0; i < numVendas; i++) {
    const d = 1 + Math.floor(i * 28 / numVendas);
    const valor = Math.round((80000 + Math.random() * 100000) * fator / numVendas);
    entries.push({
      date: day(month, Math.min(d, 28)),
      description: `NF ${1001 + i} — Venda balcão cliente`,
      amountCents: valor,
      direction: "credit",
    });
  }

  // CPV: 45% da receita bruta (compras de estoque, 3 fornecedores)
  const receitaTotal = entries.reduce((s, e) => s + e.amountCents, 0);
  const cpvTotal = Math.round(receitaTotal * 0.45);
  entries.push(
    { date: day(month, 5),  description: "Compra estoque — Fornecedor Construtora A",    amountCents: Math.round(cpvTotal * 0.40), direction: "debit" },
    { date: day(month, 12), description: "Compra estoque — Distribuidora B materiais",   amountCents: Math.round(cpvTotal * 0.35), direction: "debit" },
    { date: day(month, 22), description: "Compra estoque — Fornecedor C reposição",      amountCents: Math.round(cpvTotal * 0.25), direction: "debit" },
  );

  // Pessoal: 2 vendedores + 1 estoquista (~R$ 12k total)
  entries.push(
    { date: day(month, 5),  description: "Salário vendedor João", amountCents: 350000, direction: "debit" },
    { date: day(month, 5),  description: "Salário vendedor Maria", amountCents: 320000, direction: "debit" },
    { date: day(month, 5),  description: "Salário estoquista Carlos", amountCents: 280000, direction: "debit" },
    { date: day(month, 5),  description: "FGTS + INSS funcionários", amountCents: 140000, direction: "debit" },
    { date: day(month, 5),  description: "Vale refeição equipe", amountCents: 60000, direction: "debit" },
  );

  // Pró-labore do sócio
  entries.push({ date: day(month, 10), description: "Pró-labore sócio administrador", amountCents: 800000, direction: "debit" });

  // Despesas administrativas
  entries.push(
    { date: day(month, 1),  description: "Aluguel loja comercial", amountCents: 450000, direction: "debit" },
    { date: day(month, 1),  description: "Condomínio + IPTU rateio", amountCents: 80000, direction: "debit" },
    { date: day(month, 15), description: "Conta luz loja", amountCents: 55000, direction: "debit" },
    { date: day(month, 15), description: "Telefone + internet", amountCents: 25000, direction: "debit" },
    { date: day(month, 20), description: "Material de escritório", amountCents: 18000, direction: "debit" },
  );

  // Impostos: Simples Nacional (~8% da receita)
  entries.push({
    date: day(month, 20),
    description: "DAS Simples Nacional",
    amountCents: Math.round(receitaTotal * 0.08),
    direction: "debit",
  });

  // Despesas financeiras
  entries.push(
    { date: day(month, 10), description: "Tarifas bancárias Banco X", amountCents: 9500, direction: "debit" },
    { date: day(month, 28), description: "IOF maquininha cartão crédito", amountCents: 22000, direction: "debit" },
  );

  // Despesas comerciais (anúncios, panfletos)
  if (fator >= 1.0) {
    entries.push({ date: day(month, 8), description: "Google Ads loja", amountCents: 45000, direction: "debit" });
  }

  return entries;
}

/** Perfil C — Consultoria TI: ~20 lançamentos/mês, receita irregular, pro-labore alto */
function gerarPerfilConsultoria(month: string): Entry[] {
  const fator = sazonalFactor(month);
  const entries: Entry[] = [];

  // Receita: 2–4 clientes grandes, pagamento irregular
  const clientes = [
    { nome: "Contrato cliente Alpha — consultoria mensal", base: 4500000 },
    { nome: "Projeto Beta — milestone entregue",           base: 3200000 },
  ];
  if (fator >= 1.0) {
    clientes.push({ nome: "Contrato cliente Gamma — suporte avulso", base: 1800000 });
  }
  if (fator >= 1.1) {
    clientes.push({ nome: "Novo contrato Delta — kick-off", base: 2500000 });
  }

  clientes.forEach((c, i) => {
    const variacao = 0.85 + Math.random() * 0.30;
    entries.push({
      date: day(month, [5, 12, 18, 25][i % 4]!),
      description: c.nome,
      amountCents: Math.round(c.base * fator * variacao),
      direction: "credit",
    });
  });

  // Pró-labore: 3 sócios (~R$ 25k total — alto vs. receita)
  entries.push(
    { date: day(month, 5), description: "Pró-labore sócio-diretor Rafael", amountCents: 1200000, direction: "debit" },
    { date: day(month, 5), description: "Pró-labore sócia-diretora Ana",   amountCents: 900000,  direction: "debit" },
    { date: day(month, 5), description: "Pró-labore sócio técnico Paulo",  amountCents: 800000,  direction: "debit" },
  );

  // Custo de serviços: freelancers / subcontratados
  const receitaTotal = entries.filter(e => e.direction === "credit").reduce((s, e) => s + e.amountCents, 0);
  if (receitaTotal > 0) {
    entries.push({
      date: day(month, 15),
      description: "Freelancer dev — horas projeto Beta",
      amountCents: Math.round(receitaTotal * 0.12),
      direction: "debit",
    });
  }

  // TI (serviços essenciais para consultoria de TI)
  entries.push(
    { date: day(month, 1),  description: "AWS cloud — ambientes cliente",    amountCents: 380000, direction: "debit" },
    { date: day(month, 1),  description: "GitHub Enterprise + ferramentas",  amountCents: 85000,  direction: "debit" },
    { date: day(month, 1),  description: "Google Workspace Business",        amountCents: 32000,  direction: "debit" },
    { date: day(month, 1),  description: "Slack Pro + Zoom Pro",             amountCents: 28000,  direction: "debit" },
    { date: day(month, 15), description: "Linear + Figma SaaS",              amountCents: 24000,  direction: "debit" },
  );

  // Administrativas (home-office + coworking esporádico)
  entries.push(
    { date: day(month, 1),  description: "Coworking — 10 dias escritório", amountCents: 180000, direction: "debit" },
    { date: day(month, 1),  description: "Serviços contábeis mensais",     amountCents: 150000, direction: "debit" },
    { date: day(month, 20), description: "Plano saúde sócios",             amountCents: 220000, direction: "debit" },
  );

  // Impostos: Lucro Presumido (~13.33% de IRPJ+CSLL sobre receita + ISS 5%)
  if (receitaTotal > 0) {
    entries.push(
      {
        date: day(month, 25),
        description: "IRPJ + CSLL Lucro Presumido trimestral (rateio mensal)",
        amountCents: Math.round(receitaTotal * 0.075),
        direction: "debit",
      },
      {
        date: day(month, 25),
        description: "ISS retido na fonte clientes",
        amountCents: Math.round(receitaTotal * 0.05),
        direction: "debit",
      },
      {
        date: day(month, 25),
        description: "PIS + COFINS Lucro Presumido",
        amountCents: Math.round(receitaTotal * 0.0365),
        direction: "debit",
      },
    );
  }

  // Viagem esporádica (presente em meses de pico)
  if (fator >= 1.05) {
    entries.push(
      { date: day(month, 10), description: "Passagem aérea — visita cliente Gamma SP/RJ", amountCents: 68000, direction: "debit" },
      { date: day(month, 11), description: "Hotel + refeições viagem negócios",           amountCents: 45000, direction: "debit" },
    );
  }

  return entries;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

  if (!dbUrl) {
    console.error("❌  DATABASE_URL não definida. Rode com:");
    console.error('   DATABASE_URL="<staging>" REDIS_URL="<staging>" npx tsx scripts/seed-synthetic-profiles.ts');
    process.exit(1);
  }

  if (!dbUrl.includes("zephyr") && !dbUrl.includes("staging")) {
    console.error("⚠️  DATABASE_URL não parece apontar para staging. Abortando por segurança.");
    console.error("   URL recebida:", dbUrl.replace(/:\/\/[^@]+@/, "://<redacted>@"));
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const isRailwayInternal = redisUrl.includes(".railway.internal");
  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    ...(isRailwayInternal ? { family: 6 } : {}),
  });
  const queue = new Queue<{ analysisId: string; tenantId: string }>("monthly-analysis-graph", { connection: redis });

  const results: Array<{ tenantId: string; month: string; analysisId: string }> = [];

  for (const profile of PROFILES) {
    console.log(`\n📦  Criando perfil: ${profile.name}`);

    // Upsert Tenant
    await prisma.tenant.upsert({
      where: { id: profile.tenantId },
      create: {
        id: profile.tenantId,
        name: profile.name,
        industrySegment: profile.industrySegment,
        taxRegime: profile.taxRegime,
        productConfig: {
          monthlyAnalysis: { orchestrator: "langgraph", toneOfVoice: "formal" },
        },
      },
      update: {
        name: profile.name,
        industrySegment: profile.industrySegment,
        taxRegime: profile.taxRegime,
        productConfig: {
          monthlyAnalysis: { orchestrator: "langgraph", toneOfVoice: "formal" },
        },
      },
    });

    // Upsert Subscription (mode=shadow para não cobrar)
    await prisma.subscription.upsert({
      where: { tenantId: profile.tenantId },
      create: {
        tenantId: profile.tenantId,
        plan: "trial",
        mode: "shadow",
        status: "active",
      },
      update: {
        mode: "shadow",
        status: "active",
      },
    });

    console.log(`   ✓ Tenant + Subscription criados`);

    // Para cada mês: gerar LedgerEntries + criar MonthlyAnalysis + enfileirar
    for (const month of MONTHS) {
      const entries = profile.industrySegment === "varejo"
        ? gerarPerfilVarejo(month)
        : gerarPerfilConsultoria(month);

      // Limpar análise anterior se existir
      const existing = await prisma.monthlyAnalysis.findUnique({
        where: { tenantId_referenceMonth: { tenantId: profile.tenantId, referenceMonth: month } },
      });
      if (existing) {
        await prisma.ledgerEntry.deleteMany({ where: { analysisId: existing.id } });
        await prisma.narrativeCard.deleteMany({ where: { analysisId: existing.id } });
        await prisma.actionPlanItem.deleteMany({ where: { analysisId: existing.id } });
        await prisma.monthlyAnalysis.delete({ where: { id: existing.id } });
      }

      // Criar análise
      const analysis = await prisma.monthlyAnalysis.create({
        data: {
          tenantId: profile.tenantId,
          referenceMonth: month,
          status: "generating",
          mode: "shadow",
        },
      });

      // Bulk insert lançamentos
      await prisma.ledgerEntry.createMany({
        data: entries.map(e => ({
          tenantId: profile.tenantId,
          analysisId: analysis.id,
          date: new Date(`${e.date}T12:00:00Z`),
          description: e.description,
          amountCents: e.amountCents,
          direction: e.direction === "credit" ? "credit" : "debit",
        })),
      });

      // Enfileirar job LangGraph
      await queue.add(
        "monthly-analysis-graph",
        { analysisId: analysis.id, tenantId: profile.tenantId },
        { attempts: 3, backoff: { type: "exponential", delay: 10000 } },
      );

      results.push({ tenantId: profile.tenantId, month, analysisId: analysis.id });
      console.log(`   ✓ ${month} — ${entries.length} lançamentos — analysisId: ${analysis.id}`);
    }
  }

  await queue.close();
  await redis.quit();
  await prisma.$disconnect();

  console.log("\n✅  Seed concluído. Resumo:");
  console.log(`   ${PROFILES.length} tenants × ${MONTHS.length} meses = ${results.length} análises enfileiradas`);
  console.log("\n   Monitore com:");
  console.log(`   psql $DATABASE_URL -c "SELECT r.\"tenantId\", r.\"referenceMonth\", r.status FROM \"MonthlyAnalysis\" r WHERE r.\"tenantId\" IN ('${PROFILES.map(p => p.tenantId).join("','")}') ORDER BY r.\"tenantId\", r.\"referenceMonth\""`);

  // Salvar IDs para relatório
  console.log("\n   Analysis IDs gerados:");
  results.forEach(r => console.log(`   ${r.tenantId} / ${r.month} → ${r.analysisId}`));
}

main().catch(err => {
  console.error("❌  Erro fatal:", err);
  process.exit(1);
});
