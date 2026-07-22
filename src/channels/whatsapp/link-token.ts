// link-token.ts — whatsapp-channel
// Token de vinculação WhatsApp ↔ conta Aicfo (JWT HS256, 1h).
// O magic link enviado no WhatsApp carrega este token; a página /whatsapp/auth
// do frontend o envia para POST /whatsapp/link, que grava o número no tenant logado.

import { SignJWT, jwtVerify } from "jose"

function key(): Uint8Array {
  const secret = process.env["JWT_SECRET"]
  if (!secret) throw new Error("JWT_SECRET não configurado")
  return new TextEncoder().encode(secret)
}

/** Gera o token de vinculação (1h) para um número E.164 (com ou sem '+'). */
export async function signWhatsAppLinkToken(phone: string): Promise<string> {
  return new SignJWT({ whatsappPhone: phone, purpose: "whatsapp_link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key())
}

/** Valida o token e devolve o número. Lança se inválido/expirado/propósito errado. */
export async function verifyWhatsAppLinkToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, key())
  if (payload["purpose"] !== "whatsapp_link" || typeof payload["whatsappPhone"] !== "string") {
    throw new Error("Token de vinculação inválido")
  }
  return payload["whatsappPhone"]
}

const DEFAULT_APP_URL = "https://app.example.com"

/**
 * Base URL do frontend para montar links enviados no WhatsApp.
 * Reusa APP_URL (mesma var dos redirects de Stripe/password-reset); aceita
 * APP_BASE_URL como alternativa e cai no placeholder de exemplo em dev.
 */
export function appBaseUrl(): string {
  const configuredUrl = process.env["APP_URL"] ?? process.env["APP_BASE_URL"] ?? DEFAULT_APP_URL
  return configuredUrl.replace(/\/$/, "")
}
