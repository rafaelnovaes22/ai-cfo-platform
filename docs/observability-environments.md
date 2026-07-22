# Observabilidade — separação por ambiente (C6)

> Pré-requisito para a auditoria mensal (`/novais-digital:audit-monthly`) ser confiável em produção.
> Sem isso, traces de produção, staging, eval e dev caem todos no mesmo projeto LangSmith e a
> amostragem mistura outcome de cliente com ruído de teste — corrompendo agreement, custo e latência.

## Como a separação funciona

Dois mecanismos complementares (ver [src/observability/tracing.ts](../src/observability/tracing.ts)):

1. **Projeto LangSmith por ambiente** — mecanismo primário. Cobre tanto os traces do `createTrace`
   quanto os auto-instrumentados pelo LangChain/LangGraph (ambos leem `LANGSMITH_PROJECT`).
   Default no código: `aicfo-${APP_ENV}` quando `LANGSMITH_PROJECT` não está setado.
2. **Tag `metadata.env`** — filtro secundário em todo trace criado via `createTrace`, derivado de
   `APP_ENV`.

`APP_ENV` é resolvido de: `APP_ENV` > `RAILWAY_ENVIRONMENT` > `NODE_ENV` > `"local"`.

## Matriz de configuração (ação no Railway / CI)

Cada serviço/ambiente deve setar **`LANGSMITH_PROJECT`** (e idealmente **`APP_ENV`**):

| Ambiente | Onde | `LANGSMITH_PROJECT` | `APP_ENV` |
|---|---|---|---|
| Produção (backend `main`) | Railway — serviço backend prod | `aicfo-prod` | `production` |
| Homologação (backend `staging`) | Railway — serviço backend staging | `aicfo-staging` | `staging` |
| CI / eval | `.github/workflows/ci.yml` (já usa `aicfo-ci`) | `aicfo-ci` | `ci` |
| Local dev | `.env` do dev | `aicfo-dev` | `local` |

> O projeto histórico `Aicfo` contém os dados misturados pré-separação. A partir da adoção,
> a auditoria de produção lê **`aicfo-prod`**, que nasce limpo.

## Como a auditoria consome

O coletor de runtime aponta para o projeto de produção:

```bash
LANGSMITH_PROJECT=aicfo-prod npm run audit:collect:traces -- YYYY-MM
```

Com a tag `metadata.env`, é possível filtrar produção mesmo se um trace escapar para outro projeto.

## Checklist de adoção

- [ ] `LANGSMITH_PROJECT=aicfo-prod` + `APP_ENV=production` no serviço backend de produção (Railway)
- [ ] `LANGSMITH_PROJECT=aicfo-staging` + `APP_ENV=staging` no serviço backend de staging (Railway)
- [ ] CI já em `aicfo-ci` (confirmar)
- [ ] `.env` local com `LANGSMITH_PROJECT=aicfo-dev`
- [ ] Primeira auditoria pós-launch rodando contra `aicfo-prod`
