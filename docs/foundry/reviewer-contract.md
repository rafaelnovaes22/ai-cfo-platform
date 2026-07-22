# Novais Digital Foundry — Contrato com Reviewer Externo (DeepAgents / GPT-5.5)

> **Status**: ⏳ Especificação inicial (Foundry-0). Implementação técnica em Foundry-3.
> **Versão**: 0.1.0
> **Data**: 2026-04-30

---

## 1. Por que existe um reviewer externo

A metodologia Novais Digital SaaS² exige **independência de modelo** na auditoria mensal (D6.3.1: *"LLM-as-judge independente do modelo de produção"*) e **observabilidade total** (princípio Constitution #6). O reviewer externo:

- Valida que o framework Foundry segue a Constitution
- Revisa amostras de outcomes em produção (5–10% conforme D6)
- Audita coerência entre artefatos (`spec.md` vs código vs eval cases)
- Sinaliza drift (degradação de qualidade ao longo do tempo)
- Gera relatório mensal consumível por CEO + Tech Lead

Critério principal: o reviewer **não pode ser Claude** (independência) e precisa **ler tudo** (não apenas amostragem cega).

---

## 2. Identidade do reviewer

| Campo | Valor |
|---|---|
| **Tipo** | Deep Agent (filesystem virtual + planejamento + tools + subagentes) |
| **Modelo** | GPT-5.5 (provedor: OpenAI) |
| **Stack candidata** | Python `deepagents` (Scoras Academy / `Deep_Agents/`) **ou** Node/TS `@langchain/langgraph` (já no projeto) — decisão final em ADR-002 (Foundry-3) |
| **Local de execução** | A definir (CI? script local mensal? worker BullMQ?) |
| **Frequência** | Mensal por padrão, eventos críticos podem disparar (a definir em F11) |
| **Custo estimado** | < US$ 30/mês na fase de 1–3 SKUs |

---

## 3. Inputs que o reviewer ingere (contratualmente)

O reviewer **deve** receber acesso a:

### 3.1. Manifest auditável
- **Arquivo**: `docs/foundry/manifest.json`
- **Formato**: JSON estruturado com array de artefatos
- **Garantia**: atualizado automaticamente via hook `manifest-sync` (Foundry-4)
- **Conteúdo**: para cada artefato — `path`, `type`, `version`, `sha256`, `description`, `owner`, `linked_principles[]`

### 3.2. Constitution
- **Arquivo**: `.claude/CONSTITUTION.md`
- **Versão referenciada no manifest** garante que reviewer audita contra a constituição vigente

### 3.3. Especificações de SKU
- **Arquivos**: `src/skus/*/spec.md`, `docs/onda-0/sku_piloto.md`, `docs/onda-N/*`
- Reviewer correlaciona spec com implementação

### 3.4. Eval suites
- **Arquivos**: `evals/{sku}/cases/*.json`, `evals/{sku}/reports/*.json`
- Reviewer roda ou amostra eval suites para detectar drift

### 3.5. Outcomes de produção (amostra)
- **Fonte**: tabela `Outcome` do PostgreSQL (consulta read-only)
- **Janela**: 30 dias rolling
- **Amostragem**: 5–10% aleatório por categoria (regra D6)

### 3.6. Traces Langfuse
- **Acesso**: API Langfuse com chave read-only
- Reviewer correlaciona outcome com trace para validar custo, latência, decisão

### 3.7. Documentação Foundry
- Tudo em `docs/foundry/`

---

## 4. O que o reviewer valida (checks formais)

Cada check produz **PASS / FAIL / WARN** com evidência citada do manifest.

### 4.1. Checks da Constitution (princípios 1–8)

| # | Check | Como valida |
|---|---|---|
| C1 | Diagnose-before-design | Para cada SKU em produção, existe `docs/onda-0/sku_piloto.md` aprovado E `diagnostic.md` correspondente |
| C2 | Outcome-first | Toda spec começa com seção "Cláusula contratual de outcome" (D2.1 a D2.5 preenchidos) |
| C3 | Custo ≤ 25% do preço | Por SKU, `unit_economics.md` declara `custo_por_outcome` e `preço_por_outcome`, e razão ≤ 25%. Cross-check com Langfuse de últimos 30 dias |
| C4 | SHADOW antes de cobrar | Subscription só sai de SHADOW para ASSISTED se eval pass + N outcomes mínimos (D6.4) |
| C5 | Three-tier context | Cada skill em `.claude/skills/` declara `tier: L0\|L1\|L2` no frontmatter |
| C6 | Telemetry-by-default | Toda chamada LLM em `src/agents/**` é precedida ou seguida de chamada Langfuse (lint + sample de traces vs chamadas) |
| C7 | Portability over lock-in | Nenhum SKU acopla detalhes de modelo específico fora de `src/llm/` (audit de imports) |
| C8 | Anti-customização heroica | Cliente N do mesmo SKU não tem branch dedicado em `src/skus/{sku}/` (audit de overrides por tenant) |

### 4.2. Checks de coerência

| Check | Validação |
|---|---|
| Spec ↔ código | Cada SKU em `src/skus/{sku}/` tem `spec.md` correspondente em `docs/onda-N/` |
| Spec ↔ eval | Categorias de outcome no spec batem com `evals/{sku}/cases/` |
| ADR ↔ implementação | ADRs assinadas refletem o stack real (`package.json`) |
| Outcome ↔ trace | Cada `Outcome.id` tem `trace_id` Langfuse correspondente |

### 4.3. Checks de qualidade

| Check | Validação |
|---|---|
| SLA mensal | Acurácia auditada ≥ threshold D6.2 |
| Drift detection | Acurácia mês N vs N-1: queda >5pp dispara WARN |
| Cost drift | Custo médio mês N vs N-1: alta >15% dispara WARN |
| Eval freshness | `evals/{sku}/cases/` atualizado nos últimos 90 dias |

---

## 5. Output esperado do reviewer

### 5.1. Relatório mensal

**Arquivo**: `docs/foundry/audits/{YYYY-MM-DD}-monthly.md`

**Estrutura**:

```markdown
# Auditoria Mensal Foundry — {YYYY-MM-DD}

## Resumo executivo
- ✅ Constitution: 7/8 PASS, 1 WARN (C3 marginal)
- ✅ SLA mensal: 87% (threshold 85%) — PASS
- ⚠️ Drift: queda 6pp em SKU triagem-comercial — investigar
- ❌ Coerência: spec X não bate com código — abrir issue

## Detalhamento por check
[uma seção por check com evidência citada do manifest]

## Anomalias amostradas (5 outcomes auditados)
[outcomes com decisão agente vs gabarito humano lado a lado]

## Recomendações
[ações priorizadas]

## Próxima auditoria: {YYYY-MM-DD}
```

### 5.2. Output machine-readable

**Arquivo**: `docs/foundry/audits/{YYYY-MM-DD}-monthly.json`

```json
{
  "audit_date": "2026-05-31",
  "reviewer": "deepagents-gpt-5.5",
  "constitution_version": "0.1.0",
  "manifest_version": "0.3.2",
  "checks": [
    {"id": "C1", "status": "PASS", "evidence": "..."},
    {"id": "C3", "status": "WARN", "evidence": "razão custo/preço = 24.8% (limiar 25%)"}
  ],
  "drift_detected": false,
  "skus_audited": ["example-triagem-whatsapp"],
  "outcomes_sampled": 47,
  "issues_opened": []
}
```

### 5.3. Issues acionáveis

Quando encontrar FAIL, reviewer **abre issue** (GitHub ou tabela DB) com:
- Título conciso
- Check violado (referência Constitution)
- Evidência (path + linha do artefato problemático)
- Severidade (P0/P1/P2)
- Owner sugerido (PO Guardian, SKU Architect, etc.)

---

## 6. Garantias do framework para o reviewer

Para o reviewer funcionar de forma confiável, o Foundry **garante**:

1. **Manifest sempre fresh**: hook `manifest-sync` atualiza em todo commit que toca `.claude/`, `docs/foundry/`, `src/skus/`, `evals/`
2. **Versionamento explícito**: cada artefato no manifest tem `version` e `sha256`
3. **Read-only access**: reviewer **nunca** edita arquivos do projeto — só lê e gera novos arquivos em `docs/foundry/audits/`
4. **Idempotência**: rodar o reviewer 2x no mesmo dia produz output idêntico (a menos que dados de produção mudem)
5. **Bypass auditado**: se algum dev usar `NOVAIS_FOUNDRY_BYPASS=incident`, fica registrado em `docs/foundry/bypass-log/` que o reviewer **lê e cita** no próximo relatório

---

## 7. O que o reviewer NÃO faz (out-of-scope)

- ❌ Não bloqueia merges (isso é trabalho dos hooks Claude Code)
- ❌ Não substitui code review humano de PRs
- ❌ Não toma decisões automáticas (não promove subscription, não muda pricing)
- ❌ Não acessa dados sensíveis de tenants além do necessário para sample auditing
- ❌ Não executa código (só lê estado e logs)

---

## 8. Sequência de execução padrão (mensal)

```
1. Hook ou cron dispara reviewer no último dia útil do mês
2. Reviewer faz fetch:
   - manifest.json
   - constitution
   - últimos 30d de outcomes (DB query read-only)
   - traces Langfuse correspondentes
   - eval reports
3. Reviewer gera plano de auditoria (Deep Agent planning step)
4. Reviewer roda os checks (4.1, 4.2, 4.3) em ordem
5. Reviewer amostra 5–10% dos outcomes e re-classifica
6. Reviewer compara classificação humana (gabarito) vs agente vs reviewer
7. Reviewer gera relatório markdown + JSON
8. Reviewer commita relatório em docs/foundry/audits/ via PR (não direto na main)
9. Reviewer notifica CEO + Tech Lead (canal a definir)
```

---

## 9. Versionamento deste contrato

Mudanças neste contrato exigem:
- Nova ADR (ADR-003+ na sequência)
- Atualização da `version` do reviewer no manifest
- Comunicação ao reviewer (via update do prompt do Deep Agent)

---

## 10. Estado atual (2026-04-30)

- ✅ Contrato especificado (este documento)
- ⏳ Implementação técnica: Foundry-3 (ADR-002)
- ⏳ Primeira auditoria de teste: após Foundry-3 concluído
- ⏳ Primeira auditoria real: 1 mês após primeiro SKU em SHADOW
