import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(s);
}

export interface AccessTokenPayload {
  sub: string;   // userId
  tid: string;   // tenantId
  role: string;  // UserRole
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ tid: payload.tid, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "15m")
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: payload.sub as string,
    tid: payload["tid"] as string,
    role: payload["role"] as string,
  };
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString("hex");
}
