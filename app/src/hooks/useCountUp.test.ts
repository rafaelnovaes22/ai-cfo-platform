import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCountUp } from "./useCountUp";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCountUp", () => {
  it("devolve o alvo direto com reduced-motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { result } = renderHook(() => useCountUp(1234.56));
    expect(result.current).toBe(1234.56);
  });

  it("anima de 0 até o alvo", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    let saved: FrameRequestCallback = () => {};
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      saved = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const { result } = renderHook(() => useCountUp(200, 1000));
    expect(result.current).toBe(0);
    act(() => {
      now = 1000;
      saved(now);
    });
    expect(result.current).toBe(200);
  });
});
