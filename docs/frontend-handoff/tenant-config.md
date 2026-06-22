# Frontend Handoff — tenant-config

## Responsabilidade
Configurações do tenant: produto (JSONB), papéis de membros e tokens de API.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/config` | Configurações do tenant |
| PATCH | `/config` | Atualizar configurações do produto |
| PATCH | `/config/members/{userId}/role` | Alterar papel de membro |
| GET | `/config/tokens` | Listar tokens de API |
| POST | `/config/tokens` | Criar token de API |
| DELETE | `/config/tokens/{tokenId}` | Revogar token |

## Contrato
- OpenAPI: `docs/contracts/tenant-config.openapi.yml`
- Zod: `docs/contracts/tenant-config.zod.ts`

## Fluxo esperado na UI
1. "Configurações > Produto" edita `monthlyAnalysis.toneOfVoice`, `customInstructions`, `minEntries`.
2. "Configurações > Membros" altera papéis.
3. "Configurações > API" cria/revoga tokens com escopos.

## Estados importantes
- `minEntries`: mínimo de lançamentos para acionar pipeline de IA (default 50).
