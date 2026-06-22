# Frontend Handoff — auth-tenant

## Responsabilidade
Cadastro, login, refresh de token, reset de senha e identificação do usuário logado.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| POST | `/auth/register` | Criar tenant + usuário administrador |
| POST | `/auth/login` | Autenticar e receber access/refresh tokens |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/auth/logout` | Invalidar refresh token |
| GET | `/auth/me` | Dados do usuário logado, plano e status de assinante |
| POST | `/auth/password-reset/request` | Solicitar email de reset |
| POST | `/auth/password-reset/confirm` | Definir nova senha via token |

## Contrato
- OpenAPI: `docs/contracts/auth-tenant.openapi.yml`
- Zod: `docs/contracts/auth-tenant.zod.ts`

## Fluxo esperado na UI
1. **Landing** → CTA "Começar grátis" → `/auth/register`.
2. Após registro, redirecionar para `/login` (ou logar automaticamente).
3. Login salva `accessToken` (curta duração) e `refreshToken` (httpOnly cookie ou secure storage).
4. `GET /auth/me` define se o usuário é assinante (`isSubscriber`). Leads (trial/student) são redirecionados para `/planos` ou veem teaser.
5. Token expirado → `POST /auth/refresh` em 401; se falhar, redirecionar para login.

## Estados importantes
- `isSubscriber === false`: usuário não acessa rotas protegidas de análise (gate no backend + frontend).
- `subscriptionStatus`: `active`, `trialing`, `past_due`, `canceled`.

## Telas relacionadas
- `/login`
- `/register`
- `/esqueci-senha`
- `/redefinir-senha`
