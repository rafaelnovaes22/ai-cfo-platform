#!/usr/bin/env node
// Gera stubs iniciais para os 30 módulos do Aicfo em docs/specs/.
// Rodar: node scripts/generate-module-stubs.mjs
// Idempotente: NÃO sobrescreve arquivo já existente (assume detalhamento manual posterior).

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = join(__dirname, "..", "docs", "specs");

if (!existsSync(SPECS_DIR)) mkdirSync(SPECS_DIR, { recursive: true });

const modules = [
  // Onda 0 — Fundação (Tier C)
  {
    key: "auth-tenant", name: "Autenticação Multi-Tenant", wave: 0, tier: "C",
    desc: "Login, sessão, JWT, isolamento de tenant. Camada de segurança transversal a todos os módulos.",
    outcomes: [
      "`user_authenticated`: usuário loga com sucesso (email+senha, futuramente SSO)",
      "`tenant_resolved`: JWT contém claim `tenant_id` válido em toda request",
      "`session_refreshed`: refresh token funcionando",
    ],
    features: "(transversal — segurança)",
  },
  {
    key: "workspace-setup", name: "Workspace Setup", wave: 0, tier: "C",
    desc: "Onboarding pós-cadastro: configurar empresa (nome, segmento, regime tributário, equipe). Define o L1 do tenant.",
    outcomes: [
      "`workspace_created`: empresa configurada com campos mínimos preenchidos",
      "`segment_set`: segmento de mercado definido (afeta personalização)",
      "`team_invited`: convites enviados a colaboradores",
    ],
    features: "#42",
  },
  {
    key: "billing", name: "Billing (Stripe)", wave: 0, tier: "C",
    desc: "Cobrança self-serve via Stripe — planos Lite/Pro/Business, invoices, upgrades/downgrades, webhook de pagamento.",
    outcomes: [
      "`subscription_started`: plano ativo, cobrança recorrente configurada",
      "`payment_processed`: invoice paga, sem dunning",
      "`plan_changed`: upgrade/downgrade efetivado",
    ],
    features: "(modelo SaaS²)",
  },
  {
    key: "tenant-config", name: "Tenant Config & Permissões", wave: 0, tier: "C",
    desc: "Settings do tenant: perfil, membros, permissões (RBAC), tokens de API. Camada de controle de acesso.",
    outcomes: [
      "`config_updated`: settings persistidas com validação",
      "`role_assigned`: permissão atribuída a usuário",
      "`api_token_issued`: token de API gerado com escopo definido",
    ],
    features: "#50",
  },

  // Onda 1 — SKU Piloto monthly-analysis (Tier B)
  {
    key: "ingest", name: "Ingest — Parsers de Lançamentos", wave: 1, tier: "B",
    desc: "Recebe lançamentos do cliente em 4 formatos: planilha colada (clipboard), PDF do contador (OCR + tabela), Excel/CSV (xlsx, xls, csv), formulário manual. Output: `RawLedger[]`.",
    outcomes: [
      "`ingest_completed`: ≥50 lançamentos extraídos com shape válido",
      "`ingest_partial`: <50 ou linhas órfãs detectadas, retorna pra revisão manual",
      "`ingest_failed`: formato não reconhecido ou arquivo corrompido",
    ],
    features: "(input layer SKU piloto)",
  },
  {
    key: "classification", name: "Classification — Categorização DRE", wave: 1, tier: "B",
    desc: "Classifica cada lançamento em categoria DRE (~25 categorias padrão) usando Sonnet 4.6 com prompt cache + few-shot. Aprendizado contínuo via correções do cliente alimentando RAG store.",
    outcomes: [
      "`ledger_classified`: cada lançamento com categoria + confidence score",
      "`classification_confidence_low`: confidence <0.7, sinaliza pra revisão",
      "`taxonomy_drift_detected`: detectou padrão recorrente sem categoria — sugere expansão da taxonomia",
    ],
    features: "#6, #7",
  },
  {
    key: "dre-narrative", name: "DRE Narrative — Narrador da DRE", wave: 1, tier: "B",
    desc: 'Agrega lançamentos classificados em DRE Facilitado. Gera 3 cards de "Leitura da história" (Gargalo crítico / Atenção / Saudável), cada um com causa identificada + evidência numérica + cor visual.',
    outcomes: [
      "`dre_aggregated`: DRE com todas as linhas calculadas (Receita Bruta → Lucro Líquido)",
      "`narrative_generated`: 3 cards (1 por categoria) com texto + numbers",
      "`anomaly_flagged`: variação >X% vs. mês anterior gera card de gargalo",
    ],
    features: "#8, #14, #15",
  },
  {
    key: "action-plan", name: "Action Plan — Plano de Ação 3-horizontes", wave: 1, tier: "B",
    desc: "Gera plano de ação com 3 horizontes (curto: até 3m / médio: 3-6m / longo: >1 ano). Para cada ação: descrição, prazo, esforço, risco, impacto R$ estimado. Sonnet 4.6 + Opus 4.7 como fallback decisional.",
    outcomes: [
      "`plan_generated`: ≥3 ações curto + ≥1 médio + ≥1 longo, cada uma com impacto R$",
      "`action_executable`: cada ação tem critério de \"feita\" mensurável",
      "`impact_total_calculated`: soma de impacto R$/mês dos horizontes",
    ],
    features: "#13, #45, #46",
  },
  {
    key: "hub", name: "Hub — Home + Análises Anteriores", wave: 1, tier: "B",
    desc: 'Tela home pós-login. Mostra análise current (lucro líquido + tags "3 gargalos"/"Plano pronto"), lista de análises anteriores (até 12 meses), CTAs ("Ver DRE completo", "Iniciar nova análise").',
    outcomes: [
      "`hub_loaded`: home renderizada com snapshot da última análise",
      "`history_listed`: análises anteriores ordenadas por data ref",
      "`new_analysis_triggered`: cliente inicia nova análise",
    ],
    features: "#23",
  },
  {
    key: "export", name: "Export — Relatórios Exportáveis", wave: 1, tier: "B",
    desc: "Gera PDF/Excel da análise mensal em 3 sabores: Mensal (interno), Investidores (com KPIs comerciais), Sócios (focado em distribuição/dividendos).",
    outcomes: [
      "`report_exported_monthly`: PDF mensal gerado",
      "`report_exported_investors`: PDF investidores com KPIs (#24)",
      "`report_exported_partners`: PDF sócios com cálculo de distribuição",
    ],
    features: "#28, #29, #30",
  },

  // Onda 2 — Operação em Tempo Real
  {
    key: "cashflow", name: "Cashflow — Fluxo de Caixa em Tempo Real + Projeção", wave: 2, tier: "B",
    desc: "Visão diária do fluxo de caixa (saldo, entradas, saídas) atualizada em tempo real conforme integrações. Projeção 7/30/90 dias com cenários. Visualização de burn rate e runway.",
    outcomes: [
      "`cashflow_realtime_loaded`: dashboard com saldo current + delta diário",
      "`projection_generated`: 3 horizontes (7/30/90d) com 3 cenários (pessimista/base/agressivo)",
      "`runway_calculated`: meses de runway dado burn current",
    ],
    features: "#2, #3, #57",
  },
  {
    key: "kpis", name: "KPIs — Métricas Automáticas", wave: 2, tier: "B",
    desc: "Calcula KPIs financeiros em tempo real: CAC, LTV, payback, margem (bruta/contribuição/operacional/líquida), burn rate, runway. Atualização contínua.",
    outcomes: [
      "`kpis_calculated`: todos os KPIs current com tendência",
      "`kpi_alert`: KPI fora de threshold dispara alerta",
      "`kpi_history_persisted`: snapshot mensal pra benchmarking interno",
    ],
    features: "#24, #25, #47",
  },
  {
    key: "score", name: "Score — Score Financeiro da Empresa", wave: 2, tier: "B",
    desc: "Indicador único 0-100 que sintetiza saúde financeira (combinando margem, runway, inadimplência, crescimento, etc). Versão simplificada do CEO entender em 5s.",
    outcomes: [
      "`score_calculated`: score current com breakdown dos componentes",
      "`score_history`: evolução mensal",
      "`score_drop_alert`: queda relevante dispara incidente",
    ],
    features: "#40",
  },
  {
    key: "alerts", name: "Alerts — Alertas Proativos", wave: 2, tier: "B",
    desc: "Motor de alertas: ruptura de caixa próxima, queda de margem, burn elevado, metas não atingidas. Notificações in-app + email + (futuro) WhatsApp.",
    outcomes: [
      "`alert_triggered`: condição detectada, notificação enviada",
      "`alert_acknowledged`: cliente viu/marcou",
      "`goal_missed`: meta financeira não atingida no período",
    ],
    features: "#41, #56",
  },
  {
    key: "dashboard-ceo", name: "Dashboard CEO — Visão Executiva", wave: 2, tier: "B",
    desc: "Versão simplificada e refinada do hub: KPIs principais, alertas, score, runway. Otimizado para CEO que olha em 30s e decide. Suporte à decisão estratégica.",
    outcomes: [
      "`dashboard_loaded`: visão executiva renderizada",
      "`decision_supported`: cliente clica em ação recomendada (deeplink ao plano)",
    ],
    features: "#23, #58",
  },

  // Onda 3 — Inteligência
  {
    key: "decision-engine", name: "Decision Engine — Motor de Decisão Evoluído", wave: 3, tier: "B",
    desc: "Versão evoluída do action-plan piloto. Recomendações baseadas em comportamento histórico do tenant, padrões de empresas similares (benchmarking), e estado financeiro current.",
    outcomes: [
      "`recommendation_generated`: ação recomendada com evidência + alternativas",
      "`recommendation_personalized`: contexto do tenant considerado",
      "`recommendation_explained`: justificativa textual pro CEO",
    ],
    features: "#13 (evolução), #59",
  },
  {
    key: "scenarios", name: "Scenarios — Simuladores Dinâmicos", wave: 3, tier: "B",
    desc: "Simulador de impacto financeiro em decisões: contratação, investimento, corte, mudança de pricing. Gera 3 cenários (pessimista/base/agressivo) com projeção 12 meses.",
    outcomes: [
      "`scenario_simulated`: cenário com 3 variantes + delta vs. base",
      "`growth_simulated`: simulador de crescimento empresarial",
      "`cost_structure_simulated`: simulador de estrutura de custos",
    ],
    features: "#4, #5, #26, #27",
  },
  {
    key: "benchmarking", name: "Benchmarking — Histórico Interno + Setor", wave: 3, tier: "B",
    desc: "Compara métricas current vs. histórico interno (mês anterior, mesmo período ano passado) e vs. peers de segmento (quando houver base de dados ≥50 empresas).",
    outcomes: [
      "`benchmark_internal`: comparação histórica do próprio tenant",
      "`benchmark_segment`: comparação com média do segmento (anonymized)",
      "`benchmark_quartile`: posição do tenant no quartil do segmento",
    ],
    features: "#48, #49",
  },
  {
    key: "conversational-agent", name: "Conversational Agent — Copiloto NL", wave: 3, tier: "B",
    desc: 'Agente conversacional que responde perguntas em linguagem natural sobre os dados financeiros do tenant. Ex: "Quanto gastei em marketing nos últimos 3 meses?". Usa RAG sobre dados do tenant + DRE narrativa + KPIs.',
    outcomes: [
      "`question_answered`: resposta gerada com fonte (link pra linha do DRE)",
      "`question_clarified`: pergunta ambígua → agente pede esclarecimento",
      "`question_out_of_scope`: pergunta fora do escopo financeiro → recusa elegante",
    ],
    features: "#31",
  },

  // Onda 4 — Conectividade
  {
    key: "integrations-banks", name: "Integrations — Bancos Multi-Conta", wave: 4, tier: "C",
    desc: "Conexão OAuth/Open Finance com bancos brasileiros (Itaú, BB, Santander, Nubank, Inter, etc). Sincroniza saldo + extrato em tempo real. Multi-conta por tenant.",
    outcomes: [
      "`bank_connected`: conta bancária autenticada e sincronizando",
      "`statement_synced`: extrato puxado, transações categorizadas",
      "`balance_updated`: saldo current atualizado em <5min",
    ],
    features: "#1 (parte), #21",
  },
  {
    key: "integrations-erp-crm-payroll", name: "Integrations — ERP + CRM + Folha", wave: 4, tier: "C",
    desc: "Conectores com ERPs (Omie, ContaAzul, Bling), CRMs (HubSpot, RD, Pipedrive) e sistemas de folha (Sólides, Convenia). Webhooks bidirecionais.",
    outcomes: [
      "`erp_connected`: ERP autenticado, sincronizando lançamentos",
      "`crm_pipeline_synced`: oportunidades trazidas pro forecast",
      "`payroll_imported`: folha importada como linha do DRE",
    ],
    features: "#1 (resto), #38, #39",
  },
  {
    key: "payment-execution", name: "Payment Execution — Pagamentos Automáticos", wave: 4, tier: "C",
    desc: "Execução automatizada de pagamentos via integração bancária (PIX, TED, boleto). Aprovação multi-stage por valor. Rastreabilidade total.",
    outcomes: [
      "`payment_scheduled`: pagamento agendado com aprovação registrada",
      "`payment_executed`: pagamento confirmado pelo banco",
      "`payment_failed`: erro reportado com causa raiz",
    ],
    features: "#22, #52",
  },
  {
    key: "revenue-forecast", name: "Revenue Forecast — Previsão de Faturamento", wave: 4, tier: "B",
    desc: "Previsão de faturamento baseada em histórico + pipeline de vendas (CRM). Correlação entre vendas futuras (probabilidade × ticket) e impacto no caixa projetado.",
    outcomes: [
      "`forecast_generated`: previsão 3/6/12 meses com intervalo de confiança",
      "`pipeline_correlated`: oportunidades CRM convertidas em projeção de receita",
      "`accuracy_measured`: comparação previsto vs. realizado mensal",
    ],
    features: "#37, #39",
  },

  // Onda 5 — Tributário
  {
    key: "tax-suite", name: "Tax Suite — Controle Tributário", wave: 5, tier: "B",
    desc: "Suite tributária: controle de impostos (DARFs, ISS, ICMS, etc), sugestão de regime ideal (Simples vs Presumido vs Real), alertas de risco fiscal, simulação de cenários tributários.",
    outcomes: [
      "`tax_obligation_tracked`: obrigação tributária identificada com vencimento",
      "`tax_regime_suggested`: análise de qual regime minimiza carga",
      "`tax_risk_flagged`: alerta de risco fiscal (substitution tributária, DAS atrasado, etc)",
      "`tax_scenario_simulated`: simulação cenários (mudança regime, mudança CNAE, etc)",
    ],
    features: "#34, #35, #36, #53",
  },

  // Onda 6 — Operacional Pesado
  {
    key: "accounts-management", name: "Accounts Management — AP + AR", wave: 6, tier: "B",
    desc: "Contas a pagar e a receber unificadas: gestão inteligente de pagamentos (priorização por relevância de fornecedor), gestão de recebíveis com previsão de inadimplência (modelo ML).",
    outcomes: [
      "`payable_prioritized`: ordem de pagamento sugerida (priorização inteligente)",
      "`receivable_aged`: aging de recebíveis com risco",
      "`default_predicted`: previsão de inadimplência por cliente (probabilidade)",
    ],
    features: "#17, #18, #19, #20",
  },
  {
    key: "bank-reconciliation", name: "Bank Reconciliation — Conciliação Bancária", wave: 6, tier: "C",
    desc: "Conciliação automática entre extrato bancário (módulo banks) e lançamentos contábeis. Casamento por valor + data + descrição (fuzzy). Tier C porque erros viram problema contábil.",
    outcomes: [
      "`transaction_reconciled`: lançamento casado com transação bancária",
      "`reconciliation_partial`: casamento parcial, requer revisão manual",
      "`reconciliation_drift`: divergência sustentada → alerta P1",
    ],
    features: "#9",
  },
  {
    key: "profitability", name: "Profitability — Rentabilidade Multi-Dimensão", wave: 6, tier: "B",
    desc: "Análise de rentabilidade por dimensão: cliente, produto/serviço, canal de vendas. Cruzamento com módulo CRM (Onda 4) e classificação (Onda 1). Margem de contribuição por dimensão.",
    outcomes: [
      "`profitability_by_customer`: ranking de rentabilidade por cliente",
      "`profitability_by_product`: ranking por produto/SKU",
      "`profitability_by_channel`: ranking por canal de vendas",
      "`unprofitable_flagged`: clientes/produtos com margem negativa",
    ],
    features: "#10, #11, #12",
  },

  // Onda 7 — Auditoria & Detecção
  {
    key: "anomaly-fraud-detection", name: "Anomaly & Fraud Detection", wave: 7, tier: "B",
    desc: "Detecção dedicada de anomalias estatísticas (variação >Nσ) e padrões de fraude/desvio (lançamentos duplicados, valores arredondados suspeitos, fornecedores recém-criados, etc).",
    outcomes: [
      "`anomaly_detected`: anomalia estatística sinalizada com evidência",
      "`fraud_pattern_flagged`: padrão suspeito detectado (Benford, duplicates, etc)",
      "`investigation_opened`: incidente formal aberto pra audit-governance",
    ],
    features: "#15 (versão dedicada), #16",
  },
  {
    key: "audit-governance", name: "Audit & Governance — Rastreabilidade Total", wave: 7, tier: "B",
    desc: "Logs completos de cada decisão da IA + cada ação humana sobre dados financeiros. Auditoria automatizada mensal com relatório. Rastreabilidade total ponta-a-ponta.",
    outcomes: [
      "`action_logged`: ação registrada no audit trail (humana ou IA)",
      "`audit_run_completed`: auditoria mensal executada com relatório",
      "`compliance_report_generated`: relatório de compliance pra solicitação externa",
    ],
    features: "#32, #33, #51",
  },

  // Onda 8 — Planejamento
  {
    key: "financial-planning", name: "Financial Planning — Anual + Orçamentário Dinâmico", wave: 8, tier: "B",
    desc: "Planejamento financeiro anual automatizado a partir do histórico + metas. Orçamentário com ajuste dinâmico ao longo do ano (mês fechado realimenta projeção).",
    outcomes: [
      "`annual_plan_generated`: planejamento anual com metas mensais",
      "`budget_adjusted`: orçamento ajustado em função do realizado",
      "`variance_analyzed`: análise mensal de orçado vs. realizado",
    ],
    features: "#54, #55",
  },
];

function buildSpec(m) {
  const outcomesBullets = m.outcomes.map((o) => `- ${o}`).join("\n");
  return `---
module_key: "${m.key}"
module_name: "${m.name}"
wave: ${m.wave}
tier: "${m.tier}"
status: "stub"
constitution_version: "0.2.0"
features_covered: "${m.features}"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# ${m.name}

> ${m.desc}

## Outcomes principais

${outcomesBullets}

## Features cobertas (das 60 do Aicfo)

Identificadores: ${m.features}

Mapeamento completo em [\`docs/product-vision.md\`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via \`/novais-digital:spec --module ${m.key}\` quando este módulo entrar em desenvolvimento (Onda ${m.wave}).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
`;
}

let written = 0, skipped = 0;
for (const mod of modules) {
  const path = join(SPECS_DIR, `${mod.key}.md`);
  if (existsSync(path)) {
    skipped++;
    continue;
  }
  writeFileSync(path, buildSpec(mod), "utf8");
  written++;
}

console.log(`✅ ${written} stubs criados em docs/specs/, ${skipped} já existiam (preservados).`);
console.log(`Total módulos: ${modules.length}`);
