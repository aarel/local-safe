const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { buildCryptoSuite } = require("../../src/crypto/vault");
const { addEntry } = require("../../src/app/commands/add");
const { parseTags } = require("../../src/app/utils/tags");

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
  let state = initial;
  return {
    path: "/virtual/vault.json",
    readVault: () => state,
    writeVault: (payload) => {
      state = payload;
      return "/virtual/vault.json";
    },
  };
}

function seedVault(store) {
  const now = new Date().toISOString();
  store.writeVault({
    version: 1,
    createdAt: now,
    updatedAt: now,
    entries: [],
    trash: [],
  });
}

test("addEntry encrypts secret payloads", async () => {
  const store = createStubStore();
  seedVault(store);

  const capture = captureStdout();
  const suite = await buildCryptoSuite();

  const entry = await addEntry(
    { store, crypto: suite, stdout: capture.stream },
    {
      name: "Email",
      username: "alice",
      secret: "hunter2",
      passphrase: "pw",
    }
  );

  assert.ok(entry);
  const persisted = store.readVault();
  assert.equal(persisted.entries.length, 1);
  const saved = persisted.entries[0];
  const decrypted = suite.decrypt({ passphrase: "pw", payload: saved.secret });
  const decoded = JSON.parse(decrypted);
  assert.equal(decoded.secret, "hunter2");
  assert.ok(saved.meta.integrity);
  assert.ok(capture.output.join("").includes("Added credential 'Email'"));
});

test("addEntry requires a passphrase", async () => {
  const store = createStubStore();
  seedVault(store);

  const capture = captureStdout();
  const suite = await buildCryptoSuite();

  const result = await addEntry(
    { store, crypto: suite, stdout: capture.stream },
    {
      name: "Email",
      secret: "hunter2",
    }
  );

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("Passphrase required"));
});

test("parseTags normalizes input", () => {
  const fromComma = parseTags("Personal, Work");
  assert.deepEqual(fromComma, ["personal", "work"]);

  const fromArray = parseTags(["shared", " urgent "]);
  assert.deepEqual(fromArray, ["shared", "urgent"]);
});
