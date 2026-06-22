# Frontend staging do Aicfo

Objetivo: ter um serviço Railway separado para validar o frontend antes de promover para produção.

## Serviço Railway esperado

- Serviço: `aicfo-app-staging`
- Repo: `acme-startup/aicfo`
- Branch: `staging`
- Root directory: `app`
- Config: `app/railway.toml`
- Domain sugerido: Railway-generated domain para staging frontend

## Variáveis obrigatórias

```bash
VITE_API_URL=https://aicfo-staging-production.up.railway.app
```

`VITE_API_URL` é lido em runtime via `/env.js`. Isso evita rebuild só para trocar API e permite usar a mesma imagem para prod/staging.

## Validação rápida

Depois do deploy:

```bash
FRONTEND_STAGING_URL="https://<frontend-staging>.up.railway.app" \
EXPECTED_API_URL="https://aicfo-staging-production.up.railway.app" \
node scripts/validate-frontend-staging.mjs
```

Checks:

- `/` responde `200`
- `/env.js` existe
- `/env.js` aponta para API staging
- HTML carrega assets JS/CSS
- API staging `/health` responde `200`

## Risco que isso corrige

Antes, o frontend público estava buildado apontando para `https://aicfo-api-production.up.railway.app`. Com runtime config, um frontend staging pode apontar para staging sem alterar código nem rebuildar imagem.
