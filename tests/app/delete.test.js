const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { deleteEntry } = require("../../src/app/commands/delete");

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

function createStore(entries = []) {
  let data = {
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries,
    trash: [],
  };
  return {
    path: "/virtual/vault.json",
    readVault: () => data,
    writeVault: (payload) => {
      data = payload;
      return "/virtual/vault.json";
    },
  };
}

test("deleteEntry removes entry when confirmed", () => {
  const store = createStore([
    {
      id: "id-1",
      name: "Email",
      tags: ["personal"],
      updatedAt: "today",
    },
  ]);
  const capture = captureStdout();

  const removed = deleteEntry(
    { store, stdout: capture.stream },
    { id: "id-1", confirm: "delete" }
  );

  assert.equal(Array.isArray(removed), true);
  assert.equal(removed[0].id, "id-1");
  const saved = store.readVault();
  assert.equal(saved.entries.length, 0);
  assert.ok(capture.output.join("").includes("Removed 1 entry"));
});

test("deleteEntry requires confirmation", () => {
  const store = createStore([
    { id: "id-2", name: "Bank", tags: [], updatedAt: "today" },
  ]);
  const capture = captureStdout();

  const result = deleteEntry({ store, stdout: capture.stream }, { name: "Bank" });

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("Re-run with --confirm delete"));
});

test("deleteEntry soft option keeps entry but records trash", () => {
  const store = createStore([
    {
      id: "id-3",
      name: "Notes",
      tags: [],
      updatedAt: "today",
    },
  ]);
  const capture = captureStdout();

  deleteEntry(
    { store, stdout: capture.stream },
    { id: "id-3", soft: true }
  );

  const saved = store.readVault();
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.trash.length, 1);
  assert.ok(capture.output.join("").toLowerCase().includes("soft-deleted"));
});

test("deleteEntry removes entries by tag with confirmation", () => {
  const store = createStore([
    { id: "id-4", name: "Work Mail", tags: ["work"], updatedAt: "today" },
    { id: "id-5", name: "Personal Mail", tags: ["personal"], updatedAt: "today" },
  ]);
  const capture = captureStdout();

  deleteEntry(
    { store, stdout: capture.stream },
    { tag: "work", confirm: "delete" }
  );

  const saved = store.readVault();
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.entries[0].id, "id-5");
});
