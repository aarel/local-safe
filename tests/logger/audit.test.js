const test = require("node:test");
const assert = require("node:assert/strict");

const { createAuditLogger } = require("../../src/logger/audit");

test("createAuditLogger appends structured entries", () => {
  const lines = [];
  const logger = createAuditLogger("/virtual/logs/activity.log", {
    writer: (line) => lines.push(line),
  });

  const entry = logger.record("test_event", { id: "id-1" });

  assert.equal(entry.event, "test_event");
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, "test_event");
  assert.equal(parsed.id, "id-1");
});
