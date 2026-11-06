// Checks that exercise the bridge's edge cases, then the benchmark from the investigation that
// motivated this repo: the matrix-sdk-crypto-wasm test suite's "encrypt/decrypt events" flow
// (key query and claim fixtures in @fixtures, copied from upstream's tests/machine.test.ts).

import keysClaim from "#fixtures/keys-claim.json" with { type: "json" };
import keysQuery from "#fixtures/keys-query.json" with { type: "json" };

type Glue = typeof import("react-native-matrix-sdk-crypto-wasm/glue");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`check failed: ${message}`);
}

export interface Check {
  name: string;
  run(): Promise<void> | void;
}

export function bridgeChecks(
  C: Glue,
  instantiate: (glue: Glue) => Record<string, unknown>,
): Check[] {
  return [
    {
      // Rust reports the misuse by calling the glue's __wbindgen_throw import, so a JS exception
      // unwinds through the module's C frames back to the export call.
      name: "a JS exception thrown inside the module reaches the caller, and the module still works",
      run() {
        const user = new C.UserId("@alice:example.org");
        user.free();
        let message = "";
        try {
          user.toString();
        } catch (error) {
          message = String(error);
        }
        assert(message.length > 0, "using a freed UserId should throw");
        for (let i = 0; i < 1000; i++) {
          assert(
            new C.UserId("@bob:example.org").toString() === "@bob:example.org",
            "module works after the throw",
          );
        }
      },
    },
    {
      // The module starts with 1.5 MB of memory; this forces growth well past it, so the glue
      // must pick up the new `memory.buffer` (glue-patch.ts) for the round trip to match.
      name: "linear memory grows, and the glue reads through the new buffer",
      run() {
        const size = 32 * 1024 * 1024;
        const input = new Uint8Array(size);
        for (let i = 0; i < size; i += 4096) input[i] = (i >>> 12) & 255;
        const output = C.Attachment.decrypt(C.Attachment.encrypt(input));
        assert(output.length === size, "decrypted length");
        for (let i = 0; i < size; i += 4096) assert(output[i] === ((i >>> 12) & 255), `byte ${i}`);
      },
    },
    {
      // A request the allocator cannot satisfy makes Rust abort, which is a wasm `unreachable`
      // trap. It runs on a second, throwaway instance so the shared one stays healthy.
      name: "a trap becomes a RuntimeError instead of crashing the process",
      run() {
        const exports = instantiate(C);
        const malloc = Object.entries(exports).find(([name]) => name.endsWith("malloc"))?.[1];
        assert(typeof malloc === "function", "the module exports a malloc");
        let message = "";
        try {
          (malloc as (size: number, align: number) => number)(0xfffffff0, 8);
        } catch (error) {
          message = String(error);
        }
        assert(
          message.includes("RuntimeError"),
          `expected a RuntimeError, got: ${message || "no error"}`,
        );
        assert(
          new C.UserId("@carol:example.org").toString() === "@carol:example.org",
          "the shared instance still works",
        );
      },
    },
  ];
}

export type BenchResult = Record<string, number>;

export async function runBench(C: Glue, now: () => number): Promise<BenchResult> {
  const result: BenchResult = {};
  const user = new C.UserId("@alice:example.org");
  const device = new C.DeviceId("JLAFKJWSCS");
  const room = new C.RoomId("!test:localhost");

  let start = now();
  const machine = await C.OlmMachine.initialize(user, device);
  result.initialize = now() - start;

  start = now();
  await machine.outgoingRequests();
  result.firstOutgoingRequests = now() - start;

  start = now();
  await machine.markRequestAsSent("foo", C.RequestType.KeysQuery, JSON.stringify(keysQuery));
  await machine.markRequestAsSent("bar", C.RequestType.KeysClaim, JSON.stringify(keysClaim));
  result.keysQueryAndClaim = now() - start;

  start = now();
  const toDevice = await machine.shareRoomKey(
    room,
    [new C.UserId("@example:localhost")],
    new C.EncryptionSettings(),
  );
  for (const request of toDevice)
    await machine.markRequestAsSent(request.id!, C.RequestType.ToDevice, "{}");
  result.shareRoomKey = now() - start;

  const count = 100;
  const encrypted: string[] = [];
  start = now();
  for (let i = 0; i < count; i++) {
    encrypted.push(
      await machine.encryptRoomEvent(
        room,
        "m.room.message",
        JSON.stringify({ msgtype: "m.text", body: `Hello ${i}` }),
      ),
    );
  }
  result.megolmEncryptPerEvent = (now() - start) / count;

  const settings = new C.DecryptionSettings(C.TrustRequirement.Untrusted);
  start = now();
  for (let i = 0; i < count; i++) {
    const event = JSON.stringify({
      type: "m.room.encrypted",
      event_id: `$event${i}:example.org`,
      origin_server_ts: 1,
      sender: "@alice:example.org",
      content: JSON.parse(encrypted[i]),
    });
    const decrypted = await machine.decryptRoomEvent(event, room, settings);
    assert(JSON.parse(decrypted.event).content.body === `Hello ${i}`, `decrypted body ${i}`);
  }
  result.megolmDecryptPerEvent = (now() - start) / count;

  const attachment = new Uint8Array(1 << 20);
  for (let i = 0; i < attachment.length; i++) attachment[i] = i & 255;
  start = now();
  const roundTrip = C.Attachment.decrypt(C.Attachment.encrypt(attachment));
  result.attachment1MiBRoundTrip = now() - start;
  assert(roundTrip[12345] === attachment[12345], "attachment round trip");

  machine.close();
  return result;
}
