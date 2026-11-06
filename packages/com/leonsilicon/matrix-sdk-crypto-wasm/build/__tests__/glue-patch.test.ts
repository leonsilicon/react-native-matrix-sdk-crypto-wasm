import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import { patchGlue } from "#glue-patch";

// The three memory caches as wasm-bindgen 0.2.128 emits them.
const GLUE = `
let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}
let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}
let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}
`;

test("every memory cache refreshes when wasm.memory.buffer changes", () => {
  const patched = patchGlue(GLUE);
  assert.ok(!patched.includes("byteLength === 0"));
  assert.ok(!patched.includes("detached"));
  for (const name of [
    "cachedDataViewMemory0",
    "cachedUint16ArrayMemory0",
    "cachedUint8ArrayMemory0",
  ]) {
    assert.ok(patched.includes(`${name} === null || ${name}.buffer !== wasm.memory.buffer`), name);
  }
});

test("a stale view is replaced once the buffer object changes", () => {
  const patched = patchGlue(GLUE);
  const wasm = { memory: { buffer: new ArrayBuffer(8) } };
  const getView = runInNewContext(`${patched}; getUint8ArrayMemory0`, {
    wasm,
    Uint8Array,
  }) as () => Uint8Array;
  assert.equal(getView().length, 8);
  wasm.memory.buffer = new ArrayBuffer(16); // what the bridge does when memory grows
  assert.equal(getView().length, 16);
});

test("fails when the DataView check is not the expected shape", () => {
  assert.throws(
    () => patchGlue(GLUE.replace("detached === true", "detached")),
    /DataView memory cache check changed/,
  );
});
