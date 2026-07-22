# Olá — O que é o Aicfo e como usar com o Claude

Bem-vindo ao projeto **Aicfo**. Este arquivo é para quem está começando — sem necessidade de conhecer detalhes técnicos.

---

## O que é o Aicfo?

É um **CFO de IA para pequenas e médias empresas**. O cliente entra na plataforma, importa os lançamentos financeiros do mês (planilha, PDF do contador ou digitação manual) e em minutos recebe:

- **DRE Facilitado** — resultado do mês em linguagem simples
- **Narrativa da IA** — o que aconteceu, por quê, o que mudou
- **Plano de Ação** — 3 horizontes de ação concretos

O objetivo é substituir o trabalho do consultor financeiro caro pelo agente de IA auditável.

---

## Qual é o status hoje?

| Componente | Situação |
|---|---|
| `monthly-analysis` (SKU piloto) | Em desenvolvimento — **SHADOW** (Rafael revisa antes de entregar) |
| Ondas 2-8 (cashflow, KPIs, decisões…) | Planejadas — bloqueadas até `monthly-analysis` chegar em AUTONOMOUS |

**SHADOW** = agente já processa, mas o resultado vai para revisão humana antes de chegar ao cliente.
Quando a qualidade for consistente, promovemos para **ASSISTED** (cliente recebe, mas pode editar) e depois **AUTONOMOUS** (entrega direta, cliente audita amostra).

---

## O que posso pedir ao Claude?

### Entender o projeto
> "Qual é o status atual do monthly-analysis?"
> "O que falta para sair de SHADOW para ASSISTED?"
> "Quais módulos estão planejados para a Onda 2?"

### Tomar decisões
> "Precisamos mudar o prompt de classificação. Como isso afeta o custo e o eval?"
> "Vale antecipar a Onda 2 ou terminamos o SKU piloto primeiro?"

### Acompanhar qualidade
> "Tem alguma violação de Constitution pendente?"
> "O custo de inferência por análise está dentro dos 25%?"

---

## O que o Claude NÃO faz automaticamente

- **Promover de SHADOW para ASSISTED** — sempre pede confirmação + revisão humana
- **Mudar prompts aprovados** — mudança de prompt exige novo hash + re-eval
- **Cobrar do cliente** — só depois que o modo ASSISTED for validado

---

## Para ir fundo

- [CLAUDE.md](CLAUDE.md) — guia completo para desenvolvedores
- [docs/foundry/project.json](docs/foundry/project.json) — configuração do projeto
- [src/skus/monthly-analysis/spec.md](src/skus/monthly-analysis/spec.md) — spec do SKU piloto
- [QUICKSTART_DEV.md](QUICKSTART_DEV.md) — como rodar localmente
