# Retrospectiva — {{ SKU ID }} ({{ Nome do SKU }})

> **Template do Foundry** — projeto consumidor adapta isto como `docs/retrospectives/{sku}/retrospective.md`.
> **Origem**: `templates/retrospective.template.md` v0.1.0 do `agent-governance-framework`.

---

## Identificação

| Campo | Valor |
|---|---|
| **SKU** | `{{ sku_id }}` |
| **Vertical** | `{{ vertical }}` |
| **Cliente** | `{{ client_id }}` |
| **Data de promoção a AUTONOMOUS** | `{{ data }}` |
| **Data desta retrospectiva** | `{{ data }}` |
| **Foundry version no momento** | `{{ x.y.z }}` |

---

## Timeline do SKU

| Marco | Data | Duração acumulada |
|---|---|---|
| `/novais-digital:diagnose` concluído | `{{ data }}` | dia 1 |
| Spec + unit-economics aprovados | `{{ data }}` | dia `{{ N }}` |
| SHADOW iniciado | `{{ data }}` | dia `{{ N }}` |
| SHADOW encerrado | `{{ data }}` | dia `{{ N }}` |
| `ASSISTED` promovido | `{{ data }}` | dia `{{ N }}` |
| `AUTONOMOUS` promovido | `{{ data — se aplicável }}` | dia `{{ N }}` |
| **Total do início ao AUTONOMOUS** | | **`{{ N dias úteis }}`** |

---

## Compliance C1-C8

| Princípio | Resultado | Observação |
|---|---|---|
| **C1** Diagnose-before-design | `✅ / ⚠️ / ❌` | `{{ }}` |
| **C2** Outcome-first | `✅ / ⚠️ / ❌` | `{{ cláusula de outcome funcionou? }}` |
| **C3** Custo ≤ 25% do preço | `✅ / ⚠️ / ❌` | `{{ custo real: X% }}` |
| **C4** SHADOW ≥ 14 dias | `✅ / ⚠️ / ❌` | `{{ N dias de SHADOW }}` |
| **C5** Three-tier context | `✅ / ⚠️ / ❌` | `{{ Tier 1/2/3 respeitados? }}` |
| **C6** Telemetry-by-default | `✅ / ⚠️ / ❌` | `{{ trace coverage: X% }}` |
| **C7** Portability | `✅ / ⚠️ / ❌` | `{{ imports em adapters only? }}` |
| **C8** Anti-customização | `✅ / ⚠️ / ❌` | `{{ zero hardcode por tenant? }}` |

**Compliance geral**: `{{ N/8 princípios ✅ }}`

---

## Gate failures (lições)

> Registrar cada vez que uma gate falhou — fonte primária de aprendizado.

| Gate | Motivo da falha | Resolução | Tempo perdido |
|---|---|---|---|
| `{{ ex: G3 - eval <30 casos }}` | `{{ razão }}` | `{{ como resolveu }}` | `{{ N horas/dias }}` |
| `{{ ex: C3 unviable na primeira versão }}` | `{{ prompt muito longo }}` | `{{ refatorou em 2 passes }}` | `{{ N horas }}` |

Gates que NÃO falharam (digno de nota):
- `{{ ex: secret-scan nunca ativou — boas práticas de env mantidas }}` ✅

---

## Métricas reais

### C3 — Unit Economics

| Métrica | Estimado no /unit-economics | Real em produção |
|---|---|---|
| Custo por outcome | `{{ $ }}` | `{{ $ }}` |
| Preço cobrado | `{{ $ }}` | `{{ $ }}` |
| % custo/preço | `{{ % }}` | `{{ % }}` |
| **C3 compliance** | `{{ pass/fail estimado }}` | `{{ pass/fail real }}` |

### C4 — SHADOW

| Métrica | Threshold contratado | Real |
|---|---|---|
| Agreement rate | `{{ % }}` | `{{ % }}` |
| Latency p95 | `{{ ms }}` | `{{ ms }}` |
| Duração SHADOW | ≥ 14 dias | `{{ N dias }}` |
| Outcomes processados em SHADOW | `{{ N mínimo }}` | `{{ N real }}` |

### C6 — Telemetria

| Métrica | Meta | Real |
|---|---|---|
| Trace coverage | 100% | `{{ % }}` |
| prompt_hash mudanças em produção | 0 (sem migração) | `{{ N vezes }}` |
| Langfuse traces disponíveis para reviewer | sim | `{{ sim / não }}` |

---

## O que funcionou bem

1. `{{ prática, decisão ou abordagem que funcionou — específico o suficiente para replicar }}`
2. `{{ ex: usar offerings-loader no Tier 1 reduziu X tokens em prompts L2 }}`
3. `{{ ex: 4 fontes de eval (real + synthetic + edge + adversarial) capturou anomalia X antes do promote }}`

---

## O que não funcionou / dívidas

1. `{{ problema — ex: prompt muito verboso em seção 3 causou latência p95 acima do threshold }}`
   - Dívida: `{{ o que ficou pendente }}`
   - Ação: `{{ o que vai melhorar no próximo SKU }}`
2. `{{ problema 2 }}`

---

## Blocos que entrarão no playbook

> Marcar quais artefatos deste SKU são candidatos ao playbook vertical.

- [ ] `{{ path }}` — `{{ nível de confiança de reutilização }}`
- [ ] `{{ path }}` — `{{ }}`

Playbook vertical: `docs/playbooks/{{ vertical }}/playbook.md`

---

## Recomendações para o próximo SKU do vertical

1. `{{ recomendação específica }}`
2. `{{ ex: iniciar com eval seed de 40 casos em vez de 30 — mais segurança para adversarial }}`
3. `{{ ex: mapear anti-ICP antes do /diagnose para filtrar leads mais cedo }}`

---

## Aprovação

**Retrospectiva conduzida por**: `{{ nome }}` em `{{ data }}`
**Revisada por**: `{{ nome }}` em `{{ data }}`
**Foundry version**: `{{ x.y.z }}`

---

## Histórico

| Data | Mudança | Quem |
|---|---|---|
| `{{ data }}` | Criação inicial pós-promoção a AUTONOMOUS | `{{ nome }}` |
