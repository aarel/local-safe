const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { initVault } = require("../../src/app/commands/init");

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

function createStubStore(initial = null) {
  let data = initial;
  return {
    path: "/virtual/vault.json",
    readVault: () => data,
    writeVault: (payload) => {
      data = payload;
      return "/virtual/vault.json";
    },
  };
}

test("initVault creates a new vault when missing", async () => {
  const store = createStubStore();
  const capture = captureStdout();

  const template = await initVault({ store, stdout: capture.stream });

  assert.equal(Array.isArray(template.entries), true);
  assert.equal(Array.isArray(template.trash), true);
  assert.ok(capture.output.join("").includes("Created new vault"));
  assert.ok(store.readVault());
});

test("initVault reports when vault already exists", async () => {
  const existing = { version: 1, entries: [] };
  const store = createStubStore(existing);
  const capture = captureStdout();

  const result = await initVault({ store, stdout: capture.stream });

  assert.equal(result.entries.length, 0);
  assert.ok(capture.output.join("").includes("already exists"));
});
