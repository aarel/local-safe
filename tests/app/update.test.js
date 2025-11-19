const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { buildCryptoSuite } = require("../../src/crypto/vault");
const { updateEntry } = require("../../src/app/commands/update");

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

async function buildVaultEntry({ secret = "secret", note = "note", passphrase = "pw" } = {}) {
  const suite = await buildCryptoSuite();
  const encrypted = suite.encrypt({
    passphrase,
    plaintext: JSON.stringify({ secret, note }),
  });

  return {
    suite,
    entry: {
      id: "id-1",
      name: "Email",
      username: "alice",
      url: "https://mail.example.com",
      tags: ["personal"],
      secret: encrypted,
      createdAt: "today",
      updatedAt: "today",
    },
  };
}

test("updateEntry changes metadata and archives previous version", async () => {
  const { suite, entry } = await buildVaultEntry();
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [entry],
    trash: [],
  });
  const capture = captureStdout();

  const result = updateEntry(
    { store, crypto: suite, stdout: capture.stream },
    { id: "id-1", username: "bob", tags: "work" }
  );

  assert.equal(result.username, "bob");
  assert.deepEqual(result.tags, ["work"]);
  const saved = store.readVault();
  assert.equal(saved.entries[0].username, "bob");
  assert.equal(saved.trash.length, 1);
  assert.ok(capture.output.join("").includes("Updated credential"));
});

test("updateEntry requires passphrase for secret changes", async () => {
  const { suite, entry } = await buildVaultEntry();
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [entry],
    trash: [],
  });
  const capture = captureStdout();

  const result = updateEntry(
    { store, crypto: suite, stdout: capture.stream },
    { id: "id-1", secret: "new-secret" }
  );

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("Passphrase required"));
});

test("updateEntry re-encrypts secret when passphrase provided", async () => {
  const { suite, entry } = await buildVaultEntry();
  const store = createStore({
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [entry],
    trash: [],
  });
  const capture = captureStdout();

  const result = updateEntry(
    { store, crypto: suite, stdout: capture.stream },
    { id: "id-1", secret: "new-secret", passphrase: "pw" }
  );

  assert.ok(result);
  const decrypted = suite.decrypt({ passphrase: "pw", payload: result.secret });
  const decoded = JSON.parse(decrypted);
  assert.equal(decoded.secret, "new-secret");
  assert.ok(capture.output.join("").includes("Updated credential"));
});
