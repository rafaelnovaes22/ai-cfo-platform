import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const addCountryCode = (phone: string) => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return "+55" + digits;
  }
  return digits;
};
