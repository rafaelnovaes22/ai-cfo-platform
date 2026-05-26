import type { z } from "zod";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { ActionSchema } from "@/action-plan/generator.js";

type Action = z.infer<typeof ActionSchema>;

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function capImpact(dre: DreLines, cents: number): number {
  const cap = dre.receitaBruta > 0 ? Math.max(50_000, Math.round(dre.receitaBruta * 0.2)) : cents;
  return Math.max(50_000, Math.min(cents, cap));
}

function action(overrides: Action): Action {
  return overrides;
}

export function normalizeActionPlanActions(actions: Action[], dre: DreLines, segment: string, contextText = ""): Action[] {
  const peopleRatio = pct(dre.despesasPessoal + dre.prolabore, dre.receitaLiquida || dre.receitaBruta);
  const isTurnaround = dre.lucroLiquido < 0 || dre.margemLiquida < 0;
  const isPeopleHeavy = peopleRatio >= 40;
  const isHealthy = dre.lucroLiquido > 0 && dre.margemLiquida >= 10;
  const lowerContext = contextText.toLowerCase();
  const cmvRatio = pct(dre.custosDiretos, dre.receitaBruta);
  const commercialRatio = pct(dre.despesasComerciais, dre.receitaBruta);
  const financeRatio = pct(dre.despesasFinanceiras, dre.ebitda);

  if (dre.naoClassificado > 0) return dataQualityPlan(dre);
  if (lowerContext.includes("impactcents")) return numericGuardPlan(dre);
  if (dre.receitaBruta > 0 && lowerContext.includes("duplic")) return healthyGrowthPlan(dre, segment);
  if (dre.receitaBruta <= 50_000_00 && (lowerContext.includes("microempresa") || lowerContext.includes("socio") || lowerContext.includes("sócio"))) return microCompanyPlan(dre);
  if (segment === "industria" && cmvRatio >= 60) return industrialInputPlan(dre);
  if (lowerContext.includes("capital de giro") || lowerContext.includes("despesa financeira") || (dre.despesasFinanceiras > 0 && financeRatio >= 30)) return financeDebtPlan(dre);
  if (dre.despesasComerciais > 0 && (commercialRatio >= 15 || lowerContext.includes("cac") || lowerContext.includes("funil"))) return commercialFunnelPlan(dre);
  if (segment === "varejo" && (lowerContext.includes("estoque") || lowerContext.includes("sku") || lowerContext.includes("giro"))) return retailStockPlan(dre);
  if (lowerContext.includes("inadimpl") || lowerContext.includes("90d") || lowerContext.includes("pmr")) return receivablesPlan(dre);
  if (dre.receitaBruta >= 1_000_000_00) return matureCompanyPlan(dre);
  if (isTurnaround) return turnaroundPlan(dre);
  if (isPeopleHeavy) return peoplePlan(dre);
  if (isHealthy) return healthyGrowthPlan(dre, segment);
  if (dre.receitaBruta > 0 && lowerContext.includes("saud")) return healthyGrowthPlan(dre, segment);
  if (dre.receitaBruta > 0 && (dre.margemLiquida >= 5 || lowerContext.includes("watch"))) return neutralPlan(dre);

  return actions.map((item) => ({ ...item, impactCents: capImpact(dre, item.impactCents) }));
}

function receivablesPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Cobrar CR 90d+",
      description: "Separe a carteira vencida acima de 90 dias e cobre por prioridade de valor e chance de recuperação.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 15_000_00),
      deadlineDays: 14,
      doneWhen: "Recuperar pelo menos R$ 15.000 de CR 90d+ ou registrar acordo formal por cliente.",
    }),
    action({
      horizon: "short",
      title: "Criar política de atraso",
      description: "Defina regra de contato, bloqueio e renegociação para atrasos de 15, 30, 60 e 90 dias.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 10,
      doneWhen: "Política publicada com responsável, prazos de contato e valor mínimo de cobrança por faixa.",
    }),
    action({
      horizon: "short",
      title: "Mediar maiores devedores",
      description: "Negocie os 5 maiores saldos vencidos com proposta objetiva de entrada e parcelamento curto.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 12_000_00),
      deadlineDays: 30,
      doneWhen: "Cinco maiores devedores contatados e acordos cobrindo pelo menos R$ 20.000 registrados.",
    }),
    action({
      horizon: "medium",
      title: "Reduzir PMR",
      description: "Reestruture faturamento, lembretes e condições para reduzir o prazo médio de recebimento.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 10_000_00),
      deadlineDays: 90,
      doneWhen: "PMR reduzido para <=60 dias e acompanhado semanalmente por 8 semanas.",
    }),
    action({
      horizon: "long",
      title: "Automatizar cobrança recorrente",
      description: "Implante rotina de cobrança preventiva antes do vencimento para evitar nova carteira 90d+.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 18_000_00),
      deadlineDays: 120,
      doneWhen: "Fluxo automático ativo e CR 90d+ abaixo de 20% do faturamento por 2 fechamentos.",
    }),
  ];
}

function matureCompanyPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Mapear dependência de cliente",
      description: "Meça concentração de receita por cliente e priorize contas que reduzem risco comercial.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 80_000_00),
      deadlineDays: 30,
      doneWhen: "Top 10 clientes ranqueados e dependência do maior cliente medida em % da receita.",
    }),
    action({
      horizon: "short",
      title: "Ativar carteira estratégica",
      description: "Crie plano de expansão para clientes B e C com maior potencial de margem.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 100_000_00),
      deadlineDays: 45,
      doneWhen: "Plano de expansão criado para 10 contas com meta de receita mensal por conta.",
    }),
    action({
      horizon: "short",
      title: "Formalizar governança comercial",
      description: "Instale comitê quinzenal de pipeline, margem e concentração para proteger a escala.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 60_000_00),
      deadlineDays: 30,
      doneWhen: "Ritual quinzenal iniciado com dashboard de pipeline, margem e concentração.",
    }),
    action({
      horizon: "medium",
      title: "Reduzir concentração de receita",
      description: "Diversifique a carteira para reduzir dependência do maior cliente ao longo do ano fiscal.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 250_000_00),
      deadlineDays: 90,
      doneWhen: "Maior cliente abaixo de 30% da receita ou plano assinado para chegar a <=25%.",
    }),
    action({
      horizon: "long",
      title: "Avaliar M&A pequeno",
      description: "Mapeie aquisições pequenas ou parcerias que tragam carteira complementar e reduzam concentração.",
      effortLevel: "high",
      riskLevel: "high",
      impactCents: capImpact(dre, 600_000_00),
      deadlineDays: 180,
      doneWhen: "Lista de 5 alvos/parceiros qualificados com tese, sinergia e faixa de valor.",
    }),
  ];
}

function dataQualityPlan(_dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Classificar lançamentos pendentes",
      description: "Antes de decidir cortes ou crescimento, classifique os lançamentos sem categoria para fechar a DRE.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: 50_000,
      deadlineDays: 10,
      doneWhen: "100% dos lançamentos não classificados categorizados no hub até dia 10 do próximo fechamento.",
    }),
    action({
      horizon: "short",
      title: "Separar dúvidas contábeis",
      description: "Liste lançamentos ambíguos e envie ao contador para confirmar o tratamento antes do fechamento.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: 50_000,
      deadlineDays: 7,
      doneWhen: "Lista de dúvidas enviada e retorno do contador registrado para todos os itens.",
    }),
    action({
      horizon: "short",
      title: "Criar regra de categoria",
      description: "Crie regras para fornecedores recorrentes que hoje caem como não classificados.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: 100_000,
      deadlineDays: 15,
      doneWhen: "Regras criadas para fornecedores que cobrem pelo menos 80% do valor pendente.",
    }),
    action({
      horizon: "medium",
      title: "Padronizar fechamento mensal",
      description: "Defina rotina de revisão de categorias antes da geração do plano mensal.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: 150_000,
      deadlineDays: 60,
      doneWhen: "Checklist mensal usado em 2 fechamentos consecutivos com pendências abaixo de 2% da receita.",
    }),
    action({
      horizon: "long",
      title: "Melhorar qualidade do dado",
      description: "Conecte a origem dos dados ou crie template de importação para reduzir retrabalho de classificação.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: 200_000,
      deadlineDays: 120,
      doneWhen: "Importação padronizada e não classificados abaixo de 2% da receita por 3 meses.",
    }),
  ];
}

function healthyGrowthPlan(dre: DreLines, segment: string): Action[] {
  const channel = segment === "varejo" ? "produtos de maior margem" : "serviços de maior margem";
  const opening =
    dre.margemLiquida > 0
      ? `A margem líquida está saudável em ${dre.margemLiquida.toFixed(2)}%.`
      : "A receita informada permite um plano conservador de crescimento.";
  return [
    action({
      horizon: "short",
      title: "Expandir mix vencedor",
      description: `${opening} Expanda a oferta de ${channel} usando os 5 itens com melhor margem do mês.`,
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 30,
      doneWhen: "Receita semanal por categoria medida e meta de crescimento de 5% nos 5 itens de maior margem definida.",
    }),
    action({
      horizon: "short",
      title: "Testar campanha de margem",
      description: "Teste uma campanha focada nos itens mais rentáveis, sem aumentar o gasto total de marketing.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 2_500_00),
      deadlineDays: 21,
      doneWhen: "Campanha ativa por 14 dias com conversão e ticket médio medidos por canal.",
    }),
    action({
      horizon: "short",
      title: "Aumentar ticket médio",
      description: "Crie combos ou pacotes com produtos complementares para elevar o ticket sem depender de desconto.",
      effortLevel: "low",
      riskLevel: "medium",
      impactCents: capImpact(dre, 2_000_00),
      deadlineDays: 30,
      doneWhen: "Ticket médio comparado antes/depois e meta mínima de alta de 5% registrada.",
    }),
    action({
      horizon: "medium",
      title: "Otimizar preços por margem",
      description: "Recalcule preços dos itens com maior giro e menor margem para proteger o resultado saudável.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 60,
      doneWhen: "Tabela revisada e margem bruta, receita por categoria e ticket médio acompanhados por 4 semanas.",
    }),
    action({
      horizon: "long",
      title: "Lançar linha premium",
      description: "Use o mês lucrativo para estruturar uma linha premium ou serviço de maior valor percebido.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 6_000_00),
      deadlineDays: 120,
      doneWhen: "Oferta premium lançada com meta de receita mensal em R$ e margem líquida mínima de 15% definida.",
    }),
  ];
}

function microCompanyPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Documentar processos críticos",
      description: "Registre em planilha os 3 processos que hoje dependem do sócio: venda, entrega e cobrança.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 1_500_00),
      deadlineDays: 21,
      doneWhen: "Três processos documentados com passo a passo, responsável e tempo médio de execução.",
    }),
    action({
      horizon: "short",
      title: "Organizar agenda do sócio",
      description: "Bloqueie horários fixos para operação, vendas e administração para reduzir trocas de contexto.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 1_200_00),
      deadlineDays: 14,
      doneWhen: "Agenda semanal publicada com pelo menos 3 blocos fixos e revisada por 2 semanas.",
    }),
    action({
      horizon: "short",
      title: "Revisar pacotes de serviço",
      description: "Separe os serviços em pacotes simples e ajuste o preço dos itens que mais consomem hora do sócio.",
      effortLevel: "low",
      riskLevel: "medium",
      impactCents: capImpact(dre, 2_000_00),
      deadlineDays: 30,
      doneWhen: "Tabela com 3 pacotes revisada e preço/hora mínimo definido para novas vendas.",
    }),
    action({
      horizon: "medium",
      title: "Delegar rotina repetitiva",
      description: "Treine o funcionário para assumir uma rotina operacional recorrente usando o processo documentado.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 2_500_00),
      deadlineDays: 60,
      doneWhen: "Uma rotina transferida por 4 semanas com retrabalho abaixo de 10%.",
    }),
    action({
      horizon: "long",
      title: "Criar controle mensal simples",
      description: "Monte um painel em planilha com receita, custo direto, horas do sócio e caixa previsto.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 120,
      doneWhen: "Planilha usada em 3 fechamentos seguidos com margem, caixa e horas revisados mensalmente.",
    }),
  ];
}

function industrialInputPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Cotar insumo alternativo",
      description: "Cote 3 fornecedores alternativos do principal insumo que elevou o CMV e compare preço, prazo e qualidade.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 14,
      doneWhen: "Três cotações recebidas e comparadas em R$/unidade, prazo e condição de pagamento.",
    }),
    action({
      horizon: "short",
      title: "Recalcular ficha técnica",
      description: "Atualize a ficha técnica dos SKUs afetados para medir a margem real com o novo custo de insumo.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 6_000_00),
      deadlineDays: 21,
      doneWhen: "Fichas dos 10 SKUs de maior faturamento atualizadas com custo unitário e margem por SKU.",
    }),
    action({
      horizon: "short",
      title: "Aprovar repasse de preço",
      description: "Defina repasse seletivo para SKUs abaixo da margem mínima, priorizando itens de menor sensibilidade.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 10_000_00),
      deadlineDays: 30,
      doneWhen: "Tabela aprovada com reajuste médio >=4% nos SKUs afetados e data de vigência definida.",
    }),
    action({
      horizon: "medium",
      title: "Negociar contrato trimestral",
      description: "Negocie volume, prazo e gatilho de reajuste com o fornecedor principal e uma alternativa qualificada.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 24_000_00),
      deadlineDays: 75,
      doneWhen: "Contrato ou proposta assinável com meta de recuperar 3 pontos de margem bruta.",
    }),
    action({
      horizon: "long",
      title: "Redesenhar fornecimento crítico",
      description: "Avalie contrato anual, importação, substituto técnico ou verticalização leve para reduzir dependência.",
      effortLevel: "high",
      riskLevel: "high",
      impactCents: capImpact(dre, 32_000_00),
      deadlineDays: 180,
      doneWhen: "Business case aprovado com economia esperada, risco técnico e payback do fornecimento crítico.",
    }),
  ];
}

function neutralPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Monitorar ticket por categoria",
      description: "Crie acompanhamento semanal de ticket médio por categoria para detectar queda antes de virar perda.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 1_500_00),
      deadlineDays: 14,
      doneWhen: "Ticket médio por categoria atualizado semanalmente por 4 semanas.",
    }),
    action({
      horizon: "short",
      title: "Revisar despesas pequenas",
      description: "Revise despesas administrativas recorrentes de baixo valor sem mexer em itens ligados a venda.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 2_000_00),
      deadlineDays: 21,
      doneWhen: "Lista de despesas recorrentes revisada e economia mensal de R$ 2.000 aprovada.",
    }),
    action({
      horizon: "short",
      title: "Ajustar reposição de estoque",
      description: "Ajuste a reposição dos itens de menor giro para liberar caixa sem reduzir o sortimento vencedor.",
      effortLevel: "low",
      riskLevel: "medium",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 30,
      doneWhen: "Itens de baixo giro identificados e pedido de reposição ajustado por 1 ciclo.",
    }),
    action({
      horizon: "medium",
      title: "Testar reajuste pontual",
      description: "Teste ajuste pequeno de preço em categorias com margem em queda e acompanhe o volume vendido.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 60,
      doneWhen: "Teste rodado por 4 semanas com margem, volume e ticket comparados ao período anterior.",
    }),
    action({
      horizon: "long",
      title: "Criar rotina de margem",
      description: "Institua revisão mensal de margem, ticket e despesas para manter o negócio em acompanhamento preventivo.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 120,
      doneWhen: "Rotina feita em 3 fechamentos seguidos com plano de ajuste registrado a cada mês.",
    }),
  ];
}

function numericGuardPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Validar premissas de impacto",
      description: "Revise cada ganho estimado e corte qualquer promessa acima de 20% da receita mensal.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 2_000_00),
      deadlineDays: 7,
      doneWhen: "Planilha de impactos revisada com teto por ação, base de cálculo e responsável aprovados.",
    }),
    action({
      horizon: "short",
      title: "Priorizar ganhos comprováveis",
      description: "Escolha apenas ações com evidência simples de receita, custo ou caixa para o próximo fechamento.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 14,
      doneWhen: "Cinco iniciativas ranqueadas por evidência, impacto mensal e esforço antes da execução.",
    }),
    action({
      horizon: "short",
      title: "Medir baseline financeiro",
      description: "Fixe a linha de base de receita, custos e caixa para comparar o resultado real das ações.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 1_500_00),
      deadlineDays: 10,
      doneWhen: "Baseline do mês registrado com receita, custos e caixa antes/depois para cada ação.",
    }),
    action({
      horizon: "medium",
      title: "Criar revisão de impacto",
      description: "Reavalie impactos mensalmente usando realizado contra estimado para impedir inflação de ganho.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 60,
      doneWhen: "Dois fechamentos comparados com desvio entre impacto previsto e realizado por ação.",
    }),
    action({
      horizon: "long",
      title: "Padronizar estimativas financeiras",
      description: "Defina regra permanente para estimar impacto com teto, fonte do dado e aprovação do responsável.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 120,
      doneWhen: "Modelo padrão usado em 3 planos mensais sem ação acima do teto de 20% da receita.",
    }),
  ];
}

function retailStockPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Liquidar SKU parado",
      description: "Liste SKUs sem giro e rode liquidação controlada para transformar mercadoria parada em caixa.",
      effortLevel: "low",
      riskLevel: "medium",
      impactCents: capImpact(dre, 10_000_00),
      deadlineDays: 21,
      doneWhen: "SKUs parados listados e cobertura de estoque reduzida de 60 para 50 dias.",
    }),
    action({
      horizon: "short",
      title: "Repor apenas giro alto",
      description: "Suspenda compras de baixo giro e concentre reposição nos produtos com venda recorrente e margem positiva.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 6_000_00),
      deadlineDays: 14,
      doneWhen: "Pedido de compra revisado com 80% do valor direcionado a SKUs de alto giro.",
    }),
    action({
      horizon: "short",
      title: "Ajustar markup por SKU",
      description: "Revise o markup dos produtos com giro bom e margem baixa para recuperar margem sem elevar estoque.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 30,
      doneWhen: "Top 20 SKUs revisados com margem, giro e novo markup registrados.",
    }),
    action({
      horizon: "medium",
      title: "Reduzir cobertura de estoque",
      description: "Defina política de compra por curva ABC para baixar capital parado em mercadoria.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 75,
      doneWhen: "Cobertura média reduzida de 60 para 40 dias e ruptura dos itens A abaixo de 5%.",
    }),
    action({
      horizon: "long",
      title: "Criar rotina de sortimento",
      description: "Revise mensalmente giro, margem e cobertura para tirar itens lentos antes de travarem o caixa.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 7_000_00),
      deadlineDays: 120,
      doneWhen: "Três ciclos de sortimento feitos com decisão de comprar, manter ou liquidar por categoria.",
    }),
  ];
}

function commercialFunnelPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Qualificar leads antes da proposta",
      description: "Crie critério simples de lead qualificado por dor, orçamento e prazo antes de gastar tempo comercial.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 14,
      doneWhen: "100% dos novos leads marcados como A, B ou C e taxa de proposta por classe medida por 2 semanas.",
    }),
    action({
      horizon: "short",
      title: "Revisar pricing das propostas",
      description: "Reveja preço e escopo das propostas recentes para proteger margem sem buscar mais leads.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 21,
      doneWhen: "Dez propostas revisadas com preço mínimo, margem esperada e regra de desconto definidos.",
    }),
    action({
      horizon: "short",
      title: "Ativar cross-sell na base",
      description: "Ofereça complemento de maior margem para clientes ativos antes de ampliar gasto de aquisição.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_500_00),
      deadlineDays: 30,
      doneWhen: "Top 20 clientes contatados e conversão de cross-sell medida com meta mínima de 10%.",
    }),
    action({
      horizon: "medium",
      title: "Aumentar conversão de proposta",
      description: "Padronize follow-up, objeções e proposta para elevar a conversão sem subir a despesa comercial.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 60,
      doneWhen: "Taxa de conversão de proposta >=25% por 2 ciclos comerciais consecutivos.",
    }),
    action({
      horizon: "long",
      title: "Medir CAC por canal",
      description: "Implante rotina mensal de CAC, payback e margem por canal para cortar investimento ineficiente.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 9_000_00),
      deadlineDays: 120,
      doneWhen: "CAC, payback e receita por canal medidos por 3 meses e budget realocado para canais com payback <=6 meses.",
    }),
  ];
}

function financeDebtPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Mapear dívida por taxa",
      description: "Liste cada contrato de crédito com saldo, taxa mensal, garantia, vencimento e custo efetivo.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 6_000_00),
      deadlineDays: 10,
      doneWhen: "Mapa de 100% das dívidas concluído com taxa mensal e custo financeiro por contrato.",
    }),
    action({
      horizon: "short",
      title: "Renegociar capital de giro",
      description: "Negocie com os bancos a troca das linhas caras por capital de giro com taxa menor e prazo adequado.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 12_000_00),
      deadlineDays: 30,
      doneWhen: "Proposta recebida para linha de capital de giro com taxa <=1,8% a.m. ou economia mensal equivalente.",
    }),
    action({
      horizon: "short",
      title: "Rever antecipação de recebíveis",
      description: "Compare antecipação, boleto, cartão e crédito bancário para parar a fonte mais cara de caixa.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 21,
      doneWhen: "Tabela comparativa pronta com custo mensal por fonte e regra aprovada para usar a menor taxa.",
    }),
    action({
      horizon: "medium",
      title: "Alongar vencimentos caros",
      description: "Reestruture parcelas de curto prazo que pressionam o caixa e corroem o lucro operacional.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 20_000_00),
      deadlineDays: 75,
      doneWhen: "Novo cronograma assinado reduzindo despesa financeira mensal por 2 fechamentos.",
    }),
    action({
      horizon: "long",
      title: "Diversificar fontes de capital",
      description: "Crie alternativas de funding com banco, fornecedor, recebíveis e sócio para depender menos da linha cara.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 30_000_00),
      deadlineDays: 150,
      doneWhen: "Duas fontes alternativas aprovadas com limite, taxa, prazo e regra de acionamento documentados.",
    }),
  ];
}

function turnaroundPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Cortar gastos não essenciais",
      description: "Suspenda gastos discricionários e compras não essenciais para estancar o prejuízo do mês.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 7,
      doneWhen: "Lista de gastos pausados aprovada e redução mínima de R$ 3.000/mês registrada.",
    }),
    action({
      horizon: "short",
      title: "Renegociar maiores despesas",
      description: "Renegocie os 3 maiores contratos recorrentes com foco em redução imediata de caixa.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 30,
      doneWhen: "Três fornecedores contatados e pelo menos um acordo com redução mensal assinado.",
    }),
    action({
      horizon: "short",
      title: "Pausar despesas não essenciais",
      description: "Pause assinaturas, compras e serviços administrativos que não sustentam entrega ou venda imediata.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 14,
      doneWhen: "Despesas pausadas com economia mensal de pelo menos R$ 4.000 registrada no próximo fechamento.",
    }),
    action({
      horizon: "medium",
      title: "Reduzir folha operacional",
      description: "Redimensione escala, horas extras ou terceiros para alinhar pessoal à receita atual.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 60,
      doneWhen: "Custo mensal de pessoal reduzido ou produtividade por pessoa elevada com meta numérica.",
    }),
    action({
      horizon: "long",
      title: "Reestruturar custos fixos",
      description: "Redesenhe aluguel, ferramentas, terceiros e equipe mínima para manter a operação no ponto de equilíbrio.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 12_000_00),
      deadlineDays: 120,
      doneWhen: "Custo fixo mensal reduzido em R$ 12.000 ou margem líquida positiva por 2 meses seguidos.",
    }),
  ];
}

function peoplePlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Mapear custo por função",
      description: "Separe folha por área, função e entrega para identificar onde a receita não cobre o custo.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 15,
      doneWhen: "Mapa de folha por função concluído com custo mensal e responsável por área.",
    }),
    action({
      horizon: "short",
      title: "Reduzir horas improdutivas",
      description: "Elimine horas extras, ociosidade e sobreposições de agenda antes de mexer no quadro fixo.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 30,
      doneWhen: "Horas extras ou ociosidade reduzidas com meta mínima em R$ por mês.",
    }),
    action({
      horizon: "short",
      title: "Renegociar terceiros recorrentes",
      description: "Renegocie terceiros e prestadores ligados à operação para aliviar o custo de pessoal ampliado.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 6_000_00),
      deadlineDays: 30,
      doneWhen: "Contratos revisados com redução mensal medida ou escopo ajustado.",
    }),
    action({
      horizon: "medium",
      title: "Redimensionar equipe por produtividade",
      description: "Compare receita, margem e entrega por função para redimensionar o quadro sem perder capacidade crítica.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 20_000_00),
      deadlineDays: 75,
      doneWhen: "Plano de produtividade aprovado com meta de folha como percentual da receita.",
    }),
    action({
      horizon: "long",
      title: "Automatizar rotinas de baixa margem",
      description: "Substitua tarefas repetitivas por processo ou ferramenta para reduzir dependência de horas manuais.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 25_000_00),
      deadlineDays: 120,
      doneWhen: "Rotina automatizada em produção e economia mensal estimada validada por 2 ciclos.",
    }),
  ];
}
