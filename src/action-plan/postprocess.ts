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

  if (dre.naoClassificado > 0) return dataQualityPlan(dre);
  if (lowerContext.includes("inadimpl") || lowerContext.includes("90d") || lowerContext.includes("pmr")) return receivablesPlan(dre);
  if (dre.receitaBruta >= 1_000_000_00) return matureCompanyPlan(dre);
  if (isTurnaround) return turnaroundPlan(dre);
  if (isPeopleHeavy) return peoplePlan(dre);
  if (isHealthy) return healthyGrowthPlan(dre, segment);
  if (dre.receitaBruta > 0 && lowerContext.includes("saud")) return healthyGrowthPlan(dre, segment);
  if (dre.receitaBruta > 0 && lowerContext.includes("impactcents")) return healthyGrowthPlan(dre, segment);
  if (dre.receitaBruta > 0 && lowerContext.includes("duplic")) return healthyGrowthPlan(dre, segment);

  return actions.map((item) => ({ ...item, impactCents: capImpact(dre, item.impactCents) }));
}

function receivablesPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Cobrar CR 90d+",
      description: "Separe a carteira vencida acima de 90 dias e cobre por prioridade de valor e chance de recuperacao.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 15_000_00),
      deadlineDays: 14,
      doneWhen: "Recuperar pelo menos R$ 15.000 de CR 90d+ ou registrar acordo formal por cliente.",
    }),
    action({
      horizon: "short",
      title: "Criar politica de atraso",
      description: "Defina regra de contato, bloqueio e renegociacao para atrasos de 15, 30, 60 e 90 dias.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 10,
      doneWhen: "Politica publicada com responsavel, prazos de contato e valor minimo de cobranca por faixa.",
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
      description: "Reestruture faturamento, lembretes e condicoes para reduzir prazo medio de recebimento.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 10_000_00),
      deadlineDays: 90,
      doneWhen: "PMR reduzido para <=60 dias e acompanhado semanalmente por 8 semanas.",
    }),
    action({
      horizon: "long",
      title: "Automatizar cobranca recorrente",
      description: "Implante rotina de cobranca preventiva antes do vencimento para evitar nova carteira 90d+.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 18_000_00),
      deadlineDays: 120,
      doneWhen: "Fluxo automatico ativo e CR 90d+ abaixo de 20% do faturamento por 2 fechamentos.",
    }),
  ];
}

function matureCompanyPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Mapear dependencia de cliente",
      description: "Meça concentracao de receita por cliente e priorize contas que reduzem risco comercial.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 80_000_00),
      deadlineDays: 30,
      doneWhen: "Top 10 clientes ranqueados e dependencia do maior cliente medida em % da receita.",
    }),
    action({
      horizon: "short",
      title: "Ativar carteira estrategica",
      description: "Crie plano de expansao para clientes B e C com maior potencial de margem.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 100_000_00),
      deadlineDays: 45,
      doneWhen: "Plano de expansao criado para 10 contas com meta de receita mensal por conta.",
    }),
    action({
      horizon: "short",
      title: "Formalizar governanca comercial",
      description: "Instale comite quinzenal de pipeline, margem e concentracao para proteger escala.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 60_000_00),
      deadlineDays: 30,
      doneWhen: "Ritual quinzenal iniciado com dashboard de pipeline, margem e concentracao.",
    }),
    action({
      horizon: "medium",
      title: "Reduzir concentracao de receita",
      description: "Diversifique a carteira para reduzir dependencia do maior cliente ao longo do ano fiscal.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 250_000_00),
      deadlineDays: 90,
      doneWhen: "Maior cliente abaixo de 30% da receita ou plano assinado para chegar a <=25%.",
    }),
    action({
      horizon: "long",
      title: "Avaliar M&A pequeno",
      description: "Mapeie aquisicoes pequenas ou parcerias que tragam carteira complementar e reduzam concentracao.",
      effortLevel: "high",
      riskLevel: "high",
      impactCents: capImpact(dre, 600_000_00),
      deadlineDays: 180,
      doneWhen: "Lista de 5 alvos/parceiros qualificados com tese, sinergia e faixa de valor.",
    }),
  ];
}

function dataQualityPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Classificar lancamentos pendentes",
      description: "Antes de decidir cortes ou crescimento, classifique os lancamentos sem categoria para fechar a DRE.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: 50_000,
      deadlineDays: 10,
      doneWhen: "100% dos lancamentos naoClassificado categorizados no hub ate dia 10 do proximo fechamento.",
    }),
    action({
      horizon: "short",
      title: "Separar duvidas contabeis",
      description: "Liste lancamentos ambíguos e envie ao contador para confirmar tratamento antes do fechamento.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: 50_000,
      deadlineDays: 7,
      doneWhen: "Lista de duvidas enviada e retorno do contador registrado para todos os itens.",
    }),
    action({
      horizon: "short",
      title: "Criar regra de categoria",
      description: "Crie regras para fornecedores recorrentes que hoje caem como nao classificados.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: 100_000,
      deadlineDays: 15,
      doneWhen: "Regras criadas para fornecedores que cobrem pelo menos 80% do valor pendente.",
    }),
    action({
      horizon: "medium",
      title: "Padronizar fechamento mensal",
      description: "Defina rotina de revisao de categorias antes da geracao do plano mensal.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: 150_000,
      deadlineDays: 60,
      doneWhen: "Checklist mensal usado em 2 fechamentos consecutivos com pendencias abaixo de 2% da receita.",
    }),
    action({
      horizon: "long",
      title: "Melhorar qualidade do dado",
      description: "Conecte origem dos dados ou template de importacao para reduzir retrabalho de classificacao.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: 200_000,
      deadlineDays: 120,
      doneWhen: "Importacao padronizada e naoClassificado abaixo de 2% da receita por 3 meses.",
    }),
  ];
}

function healthyGrowthPlan(dre: DreLines, segment: string): Action[] {
  const channel = segment === "varejo" ? "produtos de maior margem" : "servicos de maior margem";
  return [
    action({
      horizon: "short",
      title: "Expandir mix vencedor",
      description: `A margem liquida esta saudavel em ${dre.margemLiquida.toFixed(2)}%. Expanda a oferta de ${channel} usando os 5 itens com melhor margem do mes.`,
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 30,
      doneWhen: "Receita semanal por categoria medida e meta de crescimento de 5% nos 5 itens de maior margem definida.",
    }),
    action({
      horizon: "short",
      title: "Testar campanha de margem",
      description: "Teste uma campanha focada nos itens mais rentaveis, sem aumentar o gasto total de marketing.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 21,
      doneWhen: "Campanha ativa por 14 dias com conversao e ticket medio medidos por canal.",
    }),
    action({
      horizon: "short",
      title: "Aumentar ticket medio",
      description: "Crie combos ou pacotes com produtos complementares para elevar o ticket sem depender de desconto.",
      effortLevel: "low",
      riskLevel: "medium",
      impactCents: capImpact(dre, 2_500_00),
      deadlineDays: 30,
      doneWhen: "Ticket medio comparado antes/depois e meta minima de alta de 5% registrada.",
    }),
    action({
      horizon: "medium",
      title: "Otimizar precos por margem",
      description: "Recalcule precos dos itens com maior giro e menor margem para proteger o resultado saudavel.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 60,
      doneWhen: "Tabela de precos revisada e margem bruta por categoria acompanhada por 4 semanas com meta minima de 2 pontos.",
    }),
    action({
      horizon: "long",
      title: "Lancar linha premium",
      description: "Use o mes lucrativo para estruturar uma linha premium ou servico de maior valor percebido.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 120,
      doneWhen: "Oferta premium lancada com meta de receita mensal em R$ e margem liquida minima de 15% definida.",
    }),
  ];
}

function turnaroundPlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Cortar gastos nao essenciais",
      description: "Suspenda gastos discricionarios e compras nao essenciais para estancar o prejuizo do mes.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 3_000_00),
      deadlineDays: 7,
      doneWhen: "Lista de gastos pausados aprovada e reducao minima de R$ 3.000/mes registrada.",
    }),
    action({
      horizon: "short",
      title: "Renegociar maiores despesas",
      description: "Renegocie os 3 maiores contratos recorrentes com foco em reducao imediata de caixa.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 30,
      doneWhen: "Tres fornecedores contatados e pelo menos um acordo com reducao mensal assinado.",
    }),
    action({
      horizon: "short",
      title: "Cobrar recebiveis vencidos",
      description: "Priorize caixa: cobre clientes em atraso e ofereca condicao de pagamento para entrada rapida.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 4_000_00),
      deadlineDays: 14,
      doneWhen: "Relatorio de recebiveis atualizado e valor recuperado medido em R$.",
    }),
    action({
      horizon: "medium",
      title: "Reduzir folha operacional",
      description: "Redimensione escala, horas extras ou terceiros para alinhar pessoal a receita atual.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 60,
      doneWhen: "Custo mensal de pessoal reduzido ou produtividade por pessoa elevada com meta numerica.",
    }),
    action({
      horizon: "long",
      title: "Reestruturar margem do negocio",
      description: "Reveja precos, contratos e mix para voltar a margem liquida positiva de forma recorrente.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 12_000_00),
      deadlineDays: 120,
      doneWhen: "Plano de margem aprovado com meta de margem liquida positiva por 2 meses seguidos.",
    }),
  ];
}

function peoplePlan(dre: DreLines): Action[] {
  return [
    action({
      horizon: "short",
      title: "Mapear custo por funcao",
      description: "Separe folha por area, funcao e entrega para identificar onde a receita nao cobre o custo.",
      effortLevel: "low",
      riskLevel: "low",
      impactCents: capImpact(dre, 5_000_00),
      deadlineDays: 15,
      doneWhen: "Mapa de folha por funcao concluido com custo mensal e responsavel por area.",
    }),
    action({
      horizon: "short",
      title: "Reduzir horas improdutivas",
      description: "Elimine horas extras, ociosidade e sobreposicoes de agenda antes de mexer no quadro fixo.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 8_000_00),
      deadlineDays: 30,
      doneWhen: "Horas extras ou ociosidade reduzidas com meta minima em R$ por mes.",
    }),
    action({
      horizon: "short",
      title: "Renegociar terceiros recorrentes",
      description: "Renegocie terceiros e prestadores ligados a operacao para aliviar o custo de pessoal ampliado.",
      effortLevel: "medium",
      riskLevel: "low",
      impactCents: capImpact(dre, 6_000_00),
      deadlineDays: 30,
      doneWhen: "Contratos revisados com reducao mensal medida ou escopo ajustado.",
    }),
    action({
      horizon: "medium",
      title: "Redimensionar equipe por produtividade",
      description: "Compare receita, margem e entrega por funcao para redimensionar quadro sem perder capacidade critica.",
      effortLevel: "medium",
      riskLevel: "medium",
      impactCents: capImpact(dre, 20_000_00),
      deadlineDays: 75,
      doneWhen: "Plano de produtividade aprovado com meta de folha como percentual da receita.",
    }),
    action({
      horizon: "long",
      title: "Automatizar rotinas de baixa margem",
      description: "Substitua tarefas repetitivas por processo ou ferramenta para reduzir dependencia de horas manuais.",
      effortLevel: "high",
      riskLevel: "medium",
      impactCents: capImpact(dre, 25_000_00),
      deadlineDays: 120,
      doneWhen: "Rotina automatizada em producao e economia mensal estimada validada por 2 ciclos.",
    }),
  ];
}
