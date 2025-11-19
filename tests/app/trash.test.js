const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { listTrash, restoreFromTrash, purgeTrash, parseDuration } = require("../../src/app/commands/trash");

function captureStdout() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, output: chunks };
}

function createStore(initialVault) {
  let data = initialVault;
  return {
    path: "/virtual/vault.json",
    readVault: () => data,
    writeVault: (payload) => {
      data = payload;
      return "/virtual/vault.json";
    },
  };
}

test("listTrash prints archived entries", () => {
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [
      { action: "delete", timestamp: "now", entry: { id: "id-1", name: "Email" } },
    ],
  });
  const capture = captureStdout();

  const result = listTrash({ store, stdout: capture.stream });

  assert.equal(result.length, 1);
  assert.ok(capture.output.join("").includes("Email"));
});

test("restoreFromTrash rehydrates entry", () => {
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [
      {
        action: "delete",
        timestamp: "now",
        entry: { id: "id-1", name: "Email", updatedAt: "old" },
      },
    ],
  });
  const capture = captureStdout();

  const entry = restoreFromTrash({ store, stdout: capture.stream }, { id: "id-1" });

  assert.equal(entry.name, "Email");
  const saved = store.readVault();
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.trash.length, 0);
  assert.ok(capture.output.join("").includes("Restored"));
});

test("purgeTrash requires confirmation", () => {
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [{ action: "delete", timestamp: "now", entry: { id: "id-1", name: "Email" } }],
  });
  const capture = captureStdout();

  const result = purgeTrash({ store, stdout: capture.stream }, {});

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("confirm purge"));
});

test("purgeTrash rejects invalid before date", () => {
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [{ action: "delete", timestamp: "now", entry: { id: "id-1", name: "Email" } }],
  });
  const capture = captureStdout();

  const result = purgeTrash({ store, stdout: capture.stream }, { before: "not-a-date", confirm: "purge" });

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("Invalid --before date"));
});

test("purgeTrash with --before purges matching entries", () => {
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [
      { action: "delete", timestamp: "2024-01-01T00:00:00.000Z", entry: { id: "old", name: "Old" } },
      { action: "delete", timestamp: "2024-06-01T00:00:00.000Z", entry: { id: "new", name: "New" } },
    ],
  });
  const capture = captureStdout();

  const pending = purgeTrash(
    { store, stdout: capture.stream },
    { before: "2024-03-01", confirm: "purge" }
  );

  assert.equal(pending.length, 1);
  assert.equal(pending[0].entry.id, "old");
  const saved = store.readVault();
  assert.equal(saved.trash.length, 1);
  assert.equal(saved.trash[0].entry.id, "new");
});

test("purgeTrash with --older-than purges matching entries", () => {
  const now = Date.now();
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [
      { action: "delete", timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), entry: { id: "old", name: "Old" } },
      { action: "delete", timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(), entry: { id: "new", name: "New" } },
    ],
  });
  const capture = captureStdout();

  const purged = purgeTrash({ store, stdout: capture.stream }, { "older-than": "7d", confirm: "purge" });

  assert.equal(purged.length, 1);
  assert.equal(purged[0].entry.id, "old");
  const saved = store.readVault();
  assert.equal(saved.trash.length, 1);
});

test("parseDuration handles days and hours", () => {
  assert.equal(parseDuration("7d"), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseDuration("12h"), 12 * 60 * 60 * 1000);
  assert.equal(parseDuration("bad"), null);
});
