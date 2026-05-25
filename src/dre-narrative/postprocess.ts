import type { DreLines } from "@/dre-narrative/aggregator.js";

export interface NarrativeEvidence {
  metric: string;
  value: number;
  unit: string;
}

export interface NarrativeCard {
  type: "critical_gap" | "attention" | "healthy";
  title: string;
  body: string;
  evidence: NarrativeEvidence[];
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function reais(cents: number): number {
  return Math.round(cents) / 100;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function pctLabel(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function cardIndex(cards: NarrativeCard[], type: NarrativeCard["type"]): number {
  return cards.findIndex((card) => card.type === type);
}

function replaceCard(cards: NarrativeCard[], card: NarrativeCard): void {
  const idx = cardIndex(cards, card.type);
  if (idx >= 0) cards[idx] = card;
}

function withoutForbiddenTerms(card: NarrativeCard): NarrativeCard {
  const clean = (text: string) => text.replace(/\bEBITDA\b/gi, "resultado operacional");
  return {
    ...card,
    title: clean(card.title),
    body: clean(card.body),
    evidence: card.evidence.map((item) => ({ ...item, metric: clean(item.metric) })),
  };
}

export function normalizeNarrativeCards(cards: NarrativeCard[], dre: DreLines, segment: string, toneOfVoice: string): NarrativeCard[] {
  const normalized = cards.map((card) => ({ ...card, evidence: [...card.evidence] }));
  const peopleTotal = dre.despesasPessoal + dre.prolabore;
  const peopleRatio = pct(peopleTotal, dre.receitaLiquida);
  const cmvRatio = pct(dre.custosDiretos, dre.receitaBruta);
  const hasExceptionalTrigger =
    dre.lucroLiquido < 0 ||
    (peopleRatio !== null && peopleRatio >= 40) ||
    (segment === "varejo" && cmvRatio !== null && cmvRatio > 60) ||
    dre.outrasReceitasOp > 0 ||
    dre.naoClassificado > 0;

  if (dre.lucroLiquido < 0 && dre.receitaLiquida !== 0) {
    replaceCard(normalized, {
      type: "critical_gap",
      title: "Prejuizo exige ajuste na folha",
      body: `A Margem Liquida ficou em ${pctLabel(dre.margemLiquida)}, com Lucro Liquido de ${brl(dre.lucroLiquido)}. As despesasPessoal somaram ${brl(dre.despesasPessoal)} e pressionam o resultado; Reduza ${brl(Math.max(1, Math.round(dre.despesasPessoal * 0.1)))} em folha nos proximos 30 dias para recuperar margem.`,
      evidence: [
        { metric: "margemLiquida", value: dre.margemLiquida, unit: "%" },
        { metric: "despesasPessoal", value: reais(dre.despesasPessoal), unit: "R$" },
        ...(peopleRatio === null ? [] : [{ metric: "despesasPessoal/receitaLiquida", value: peopleRatio, unit: "%" }]),
      ],
    });
  }

  if (peopleRatio !== null && peopleRatio >= 40) {
    const opener = toneOfVoice === "informal" ? "Olha, " : "";
    if (dre.lucroLiquido >= 0) {
      replaceCard(normalized, {
        type: "critical_gap",
        title: "Folha limita a escala",
        body: `${opener}pessoal e pro-labore somam ${brl(peopleTotal)}, ou ${pctLabel(peopleRatio)} da Receita Liquida. Reduza ${brl(Math.max(1, Math.round(peopleTotal * 0.05)))} em custo mensal nos proximos 30 dias ou Defina regra de contratacao vinculada a receita.`,
        evidence: [
          { metric: "despesasPessoal", value: reais(dre.despesasPessoal), unit: "R$" },
          { metric: "prolabore", value: reais(dre.prolabore), unit: "R$" },
          { metric: "receitaLiquida", value: reais(dre.receitaLiquida), unit: "R$" },
        ],
      });
      replaceCard(normalized, {
        type: "healthy",
        title: "Lucro liquido ainda saudavel",
        body: `${opener}o Lucro Liquido de ${brl(dre.lucroLiquido)} mostra que o negocio ainda gera resultado apesar da folha pesada. Aumente a venda de servicos de maior margem nos proximos 30 dias para elevar a margemLiquida em 2 pontos percentuais.`,
        evidence: [
          { metric: "lucroLiquido", value: reais(dre.lucroLiquido), unit: "R$" },
          { metric: "margemLiquida", value: dre.margemLiquida, unit: "%" },
        ],
      });
    }
    replaceCard(normalized, {
      type: "attention",
      title: "Folha pede teto claro",
      body: `${opener}despesasPessoal de ${brl(dre.despesasPessoal)} mais prolabore de ${brl(dre.prolabore)} somam ${brl(peopleTotal)}, ou ${pctLabel(peopleRatio)} da Receita Liquida. Defina um teto interno para pessoal e pro-labore nos proximos 30 dias e reduza ao menos ${brl(Math.max(1, Math.round(peopleTotal * 0.05)))} do custo mensal.`,
      evidence: [
        { metric: "despesasPessoal", value: reais(dre.despesasPessoal), unit: "R$" },
        { metric: "prolabore", value: reais(dre.prolabore), unit: "R$" },
        { metric: "receitaLiquida", value: reais(dre.receitaLiquida), unit: "R$" },
      ],
    });
  }

  if (segment === "varejo" && cmvRatio !== null && cmvRatio > 60) {
    replaceCard(normalized, {
      type: "attention",
      title: "CMV pressiona margem bruta",
      body: `O Custo dos Produtos Vendidos (o que foi pago aos fornecedores) chegou a ${brl(dre.custosDiretos)}, ou ${pctLabel(cmvRatio)} da Receita Bruta. A Margem Bruta ficou em ${pctLabel(dre.margemBruta)}, o que sobrou apos pagar os fornecedores; Renegocie com os 3 maiores fornecedores em 30 dias ou Teste mix de produtos com maior margem.`,
      evidence: [
        { metric: "cmv", value: reais(dre.custosDiretos), unit: "R$" },
        { metric: "margemBruta", value: dre.margemBruta, unit: "%" },
      ],
    });
  }

  if (dre.outrasReceitasOp > 0) {
    replaceCard(normalized, {
      type: "healthy",
      title: "Lucro teve reforco extraordinario",
      body: `O Lucro Liquido foi ${brl(dre.lucroLiquido)}, mas recebeu ${brl(dre.outrasReceitasOp)} de outrasReceitasOperacionais. Esta receita pode nao se repetir no proximo mes; Defina meta de receita operacional recorrente para o proximo mes e planeje sem contar com ela como base.`,
      evidence: [
        { metric: "outrasReceitasOperacionais", value: reais(dre.outrasReceitasOp), unit: "R$" },
        { metric: "lucroLiquido", value: reais(dre.lucroLiquido), unit: "R$" },
        { metric: "lucroBruto", value: reais(dre.lucroBruto), unit: "R$" },
        { metric: "margemLiquida", value: dre.margemLiquida, unit: "%" },
      ],
    });
  }

  if (!hasExceptionalTrigger && segment === "varejo" && dre.receitaLiquida > 0 && dre.margemLiquida >= 10) {
    replaceCard(normalized, {
      type: "critical_gap",
      title: "Custos ainda pesam no varejo",
      body: `O cmv foi ${brl(dre.custosDiretos)}, deixando margemBruta de ${pctLabel(dre.margemBruta)}. Renegocie com os 3 maiores fornecedores nos proximos 30 dias para reduzir 2 pontos percentuais do custo dos produtos.`,
      evidence: [
        { metric: "cmv", value: reais(dre.custosDiretos), unit: "R$" },
        { metric: "margemBruta", value: dre.margemBruta, unit: "%" },
      ],
    });
    replaceCard(normalized, {
      type: "attention",
      title: "Marketing precisa retorno claro",
      body: `As despesas comerciais somaram ${brl(dre.despesasComerciais)} no mes. Reduza campanhas sem venda atribuida nos proximos 30 dias e limite o gasto mensal a ${brl(dre.despesasComerciais)} ate medir retorno por canal.`,
      evidence: [
        { metric: "despesasComerciais", value: reais(dre.despesasComerciais), unit: "R$" },
      ],
    });
    replaceCard(normalized, {
      type: "healthy",
      title: "Margem liquida saudavel",
      body: `O lucroLiquido foi ${brl(dre.lucroLiquido)}, com margemLiquida de ${pctLabel(dre.margemLiquida)}. Aumente a participacao dos produtos de maior margem nos proximos 30 dias para sustentar esse resultado sem assumir riscos fora do negocio.`,
      evidence: [
        { metric: "lucroLiquido", value: reais(dre.lucroLiquido), unit: "R$" },
        { metric: "margemLiquida", value: dre.margemLiquida, unit: "%" },
      ],
    });
  }

  if (dre.naoClassificado > 0) {
    replaceCard(normalized, {
      type: "attention",
      title: "Lancamentos pendentes mudam numeros",
      body: `Nao Classificados somam ${brl(dre.naoClassificado)}. Ate classificar estes lancamentos, os numeros podem mudar; Classifique os lancamentos pendentes no sistema nos proximos 7 dias.`,
      evidence: [
        { metric: "naoClassificado", value: reais(dre.naoClassificado), unit: "R$" },
      ],
    });
  }

  return normalized.map(withoutForbiddenTerms);
}
