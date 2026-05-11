# Backend — export

**Status:** complete
**Commit:** 8f51c09
**Implementado em:** 2026-05-11

## Entregáveis

- `src/export/generator.ts` — geração de PDF via pdfkit com 3 sabores de relatório
- `src/export/routes.ts` — GET /analysis/:id/export/:type (monthly | investors | partners)

## Comportamento

- Streaming do PDF diretamente na resposta (Content-Type: application/pdf)
- monthly: DRE completo + 3 narrative cards + plano de ação (3 horizontes)
- investors: métricas-chave (receita, EBITDA, margens) + ações médio/longo prazo
- partners: lucro líquido, pró-labore, distribuição potencial estimada + ações curto prazo
- Paginação automática com rodapé (data + número de página)
- Fundo do lucro líquido: verde (positivo) ou vermelho (negativo)
- Sem LLM — renderização determinística dos dados já gerados pelo pipeline
