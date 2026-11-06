// wasm-bindgen's glue caches typed-array views of the module's memory and refreshes them only
// when the old `ArrayBuffer` is detached (`byteLength === 0`), which is what a real
// WebAssembly.Memory does to its buffer when it grows. The native bridge cannot detach a JSI
// ArrayBuffer, so after growth it publishes a new, longer `memory.buffer` instead. These patches
// make every cache compare buffer identity, so a stale, too-short view is never reused.

const DATA_VIEW_CHECK =
  "cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)";
const TYPED_ARRAY_CHECK = /\b(cached\w+Memory0)\.byteLength === 0\b/g;
const CACHE_GUARD = /if \((cached\w+Memory0) === null \|\| ([^)]*\)?)\) \{/g;

export function patchGlue(source: string): string {
  if (source.split(DATA_VIEW_CHECK).length !== 2) {
    throw new Error("glue-patch: the DataView memory cache check changed; recheck patchGlue");
  }
  let patched = source.replace(
    DATA_VIEW_CHECK,
    "cachedDataViewMemory0.buffer !== wasm.memory.buffer",
  );
  patched = patched.replace(TYPED_ARRAY_CHECK, "$1.buffer !== wasm.memory.buffer");

  // Every memory cache must now refresh on a buffer change. Fail the build rather than ship a
  // glue file with a cache this patch did not understand.
  const guards = [...patched.matchAll(CACHE_GUARD)];
  if (guards.length === 0) {
    throw new Error("glue-patch: found no memory caches; the glue layout changed");
  }
  for (const [guard, name] of guards) {
    if (!guard.includes(`${name}.buffer !== wasm.memory.buffer`)) {
      throw new Error(`glue-patch: unpatched memory cache ${name}: ${guard}`);
    }
  }

  return (
    "// Patched by @-/com.leonsilicon.matrix-sdk-crypto-wasm.build (glue-patch.ts): memory caches\n" +
    "// refresh on a new `wasm.memory.buffer`, because the native bridge cannot detach buffers.\n" +
    patched
  );
}
