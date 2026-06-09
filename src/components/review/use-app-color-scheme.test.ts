import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAppColorScheme } from "./use-app-color-scheme";

describe("useAppColorScheme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light when the dark class is absent", () => {
    const { result } = renderHook(() => useAppColorScheme());
    expect(result.current).toBe("light");
  });

  it("reflects the dark class and reacts to changes", async () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useAppColorScheme());
    expect(result.current).toBe("dark");

    await act(async () => {
      document.documentElement.classList.remove("dark");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current).toBe("light");
  });
});
