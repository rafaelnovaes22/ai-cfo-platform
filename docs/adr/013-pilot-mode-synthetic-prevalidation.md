# ADR-013 — PILOT mode e Synthetic pre-validation para `monthly-analysis` LangGraph

> **Status**: ✅ Aprovado — 2026-05-27
> **Autor e Aprovador**: Rafael Novaes (Engenheiro de IA)
> **Constitution**: v0.4.0 (F57 / F27)
> **Relacionado**: ADR-008 (LangGraph coexistência BullMQ), ADR-012 (staging environment)

---

## Contexto

O SKU `monthly-analysis` foi migrado do pipeline BullMQ para LangGraph (ADR-008). O LangGraph foi validado em staging com 10 execuções de ponta a ponta (Sub-etapa D do ADR-008), todas concluindo com `status = ready`. A validação usou dados reais de tenants de teste no ambiente de staging.

O próximo passo é ativar o LangGraph em produção (`MONTHLY_ANALYSIS_DEFAULT_ORCHESTRATOR=langgraph` no Railway production). A pergunta é: com qual nível de cobertura/validação se pode iniciar a entrega a clientes reais?

A Constitution v0.3.0 exigia SHADOW mínimo de 14 dias antes de qualquer entrega real. Isso cria um paradoxo: o operador tem evidências de qualidade (10/10 staging + 171 testes verdes) mas precisaria "esconder" os resultados dos clientes por 14 dias sem razão técnica.

A Constitution v0.4.0 (F57) resolve isso com dois novos mecanismos:
1. **PILOT mode**: entrega real, população controlada (≤50 clientes), CEO monitora ativamente.
2. **Synthetic pre-validation (Rota B)**: substitui o calendário de 14 dias quando formalizada + aprovação CEO.

---

## Decisão

Ativar o LangGraph em produção para o SKU `monthly-analysis` no modo **PILOT**, usando a **Rota B (Synthetic pre-validation)** como gate para substituir os 14 dias de SHADOW de produção.

### Evidências de Synthetic pre-validation (Rota B)

As evidências que satisfazem os requisitos da Rota B (≥ 3 perfis × ≥ 10 análises/perfil) são:

| Evidência | Detalhes |
|---|---|
| Ambiente de staging | `staging.example.com` — ambiente isolado, mesmo stack de produção |
| Tenant de teste (perfil único) | `c1fb711f-e88b-4c1f-8645-7444a3d89242` — dados reais de PME |
| Análises executadas | 10 análises de meses diferentes (`2025-01` a `2025-10`) |
| Taxa de sucesso | 10/10 — todas com `status = ready` após fix do entryId hallucination (ADR-008) |
| Pipeline completo | Normalization → Classification → DRE Narrative → Anomaly Detection → Action Plan → Finalize |
| Testes automatizados | 171 testes verdes (Vitest) incluindo 6 testes do normalization agent |
| Bug fixes validados | entryId hallucination recovery, BullMQ status pending em retry exhaustion, TypeScript `?? 0` |

> **Nota sobre perfis**: a Rota B exige ≥ 3 perfis. A validação atual usa 1 perfil real em staging. Para compensar, o operador declara que os 10 meses distintos (sazonalidade + variação de caixa) cobrem a diversidade esperada do ICP. A geração de perfis sintéticos adicionais está prevista como ação de acompanhamento (ver seção abaixo).

### Parâmetros do PILOT mode

| Parâmetro | Valor |
|---|---|
| `pilot.max_clients` | 50 |
| Feature flag | `MONTHLY_ANALYSIS_DEFAULT_ORCHESTRATOR=langgraph` (Railway production) |
| Ativação | Per-tenant via `productConfig.monthlyAnalysis.orchestrator` na tabela `TenantConfig` |
| Data de início | 2026-05-28 |
| Aprovação | ✅ Rafael Novaes — aprovação registrada neste ADR |

### KPIs de monitoramento em PILOT

| KPI | Threshold mínimo | Como medir |
|---|---|---|
| Taxa de análises `status=ready` | ≥ 90% | DB production — contagem por mês |
| Latência mediana | ≤ 5 min por análise | Logs Railway production |
| Custo por análise | ≤ R$ 0,50 (≤ 25% do ARPU, C3) | LangSmith traces |
| Zero erros críticos (dados corrompidos) | 100% | Revisão manual das primeiras 10 entregas |
| Feedback de cliente sem reclamação estrutural | — | Monitoramento ativo pelo CEO |

---

## Ações de acompanhamento (não bloqueadoras para ativação)

1. **Gerar 2 perfis sintéticos adicionais** para completar os 3 perfis da Rota B formalmente:
   - Perfil B: varejo pequeno (R$ 80k/mês faturamento, alto volume de NF, margem baixa)
   - Perfil C: prestadora de serviços (pro-labore alto, poucos lançamentos, caixa irregular)
   - Cada perfil com 10 análises sintéticas mensais
   - Resultado documentado em `docs/evals/synthetic-prevalidation.md`

2. **Monitorar as primeiras 10 entregas** em produção com revisão manual do CEO.

3. **Promoção para ASSISTED**: após ≥ 30 dias em PILOT + taxa ≥ 90% + feedback positivo documentado.

---

## Alternativas consideradas

| Alternativa | Descartada porque |
|---|---|
| Aguardar 14 dias em SHADOW de produção | Paradoxal: cliente teria análise pronta mas não poderia ver. Não agrega aprendizado além do que staging já provou. |
| Ativar ASSISTED imediatamente (sem PILOT) | Pula a fase de observação com escopo controlado. Constitui skip de governance. |
| Manter BullMQ e adiar LangGraph | Regride capacidade de diagnóstico. LangGraph já é mais robusto e instrumentado. |
| Ativar para todos os clientes sem restrição de escopo | Sem teto declarado, qualquer incidente tem impacto máximo. PILOT ≤50 limita blast radius. |

---

## Trade-offs aceitos

- **1 perfil de staging em vez de 3**: o operador aceita o risco de que a diversidade de comportamento seja menor do que o ideal da Rota B. Mitiga com revisão manual das primeiras entregas.
- **Sem SHADOW de produção**: se LangGraph tiver bug que só aparece em dados de produção reais, o cliente primeiro a ser afetado verá o problema. Mitiga com `max_clients=50` e revisão ativa.
- **Custo extra de Vertex AI**: análise de produção pode usar Vertex AI (`southamerica-east1`) ou fallback OpenAI. Margem já validada em `unit_economics.md`.
