// Reads the module interface out of the header wasm2c generates. wasm2c precedes every import
// and export declaration with a comment carrying the original wasm names, e.g.
//
//   /* import: '.\2Fmatrix_sdk_crypto_wasm_bg.js' '__wbg_Error_67e7344beaa85059' */
//   u32 w2c_0x2E0x2F..._0x5F_wbg_Error_67e7344beaa85059(struct w2c_0x2E0x2F...*, u32, u32);
//
//   /* export: '__wbg_attachment_free' */
//   void w2c_mxcrypto_0x5F_wbg_attachment_free(w2c_mxcrypto*, u32, u32);
//
// so names come from the comments and only types are parsed from C.

export type WasmValueType = "u32" | "u64" | "f32" | "f64";

export interface Wasm2cFunction {
  /** The wasm import or export name, as the JavaScript glue knows it. */
  name: string;
  /** The C symbol wasm2c generated for it. */
  symbol: string;
  result: WasmValueType | "void";
  params: WasmValueType[];
}

export interface Wasm2cInterface {
  /** `w2c_<module>`, the instance struct. */
  instanceType: string;
  /** `struct w2c_<import module>`, which the embedder defines to carry its own state. */
  importStruct: string;
  /** The wasm module name every import comes from. */
  importModule: string;
  imports: Wasm2cFunction[];
  exports: Wasm2cFunction[];
  /** The C accessor for the exported memory. */
  memorySymbol: string;
  /** Exported globals; the glue does not read them, so they are only listed. */
  globals: string[];
}

const VALUE_TYPES = new Set(["u32", "u64", "f32", "f64"]);
const COMMENT = /^\/\* (import|export): (.*) \*\/$/;
const QUOTED = /'((?:[^'\\]|\\.)*)'/g;
const DECLARATION = /^(\w+\*?) (\w+)\((.*)\);$/;

function unescapeName(name: string): string {
  // wasm2c writes non-printable or awkward bytes in comments as \XX hex.
  return name.replace(/\\([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function valueType(type: string, where: string): WasmValueType {
  if (!VALUE_TYPES.has(type)) {
    throw new Error(
      `wasm2c-header: ${where} uses ${type}; only numeric types are bridged. ` +
        "Rebuild the crate for the MVP target (no reference types, no multivalue).",
    );
  }
  return type as WasmValueType;
}

export function parseWasm2cHeader(header: string, moduleName: string): Wasm2cInterface {
  const instanceType = `w2c_${moduleName}`;
  const lines = header.split("\n");
  const imports: Wasm2cFunction[] = [];
  const exports: Wasm2cFunction[] = [];
  const globals: string[] = [];
  let importStruct: string | undefined;
  let importModule: string | undefined;
  let memorySymbol: string | undefined;

  for (let index = 0; index < lines.length; index++) {
    const comment = COMMENT.exec(lines[index].trim());
    if (!comment) continue;
    const [, kind, quoted] = comment;
    const names = [...quoted.matchAll(QUOTED)].map((match) => unescapeName(match[1]));
    const declaration = DECLARATION.exec(lines[index + 1]?.trim() ?? "");
    if (!declaration) {
      throw new Error(`wasm2c-header: no declaration after line ${index + 1}: ${lines[index]}`);
    }
    const [, result, symbol, paramList] = declaration;
    const [self, ...rest] = paramList.split(",").map((param) => param.trim());

    if (kind === "import") {
      const [module, name] = names;
      if (!module || !name) throw new Error(`wasm2c-header: bad import comment: ${lines[index]}`);
      const struct = self.replace(/\*$/, "");
      if (importStruct && importStruct !== struct) {
        throw new Error(
          `wasm2c-header: imports from more than one module (${importStruct}, ${struct})`,
        );
      }
      importStruct = struct;
      importModule = module;
      imports.push({
        name,
        symbol,
        result: result === "void" ? "void" : valueType(result, `import ${name}`),
        params: rest.map((type) => valueType(type, `import ${name}`)),
      });
      continue;
    }

    const [name] = names;
    if (!name) throw new Error(`wasm2c-header: bad export comment: ${lines[index]}`);
    if (result === "wasm_rt_memory_t*") {
      memorySymbol = symbol;
    } else if (result.endsWith("*")) {
      globals.push(name);
    } else {
      if (self.replace(/\*.*$/, "") !== instanceType) {
        throw new Error(`wasm2c-header: export ${name} does not take ${instanceType}*`);
      }
      exports.push({
        name,
        symbol,
        result: result === "void" ? "void" : valueType(result, `export ${name}`),
        params: rest.map((type) => valueType(type, `export ${name}`)),
      });
    }
  }

  if (!importStruct || !importModule) throw new Error("wasm2c-header: found no imports");
  if (!memorySymbol) throw new Error("wasm2c-header: the module exports no memory");
  return { instanceType, importStruct, importModule, imports, exports, memorySymbol, globals };
}
