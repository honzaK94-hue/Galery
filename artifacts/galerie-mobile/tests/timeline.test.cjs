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
    [2025, 11, 25],
    [2024, 0, 1],
  ];
  const items = dates.map((parts, index) => ({
    id: String(index),
    creationTime: new Date(...parts).getTime(),
  }));
  const rows = createTimelineRows(items, 3, true, "comfortable", now);
  assert.deepEqual(
    rows.filter((row) => row.kind === "heading").map((row) => row.label),
    ["Dnes", "Včera", "17. září", "srpen 2026", "2025", "2024"],
  );
  assert.deepEqual(
    rows.flatMap((row) =>
      row.kind === "media" ? row.items.map((item) => item.id) : [],
    ),
    items.map((item) => item.id),
  );
  assert.equal(
    timelineGroup(new Date(2026, 8, 19).getTime(), now, "overview").label,
    "Dnes",
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

test("every density retains all media and the same calendar headings", () => {
  const now = new Date(2026, 8, 19, 12);
  const items = [0, 0, 0, 1, 2, 29, 30, 40, 500].map((age, index) => ({
    id: String(index),
    creationTime: new Date(2026, 8, 19 - age, 8).getTime(),
  }));
  for (const density of ["comfortable", "compact", "overview"]) {
    for (const columns of [2, 3, 4, 6, 8]) {
      for (const grouped of [true, false]) {
        const rows = createTimelineRows(items, columns, grouped, density, now);
        const mediaRows = rows.filter((row) => row.kind === "media");
        assert.deepEqual(
          mediaRows.flatMap((row) => row.items.map((item) => item.id)),
          items.map((item) => item.id),
        );
        assert.ok(mediaRows.every((row) => row.items.length <= columns));
        assert.deepEqual(
          rows.filter((row) => row.kind === "heading").map((row) => row.label),
          grouped
            ? ["Dnes", "Včera", "17. září", "21. srpna", "srpen 2026", "2025"]
            : [],
        );
      }
    }
  }
});

test("recent days and yesterday stay correct across a year boundary", () => {
  const now = new Date(2026, 0, 1, 12);
  assert.equal(
    timelineGroup(new Date(2025, 11, 31, 23).getTime(), now, "overview").label,
    "Včera",
  );
  assert.equal(
    timelineGroup(new Date(2025, 11, 30).getTime(), now).label,
    "30. prosince 2025",
  );
  assert.equal(
    timelineGroup(new Date(2025, 10, 1).getTime(), now).label,
    "2025",
  );
});

test("calendar headings survive both daylight-saving changes", () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = "Europe/Prague";
  try {
    for (const [month, day, elapsedHours] of [
      [2, 29, 23],
      [9, 25, 25],
    ]) {
      const yesterday = new Date(2026, month, day, 0, 30);
      const now = new Date(2026, month, day + 1, 0, 30);
      assert.equal((now - yesterday) / 3_600_000, elapsedHours);
      assert.equal(
        timelineGroup(yesterday.getTime(), now, "overview").label,
        "Včera",
      );
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("invalid and future timestamps remain visible without claiming to be today", () => {
  const now = new Date(2026, 8, 19, 12);
  for (const timestamp of [
    0,
    -1,
    NaN,
    Infinity,
    Number.MAX_VALUE,
    Number.MAX_SAFE_INTEGER,
  ]) {
    assert.deepEqual(timelineGroup(timestamp, now), {
      key: "unknown",
      label: "Bez data",
    });
  }
  assert.deepEqual(timelineGroup(new Date(2027, 1, 3).getTime(), now), {
    key: "2027-2",
    label: "únor 2027",
  });
  const items = [NaN, Number.MAX_VALUE, new Date(2027, 1, 3).getTime()].map(
    (creationTime, index) => ({ id: String(index), creationTime }),
  );
  assert.deepEqual(
    createTimelineRows(items, 3, true, "overview", now).flatMap((row) =>
      row.kind === "media" ? row.items : [],
    ),
    items,
  );
});
