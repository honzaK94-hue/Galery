const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
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
const {
  createTimelineRows,
  timelineGroup,
  gridColumns,
} = require("../lib/timeline.ts");

test("timeline includes all media, keeps date boundaries and adapts to Fold widths", () => {
  const now = new Date(2026, 8, 19, 12);
  const dates = [
    [2026, 8, 19],
    [2026, 8, 19],
    [2026, 8, 18],
    [2026, 8, 17],
    [2026, 7, 1],
    [2024, 0, 1],
  ];
  const items = dates.map((parts, index) => ({
    id: String(index),
    creationTime: new Date(...parts).getTime(),
  }));
  const rows = createTimelineRows(items, 3, true, "comfortable", now);
  assert.deepEqual(
    rows.filter((row) => row.kind === "heading").map((row) => row.label),
    ["Dnes", "Včera", "17. září 2026", "srpen 2026", "2024"],
  );
  assert.deepEqual(
    rows.flatMap((row) =>
      row.kind === "media" ? row.items.map((item) => item.id) : [],
    ),
    items.map((item) => item.id),
  );
  assert.equal(
    timelineGroup(new Date(2026, 8, 19).getTime(), now, "overview").label,
    "září 2026",
  );
  assert.deepEqual(
    [
      gridColumns(360, false, "comfortable"),
      gridColumns(720, false, "comfortable"),
      gridColumns(720, true, "comfortable"),
    ],
    [3, 4, 2],
  );
});
