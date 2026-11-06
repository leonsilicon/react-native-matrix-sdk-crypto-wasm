import assert from "node:assert/strict";
import { test } from "node:test";

import { parseWasm2cHeader } from "#wasm2c-header";

const IMPORT_STRUCT = "w2c_0x2E0x2Fmatrix__sdk__crypto__wasm__bg0x2Ejs";

const HEADER = `
struct ${IMPORT_STRUCT};
/* import: '.\\2Fmatrix_sdk_crypto_wasm_bg.js' '__wbg_Error_67e7344beaa85059' */
u32 ${IMPORT_STRUCT}_0x5F_wbg_Error_67e7344beaa85059(struct ${IMPORT_STRUCT}*, u32, u32);
void wasm_tailcall_${IMPORT_STRUCT}_0x5F_wbg_Error_67e7344beaa85059(void **instance_ptr, void *tail_call_stack, wasm_rt_tailcallee_t *next);

/* import: '.\\2Fmatrix_sdk_crypto_wasm_bg.js' '__wbindgen_generic_0000000000000009' */
u32 ${IMPORT_STRUCT}_0x5F_wbindgen_generic_0000000000000009(struct ${IMPORT_STRUCT}*, u64);

/* export: 'memory' */
wasm_rt_memory_t* w2c_mxcrypto_memory(w2c_mxcrypto* instance);

/* export: '__wbg_attachment_free' */
void w2c_mxcrypto_0x5F_wbg_attachment_free(w2c_mxcrypto*, u32, u32);

/* export: '__wbindgen_start' */
void w2c_mxcrypto_0x5F_wbindgen_start(w2c_mxcrypto*);

/* export: 'device_firstTimeSeen' */
u64 w2c_mxcrypto_device_firstTimeSeen(w2c_mxcrypto*, u32);

/* export: '__abort_handler' */
u32* w2c_mxcrypto_0x5F_abort_handler(w2c_mxcrypto* instance);
`;

test("reads names from the comments and types from the declarations", () => {
  const iface = parseWasm2cHeader(HEADER, "mxcrypto");
  assert.equal(iface.instanceType, "w2c_mxcrypto");
  assert.equal(iface.importStruct, `struct ${IMPORT_STRUCT}`);
  assert.equal(iface.importModule, "./matrix_sdk_crypto_wasm_bg.js");
  assert.deepEqual(iface.imports, [
    {
      name: "__wbg_Error_67e7344beaa85059",
      symbol: `${IMPORT_STRUCT}_0x5F_wbg_Error_67e7344beaa85059`,
      result: "u32",
      params: ["u32", "u32"],
    },
    {
      name: "__wbindgen_generic_0000000000000009",
      symbol: `${IMPORT_STRUCT}_0x5F_wbindgen_generic_0000000000000009`,
      result: "u32",
      params: ["u64"],
    },
  ]);
  assert.deepEqual(
    iface.exports.map(({ name, result, params }) => ({ name, result, params })),
    [
      { name: "__wbg_attachment_free", result: "void", params: ["u32", "u32"] },
      { name: "__wbindgen_start", result: "void", params: [] },
      { name: "device_firstTimeSeen", result: "u64", params: ["u32"] },
    ],
  );
  assert.equal(iface.memorySymbol, "w2c_mxcrypto_memory");
  assert.deepEqual(iface.globals, ["__abort_handler"]);
});

test("refuses reference types, which the bridge cannot pass", () => {
  const withExternref = HEADER.replace(
    "void w2c_mxcrypto_0x5F_wbg_attachment_free(w2c_mxcrypto*, u32, u32);",
    "void w2c_mxcrypto_0x5F_wbg_attachment_free(w2c_mxcrypto*, wasm_rt_externref_t, u32);",
  );
  assert.throws(() => parseWasm2cHeader(withExternref, "mxcrypto"), /MVP target/);
});
