import { describe, it, expect } from "vitest";
import { withTimeout } from "@/llm/index.js";

describe("withTimeout", () => {
  it("retorna o resultado quando fn resolve antes do timeout", async () => {
    const result = await withTimeout(async () => "ok", 1000, "task-a");
    expect(result).toBe("ok");
  });

  it("rejeita com erro llm_timeout quando fn excede o tempo", async () => {
    await expect(
      withTimeout(() => new Promise((res) => setTimeout(() => res("late"), 200)), 20, "slow-task"),
    ).rejects.toThrow(/llm_timeout: slow-task excedeu 20ms/);
  });

  it("aborta o AbortSignal passado à fn quando estoura o timeout", async () => {
    let aborted = false;
    await expect(
      withTimeout((signal) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise((res) => setTimeout(() => res("late"), 200));
      }, 20, "task-b"),
    ).rejects.toThrow();
    expect(aborted).toBe(true);
  });

  it("não dispara timeout quando fn resolve rápido", async () => {
    const result = await withTimeout(
      () => new Promise<string>((res) => setTimeout(() => res("fast"), 5)),
      1000,
      "task-c",
    );
    expect(result).toBe("fast");
  });

  it("propaga o erro original quando fn rejeita antes do timeout", async () => {
    await expect(
      withTimeout(async () => {
        throw new Error("boom");
      }, 1000, "task-d"),
    ).rejects.toThrow("boom");
  });
});
