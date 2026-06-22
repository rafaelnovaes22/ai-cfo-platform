# Frontend Handoff — workspace-setup

## Responsabilidade
Perfil do tenant (empresa) e gerenciamento de membros do workspace.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/workspace/profile` | Dados do tenant |
| PATCH | `/workspace/profile` | Atualizar nome, CNPJ, segmento e regime tributário |
| GET | `/workspace/members` | Lista de membros |
| POST | `/workspace/members` | Convidar membro (gera senha temporária) |
| DELETE | `/workspace/members/{userId}` | Remover membro |

## Contrato
- OpenAPI: `docs/contracts/workspace-setup.openapi.yml`
- Zod: `docs/contracts/workspace-setup.zod.ts`

## Fluxo esperado na UI
1. Após primeiro login, wizard de onboarding pede nome da empresa, segmento e regime tributário.
2. Tela "Configurações > Workspace" permite editar perfil e convidar membros.
3. Apenas `admin` convida/remove membros (validado no backend pelo escopo).

## Estados importantes
- `industrySegment`: usado pelo pipeline de IA para contextualizar classificação/narrativa.
- `taxRegime`: afeta agregação do DRE.
