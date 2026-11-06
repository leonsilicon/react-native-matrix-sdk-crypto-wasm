import assert from "node:assert/strict";
import { test } from "node:test";

import { generateJsiBindings } from "#jsi-bindings";
import type { Wasm2cInterface } from "#wasm2c-header";

const IFACE: Wasm2cInterface = {
  instanceType: "w2c_mxcrypto",
  importStruct: "struct w2c_glue",
  importModule: "./matrix_sdk_crypto_wasm_bg.js",
  imports: [
    { name: "__wbg_now_1", symbol: "w2c_glue_now_1", result: "f64", params: [] },
    { name: "__wbindgen_cast_2", symbol: "w2c_glue_cast_2", result: "u32", params: ["u64"] },
    { name: "__wbg_log_3", symbol: "w2c_glue_log_3", result: "void", params: ["u32", "u32"] },
  ],
  exports: [
    { name: "__wbindgen_start", symbol: "w2c_mxcrypto_start", result: "void", params: [] },
    {
      name: "device_firstTimeSeen",
      symbol: "w2c_mxcrypto_device_firstTimeSeen",
      result: "u64",
      params: ["u32"],
    },
  ],
  memorySymbol: "w2c_mxcrypto_memory",
  globals: [],
};

const output = generateJsiBindings(IFACE, {
  moduleName: "mxcrypto",
  headerName: "mxcrypto.h",
  provenance: "test",
});

test("defines the import struct the embedder owns", () => {
  assert.match(output, /struct w2c_glue \{\n {2}Bridge\* bridge;\n\};/);
});

test("lists imports in index order, matching the callImport indices", () => {
  assert.match(
    output,
    /kImportNames\[\] = \{\n {2}"__wbg_now_1",\n {2}"__wbindgen_cast_2",\n {2}"__wbg_log_3",\n\};/,
  );
  assert.match(
    output,
    /f64 w2c_glue_now_1\(struct w2c_glue\* context\) \{[^}]*callImport\(0, nullptr, 0\)/,
  );
  assert.match(
    output,
    /u32 w2c_glue_cast_2\(struct w2c_glue\* context, u64 p0\) \{[\s\S]*?return jsToU32\(rt, bridge\.callImport\(1, args, 1\)\);/,
  );
  assert.match(
    output,
    /void w2c_glue_log_3\(struct w2c_glue\* context, u32 p0, u32 p1\) \{[\s\S]*?bridge\.callImport\(2, args, 2\);/,
  );
});

test("export thunks convert arguments and run the call inside invoke", () => {
  assert.match(output, /const u32 p0 = argToU32\(rt, args, count, 0\);/);
  assert.match(
    output,
    /bridge\.invoke\(rt, \[&\] \{ result = w2c_mxcrypto_device_firstTimeSeen\(&bridge\.instance\(\)->module, p0\); \}\);/,
  );
  assert.match(
    output,
    /bridge\.invoke\(rt, \[&\] \{ w2c_mxcrypto_start\(&bridge\.instance\(\)->module\); \}\);/,
  );
  assert.match(output, /\{"device_firstTimeSeen", 1, &export_1\},/);
});
