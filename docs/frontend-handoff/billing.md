# Frontend Handoff — billing

## Responsabilidade
Assinatura, checkout Stripe, portal de gerenciamento e webhooks (servidor).

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/billing/subscription` | Estado atual da assinatura |
| POST | `/billing/checkout` | Criar sessão Stripe Checkout para plano lite/pro/business |
| POST | `/billing/portal` | Abrir portal de gerenciamento Stripe |

## Contrato
- OpenAPI: `docs/contracts/billing.openapi.yml`
- Zod: `docs/contracts/billing.zod.ts`

## Fluxo esperado na UI
1. Tela `/planos` mostra cards dos planos.
2. CTA "Assinar" chama `POST /billing/checkout` e redireciona para `checkoutUrl`.
3. Após pagamento, Stripe redireciona para `/billing/success` (backend atualiza status).
4. Usuário pode gerenciar assinatura em "Configurações > Faturamento" via `POST /billing/portal`.

## Estados importantes
- `mode`: `shadow`, `pilot`, `assisted`, `autonomous`.
- `status`: `active`, `trialing`, `past_due`, `canceled`.
