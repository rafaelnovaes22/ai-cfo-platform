import { describe, it, expect, vi } from "vitest";
import type IORedis from "ioredis";
import { claimMessage, releaseMessage } from "@/channels/whatsapp/dedup.js";

vi.mock("@/observability/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Redis fake com semântica SET NX: retorna "OK" só se a chave ainda não existe.
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: vi.fn(async (key: string, val: string, _ex: string, _ttl: number, nx?: string) => {
      if (nx === "NX" && store.has(key)) return null;
      store.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

function asRedis(fake: ReturnType<typeof fakeRedis>): IORedis {
  return fake as unknown as IORedis;
}

describe("whatsapp/dedup — claimMessage", () => {
  it("primeira reivindicação é 'new', segunda do mesmo id é 'duplicate'", async () => {
    const r = fakeRedis();
    expect(await claimMessage("wamid.123", asRedis(r))).toBe("new");
    expect(await claimMessage("wamid.123", asRedis(r))).toBe("duplicate");
  });

  it("ids diferentes são ambos 'new'", async () => {
    const r = fakeRedis();
    expect(await claimMessage("wamid.A", asRedis(r))).toBe("new");
    expect(await claimMessage("wamid.B", asRedis(r))).toBe("new");
  });

  it("messageId vazio retorna 'new' sem tocar no Redis", async () => {
    const r = fakeRedis();
    expect(await claimMessage("", asRedis(r))).toBe("new");
    expect(r.set).not.toHaveBeenCalled();
  });

  it("fail-open: erro no Redis retorna 'new' (não bloqueia o fluxo)", async () => {
    const r = fakeRedis();
    r.set.mockRejectedValueOnce(new Error("redis down"));
    expect(await claimMessage("wamid.X", asRedis(r))).toBe("new");
  });
});

describe("whatsapp/dedup — releaseMessage", () => {
  it("libera o id, permitindo reivindicação nova depois", async () => {
    const r = fakeRedis();
    await claimMessage("wamid.R", asRedis(r));
    expect(await claimMessage("wamid.R", asRedis(r))).toBe("duplicate");
    await releaseMessage("wamid.R", asRedis(r));
    expect(await claimMessage("wamid.R", asRedis(r))).toBe("new");
  });

  it("messageId vazio não chama del", async () => {
    const r = fakeRedis();
    await releaseMessage("", asRedis(r));
    expect(r.del).not.toHaveBeenCalled();
  });
});
