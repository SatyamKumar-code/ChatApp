import '@testing-library/jest-dom';

// Polyfill window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Ensure localStorage is available
  if (!window.localStorage) {
    const storage = {};
    window.localStorage = {
      getItem: (k) => storage[k] ?? null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
    };
  }

  // Ensure Web Crypto API is mapped in JSDOM
  if (!window.crypto || !window.crypto.subtle) {
    window.crypto = globalThis.crypto;
  }
}
