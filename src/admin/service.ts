import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

const BCRYPT_ROUNDS = 12;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class AdminError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AdminError";
    this.statusCode = statusCode;
  }
}

export async function createTenant(data: {
  tenantName: string;
  cnpj?: string;
  email: string;
  name: string;
  phone?: string;
  industrySegment?: string;
  taxRegime?: string;
  plan?: "lite" | "pro" | "business";
  mode?: "shadow" | "assisted" | "autonomous";
}): Promise<{
  tenantId: string;
  userId: string;
  email: string;
  tempPassword: string;
  plan: string;
  mode: string;
  status: "active";
}> {
  const db = getPrisma();
  const tempPassword = randomBytes(8).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const plan = data.plan ?? "business";
  const mode = data.mode ?? "autonomous";

  try {
    const { tenant, user } = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.tenantName,
          cnpj: data.cnpj,
          whatsappPhone: data.phone,
          industrySegment: data.industrySegment ?? "geral",
          taxRegime: data.taxRegime ?? "simples",
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizeEmail(data.email),
          passwordHash,
          name: data.name,
          role: "admin",
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan,
          mode,
          status: "active",
        },
      });

      return { tenant, user };
    });

    logger.info(
      { tenantId: tenant.id, userId: user.id, plan, mode },
      "Tenant premium criado via admin",
    );

    return {
      tenantId: tenant.id,
      userId: user.id,
      email: user.email,
      tempPassword,
      plan,
      mode,
      status: "active" as const,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(",")
        : String(err.meta?.target ?? "");
      if (target.includes("whatsappPhone")) {
        throw new AdminError("Número de WhatsApp já vinculado a outra conta", 409);
      }
      if (target.includes("cnpj")) {
        throw new AdminError("CNPJ já cadastrado", 409);
      }
      throw new AdminError("E-mail já cadastrado", 409);
    }
    throw err;
  }
}

export async function listTenants(opts: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<{
  tenants: Array<{
    tenantId: string;
    name: string;
    cnpj: string | null;
    plan: string;
    mode: string;
    status: string;
    createdAt: string;
  }>;
  total: number;
}> {
  const db = getPrisma();
  const where = opts.search
    ? {
        OR: [
          { name: { contains: opts.search, mode: "insensitive" as const } },
          { cnpj: { contains: opts.search } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        cnpj: true,
        createdAt: true,
        subscriptions: { select: { plan: true, mode: true, status: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    db.tenant.count({ where }),
  ]);

  return {
    tenants: rows.map((r) => ({
      tenantId: r.id,
      name: r.name,
      cnpj: r.cnpj,
      plan: r.subscriptions[0]?.plan ?? "trial",
      mode: r.subscriptions[0]?.mode ?? "assisted",
      status: r.subscriptions[0]?.status ?? "active",
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  };
}
