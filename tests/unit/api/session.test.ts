import { afterEach, describe, expect, test } from "bun:test";

import { TOKEN_KEY, clearToken, getToken, setToken } from "../../../packages/app/src/api/session";

/** A stand-in for window.localStorage on the web. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const global = globalThis as { localStorage?: unknown };

afterEach(() => {
  clearToken();
  delete global.localStorage;
});

describe("session token on the web (localStorage)", () => {
  test("setToken stores it, clearToken removes it", () => {
    const storage = fakeStorage();
    global.localStorage = storage;

    setToken("abc");
    expect(getToken()).toBe("abc");
    expect(storage.data.get(TOKEN_KEY)).toBe("abc");

    clearToken();
    expect(getToken()).toBeNull();
    expect(storage.data.has(TOKEN_KEY)).toBe(false);
  });

  test("a token stored by an earlier visit is read back, so a reload stays logged in", () => {
    clearToken();
    global.localStorage = fakeStorage({ [TOKEN_KEY]: "from-last-visit" });

    expect(getToken()).toBe("from-last-visit");
  });

  test("the key is travel-expenses.token", () => {
    expect(TOKEN_KEY).toBe("travel-expenses.token");
  });

  test("blocked storage that throws still keeps the token in memory", () => {
    global.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(getToken()).toBeNull();
    setToken("abc");
    expect(getToken()).toBe("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe("session token on iOS and Android (no localStorage)", () => {
  test("the token lives in memory only", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });
});
