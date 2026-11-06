// The browser-like globals the wasm-bindgen glue reaches for, built on the natives harness.cpp
// defines. React Native provides its own versions of these; this file is only for the harness.

declare global {
  var __harnessPrint: (line: string) => void;
  var __harnessNow: () => number;
  var __harnessFillRandom: (
    buffer: ArrayBufferLike,
    byteOffset: number,
    byteLength: number,
  ) => void;
  var __harnessExitCode: number | undefined;
}

function format(values: unknown[]): string {
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value instanceof Error) return `${value.message}\n${value.stack ?? ""}`;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(" ");
}

const print = globalThis.__harnessPrint;
const log = (...values: unknown[]): void => print(format(values));

Object.defineProperty(globalThis, "console", {
  configurable: true,
  value: { log, info: log, debug: log, warn: log, error: log, trace: log },
});
Object.defineProperty(globalThis, "performance", {
  configurable: true,
  value: { now: globalThis.__harnessNow },
});
Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: {
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      globalThis.__harnessFillRandom(array.buffer, array.byteOffset, array.byteLength);
      return array;
    },
  },
});

for (const name of ["TextEncoder", "TextDecoder", "queueMicrotask"]) {
  if (!(name in globalThis)) throw new Error(`this Hermes build has no ${name}; the glue needs it`);
}

export {};
