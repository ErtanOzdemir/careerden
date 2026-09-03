import "@testing-library/jest-dom/vitest";

const entries = new Map<string, string>();

const testLocalStorage: Storage = {
  clear() {
    entries.clear();
  },
  getItem(key) {
    return entries.get(key) ?? null;
  },
  key(index) {
    return [...entries.keys()][index] ?? null;
  },
  get length() {
    return entries.size;
  },
  removeItem(key) {
    entries.delete(key);
  },
  setItem(key, value) {
    entries.set(key, value);
  },
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: testLocalStorage,
});

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: TestResizeObserver,
});
