const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    }).outputText,
    filename,
  );
let result;
let writes;
const guard = require("../lib/media-operation.ts");
const store = {
  upsertBatch: async () => {},
  syncNativeTrash: async (states) => writes.push(["native", states]),
  setTrashedBatch: async (ids, value) => writes.push(["local", ids, value]),
  deleteByMediaIds: async (ids) => writes.push(["delete", ids]),
};
const native = {
  isDeviceMediaAvailable: true,
  getDeviceMedia: async (ids) => ids.map((id) => ({ id })),
  setDeviceTrashed: async () => {
    assert.equal(guard.isMediaOperationPending(), true);
    return result;
  },
  deleteDeviceMedia: async () => result,
};
const original = Module._load;
Module._load = function (name, ...rest) {
  if (name === "react-native")
    return {
      Platform: { OS: "android" },
      Alert: {
        alert: (_title, _body, buttons) =>
          buttons.find((button) => button.text === "Smazat").onPress(),
      },
    };
  if (name.startsWith("expo-")) return {};
  if (name === "@/db") return { mediaStore: store };
  if (name === "@/db/changes") return { notifyLibraryChanged() {} };
  if (name === "../modules/galerie-device") return native;
  if (name === "./media")
    return { identity: (asset) => ({ mediaId: asset.id }) };
  return original.call(this, name, ...rest);
};
const {
  setMediaTrashed,
  deleteMediaFromPhone,
} = require("../lib/media-actions.ts");
Module._load = original;

test("cancelled/partially accepted native consent updates only confirmed IDs and releases reconciliation guard", async () => {
  writes = [];
  result = { completedIds: [], cancelled: true };
  const revision = guard.getMediaOperationRevision();
  assert.deepEqual(await setMediaTrashed(["a", "b"], true), result);
  assert.deepEqual(writes, []);
  assert.equal(guard.isMediaOperationPending(), false);
  assert.ok(guard.getMediaOperationRevision() > revision);
  result = { completedIds: ["a"], cancelled: true };
  await setMediaTrashed(["a", "b"], true);
  assert.deepEqual(writes, [["native", [{ id: "a", isTrashed: true }]]]);
  writes = [];
  await deleteMediaFromPhone(["a", "b"]);
  assert.deepEqual(writes, [["delete", ["a"]]]);
  writes = [];
  await setMediaTrashed(["a", "b"], false);
  assert.deepEqual(writes, [
    ["native", [{ id: "a", isTrashed: false }]],
    ["local", ["a"], false],
  ]);
  assert.equal(guard.isMediaOperationPending(), false);
});
