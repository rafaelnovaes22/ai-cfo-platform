import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normaliza um telefone BR para E.164 (+55DDDNNNNNNNN). Retorna undefined quando
// o formato não é reconhecido — evita enviar dígitos sem '+' que o backend rejeita.
export const addCountryCode = (phone: string): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  // Já inclui o código do país (55) — fixo (12) ou celular (13).
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return "+" + digits;
  }
  // Sem país: fixo (10) ou celular (11) — prefixa +55.
  if (digits.length === 10 || digits.length === 11) {
    return "+55" + digits;
  }
  return undefined;
};
