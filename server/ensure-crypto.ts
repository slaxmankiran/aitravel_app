import nodeCrypto from "crypto";

// Polyfill `globalThis.crypto.hash(alg, text, encoding)` using Node's
// legacy `createHash` on older Node versions where `crypto.hash` is not present.
const gcrypto = (globalThis as any).crypto;
if (!gcrypto) {
  // If no crypto at all, create a minimal object.
  (globalThis as any).crypto = {
    hash: (alg: string, text: string, encoding: BufferEncoding) => {
      const h = nodeCrypto.createHash(alg);
      h.update(text);
      return h.digest(encoding);
    },
  };
} else if (typeof gcrypto.hash !== "function") {
  try {
    Object.defineProperty(gcrypto, "hash", {
      value: (alg: string, text: string, encoding: BufferEncoding) => {
        const h = nodeCrypto.createHash(alg);
        h.update(text);
        return h.digest(encoding);
      },
      configurable: true,
      writable: true,
    });
  } catch (e) {
    // If we cannot define the property, ignore — Vite will likely fail later.
  }
}

  // Also shim the top-level Node `crypto.hash` function if missing (some
  // Vite builds import `crypto` directly and call `crypto.hash(...)`).
  try {
    if (typeof (nodeCrypto as any).hash !== "function") {
      (nodeCrypto as any).hash = (alg: string, text: string, encoding: BufferEncoding) => {
        const h = nodeCrypto.createHash(alg);
        h.update(text);
        return h.digest(encoding);
      };
    }
  } catch (e) {
    // ignore
  }

  export {};
