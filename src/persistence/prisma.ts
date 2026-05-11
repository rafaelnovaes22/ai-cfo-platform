import { PrismaClient } from "@prisma/client";

let _client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return _client;
}

export async function disconnectPrisma(): Promise<void> {
  await _client?.$disconnect();
}
