---
# Novais Digital Foundry — Skill Learnings Template
# Aprendizados procedurais específicos de um projeto consumer.
# Instalar em: docs/clients/{client_id}/learned-skills/{skill-name}.md
# NÃO substitui skills canônicas em .claude/skills/ — apenas complementa com contexto local.
# Princípios: C5 (fica em Tier 1/2 de dados, nunca em .claude/skills/), C8 (is_client_specific=true)
#
# Quando criar:
#   - Após 5+ execuções de um pattern repetitivo neste projeto
#   - Quando um skill canônico precisar de adaptação local (ex: checklist extra)
#   - Quando um padrão de integração for específico demais para o skill canônico
#
# Quando NÃO criar:
#   - Para padrões genéricos → propor PR ao .claude/skills/ canônico
#   - Para lógica de negócio hardcoded por tenant → violação C8
---

# Skill Learnings — {skill_name} ({project_name})

> Aprendizados procedurais específicos do projeto **{project_name}** para o skill **{skill_name}**.
> `is_client_specific: true` — nunca propagar para outros projetos sem generalização.
> Gerado por `learning-curator` após análise dos learning snapshots (Foundry-20).

## Metadados

- **Skill base**: {base_skill_path} (ex: `.claude/skills/L1/diagnostic-runner.md`)
- **Projeto**: {project_name}
- **Client ID**: {client_id}
- **Criado em**: {created_date}
- **Última atualização**: {updated_date}
- **Confidence**: {confidence} (local | shadow | assisted | autonomous)
- **Source runs**: {source_run_ids}

## Adaptações locais

O que este projeto faz de diferente do skill canônico.

```
{adaptations}
```

<!-- Exemplo para diagnostic-runner no projeto SchoolPlatform:
- Sempre incluir seção "Módulos Railway" no diagnostic (plataforma usa Railway exclusivamente)
- Verificar se `fly.toml` existe (legado de migração Fly→Railway) — se sim, marcar como OBSOLETO
- Volume estimado de usuários: 500-2000 MAU (tier pequeno para fins de economics)
-->

## Checklist adicional

Passos extras que este projeto sempre precisa além do skill canônico.

- [ ] {extra_step_1}
- [ ] {extra_step_2}

<!-- Exemplo:
- [ ] Verificar se .env.railway está sincronizado com Railway dashboard vars
- [ ] Confirmar que drizzle-kit generate rodou antes de qualquer push de schema
- [ ] Checar se webhook URL no Stripe está apontando para o env correto (prod vs staging)
-->

## Exemplos de eval cases (projeto-específicos)

Casos de eval adicionais que o eval-engineer guardian deve incluir para este projeto.

```jsonl
{"input": "{example_input}", "expected": "{example_output}", "category": "{category}", "source": "client_specific", "project": "{client_id}"}
```

<!-- Exemplo:
{"input": "Usuário cancela assinatura durante período de trial", "expected": "Webhook Stripe `customer.subscription.deleted` processado, acesso revogado em ≤5min", "category": "billing_lifecycle", "source": "client_specific", "project": "school-platform"}
-->

## Padrões de integração

Sequências de operações específicas deste projeto que funcionam de forma confiável.

```
{integration_patterns}
```

<!-- Exemplo:
1. Deploy Railway: git push main → GH Actions valida → Railway autodeploy (~3min)
2. Migração DB: drizzle-kit generate → code review → drizzle-kit push (nunca em prod sem staging primeiro)
3. Vars de ambiente: Railway dashboard → Settings → Variables (não usar .env em prod)
-->

## Antipatterns confirmados

O que já foi tentado e NÃO funciona neste projeto.

```
{antipatterns}
```

<!-- Exemplo:
- ❌ Usar setTimeout(fn, 0) para "garantir" ordem de execução — causa race conditions em Railway
- ❌ Fazer queries N+1 sem pool — Railway PostgreSQL tem limite de conexões no plano atual
- ❌ Commitar diretamente em main — CI bloqueia, todo trabalho via branch + PR
-->
