-- CreateIndex
-- Unicidade do número WhatsApp por tenant (evita roteamento cross-tenant).
-- Índice único em coluna nullable: o Postgres trata NULLs como distintos,
-- então múltiplos tenants sem número (NULL) seguem permitidos.
CREATE UNIQUE INDEX "Tenant_whatsappPhone_key" ON "Tenant"("whatsappPhone");
