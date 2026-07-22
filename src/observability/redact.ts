// Mascaramento de PII para traces de observabilidade (C6 + LGPD — ADR-021).
//
// IMPORTANTE: aplica-se APENAS ao que é enviado ao tracer (LangSmith), nunca ao
// prompt real entregue ao modelo — o LLM precisa dos dados íntegros para
// classificar/normalizar. A redação acontece no momento de anexar input/output
// ao trace, não muta o LlmRequest.
//
// Escopo (ADR-021): identificadores diretos mais críticos no domínio financeiro
// brasileiro — CPF, CNPJ, e-mail e telefone. NÃO cobre nomes próprios em texto
// livre (ex: "Pagamento João Silva"), pois regex de nome é não-confiável; essa
// é uma limitação consciente, mitigável no futuro por NER ou por desligar o
// input verbatim no trace. Valores monetários NÃO são redigidos: são o dado de
// negócio da análise e não identificam pessoa (caixa em texto tem tratamento
// próprio na ADR-018).

// E-mail: padrão usual. Primeiro, pois não conflita com os numéricos.
const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// CNPJ (14 dígitos) — ANTES do CPF, senão o CPF (11) casa o prefixo do CNPJ.
const CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;

// CPF (11 dígitos), com ou sem pontuação.
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

// Telefone BR com DDD: exige marca de formatação (+55, parênteses no DDD ou
// hífen no número) para não capturar valores/quantidades soltos. Por último.
const PHONE_BR = /(?:\+?55\s?)?(?:\(\d{2}\)\s?|\b\d{2}\s)?9?\d{4}-\d{4}\b/g;

/**
 * Substitui identificadores pessoais por placeholders, preservando o resto do
 * texto (descrições de lançamentos continuam legíveis para debug). Idempotente.
 */
export function redactPii(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL, "[email]")
    .replace(CNPJ, "[cnpj]")
    .replace(CPF, "[cpf]")
    .replace(PHONE_BR, "[telefone]");
}
