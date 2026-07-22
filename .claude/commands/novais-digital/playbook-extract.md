---
description: "F5.1 — Extrai playbook vertical a partir de SKUs em AUTONOMOUS. Identifica blocos reutilizáveis, padrões de integração e métricas de esforço para reduzir custo do cliente 2 para ≤30% do cliente 1."
allowed-tools: ["Read", "Write", "Bash", "Glob"]
foundry_command_version: 0.1.0
linked_principles: [C1, C2, C3, C4, C5, C6, C7, C8]
output_paths:
  - docs/playbooks/{vertical}/playbook.md
requires_autonomous_sku: true
---

# /novais-digital:playbook-extract

## Propósito

Extrai **playbook vertical** a partir de um ou mais SKUs que atingiram modo `AUTONOMOUS`. O playbook cataloga blocos reutilizáveis, padrões de integração e métricas de esforço para que o próximo cliente do mesmo vertical custe ≤ 30% do primeiro.

**Invocação**: `/novais-digital:playbook-extract --vertical=<id> [--sku=<sku_id>] [--client=<client_id>]`

---

## Anti-rationalization

| Tentação | Por que errado | Correto |
|---|---|---|
| "Criar playbook com SKU ainda em SHADOW" | Dados de SHADOW não representam produção real | Exige pelo menos 1 SKU em AUTONOMOUS |
| "Assumir que todos os blocos são reutilizáveis" | Seções por-cliente (role, anti-ICP, tenantId) são obrigatoriamente adaptadas | Classificar confiança explicitamente por bloco |
| "Pular métricas reais de esforço" | Playbook sem dados reais é ficção | Leia `docs/clients/{id}/` e `subscriptions/` para dados históricos |
| "Playbook genérico sem vertical claro" | Um playbook de "atendimento" não ajuda — precisa ser "atendimento financeiro" | Vertical sempre obrigatório |
| "Sobrescrever playbook existente" | Pode apagar lições de cliente anterior | Append ou criar nova versão |

---

## Pré-condições

```
[ ] --vertical definido (ex: financeiro, saúde, educacional)
[ ] Pelo menos 1 SKU do vertical com subscription.mode == AUTONOMOUS
[ ] docs/clients/{client_id}/diagnostic.md existe
[ ] subscriptions/{sku_id}/promotions.md existe com promote AUTONOMOUS assinado
[ ] offerings-loader carregado (catálogo de ofertas do vertical)
```

---

## Roteiro de execução

### Passo 1 — Inventário de SKUs do vertical

```bash
# Listar SKUs em AUTONOMOUS no vertical especificado
find subscriptions/ -name "promotions.md" | xargs grep -l "AUTONOMOUS" 2>/dev/null
```

Para cada SKU encontrado, ler:
- `subscriptions/{sku_id}/promotions.md` → data de promoção, quem aprovou
- `subscriptions/{sku_id}/shadow-runs/` → métricas SHADOW reais
- `docs/clients/{client_id}/diagnostic.md` → contexto do cliente
- `evals/{sku_id}/runs/*.md` → pass rate e fonte dos casos

### Passo 2 — Mapear blocos por tier

Para cada artefato do SKU, classificar em 3 categorias:

| Categoria | Critério | Confiança |
|---|---|---|
| **Reutilizável direto** | Não contém tenant-id, persona ou volume específico | Alta |
| **Reutilizável com adaptação** | Contém seção substituível por variável de TenantContext | Média |
| **Não reutilizável** | Hardcoded para o cliente (nome, case-específico) | Baixa |

Verificar compliance C8 durante o mapeamento:
```bash
grep -rn "tenantId===" src/skus/{sku_id}/ 2>/dev/null || echo "C8 FAIL — hardcode detectado"
```

### Passo 3 — Calcular métricas de esforço do cliente 1

Reconstruir timeline a partir de git log e metadados:

```bash
git log --all --oneline --format="%ad %s" --date=short | grep -i "{{vertical}}\|{{client_id}}" | head -20
```

Leia timestamps de:
- `docs/clients/{client_id}/diagnostic.md` (data do diagnóstico)
- `subscriptions/{sku_id}/promotions.md` (datas de cada promoção)
- `evals/{sku_id}/runs/` (duração do ciclo de eval)

### Passo 4 — Identificar padrões de integração

Ler os adapters e o TenantContext schema do SKU:

```bash
find src/llm/adapters/ src/skus/{sku_id}/ -name "*.ts" 2>/dev/null | head -20
```

Extrair:
- Padrão de trigger (webhook, cron, API)
- Campos obrigatórios do TenantContext para o vertical
- Padrão de trace/observe call (C6)

### Passo 5 — Gerar rascunho do playbook

Usar `templates/playbook.template.md` como base. Preencher com dados dos passos anteriores.

Criar em: `docs/playbooks/{vertical}/playbook.md`

```bash
mkdir -p docs/playbooks/{vertical}/
# Copiar template e preencher — seções com "?" indicam onde dados reais são necessários
```

### Passo 6 — Retrospectiva do SKU de origem

Se `docs/retrospectives/{sku_id}/retrospective.md` não existir, gerar esqueleto:

```bash
mkdir -p docs/retrospectives/{sku_id}/
# Usar templates/retrospective.template.md
```

Preencher com dados reais dos passos 1-3.

---

## Verification gate

```
[ ] docs/playbooks/{vertical}/playbook.md criado com dados reais (não só placeholders)
[ ] Todos os blocos classificados por tier e confiança de reutilização
[ ] Métricas de esforço do cliente 1 preenchidas (horas reais)
[ ] TenantContext schema do vertical documentado
[ ] Retrospectiva do SKU de origem criada ou atualizada
[ ] Nenhum client_id ou dado sensível hardcoded no playbook (PII removido)
```

---

## Output estruturado

```yaml
playbook_extract:
  vertical: <vertical_id>
  sku_origin: <sku_id>
  client_origin: <client_id>
  autonomous_since: <data ISO>
  playbook_path: docs/playbooks/{vertical}/playbook.md
  retrospective_path: docs/retrospectives/{sku_id}/retrospective.md
  blocks_inventory:
    tier1: { high_confidence: N, medium: N, low: N }
    tier2: { high_confidence: N, medium: N, low: N }
    tier3: { high_confidence: N, medium: N, low: N }
  effort_metrics:
    client1_hours_total: N
    estimated_client2_hours: N
    estimated_reuse_rate: "X%"
    meets_30pct_target: true | false
  integration_pattern:
    trigger: <webhook|cron|api|manual>
    tenant_context_fields: [field1, field2]
  blockers_found: []
  warnings: []
  signed_by: playbook-extract
  signed_at: <ISO-8601>
```

---

## Quando NÃO usar

- SKU ainda em SHADOW → aguardar AUTONOMOUS
- SKU em ASSISTED com < 30 dias → dados insuficientes para esforço real
- Vertical sem padrão definido (diagnóstico one-off) → retrospectiva sim, playbook não
- Sem dados de esforço do cliente 1 → documentar lacuna, não inventar estimativas

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-01 | Versão inicial — Foundry-5 |
