const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { buildCryptoSuite } = require("../../src/crypto/vault");
const { viewEntry } = require("../../src/app/commands/view");

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

function createVaultFixture(cryptoSuite, overrides = {}) {
  const timestamp = new Date().toISOString();
  const payload = cryptoSuite.encrypt({
    passphrase: overrides.passphrase || "pw",
    plaintext: JSON.stringify({ secret: overrides.secret || "hunter2", note: "mail" }),
  });

  return {
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    entries: [
      {
        id: overrides.id || "entry-1",
        name: overrides.name || "Email",
        username: overrides.username || "alice",
        url: overrides.url || "https://mail.example.com",
        tags: overrides.tags || ["personal", "mail"],
        secret: payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

function stubStore(vault) {
  return {
    path: "/virtual/vault.json",
    readVault: () => vault,
    writeVault: () => "/virtual/vault.json",
  };
}

test("viewEntry decrypts payload by id", async () => {
  const suite = await buildCryptoSuite();
  const vault = createVaultFixture(suite);
  const store = stubStore(vault);
  const capture = captureStdout();

  const result = await viewEntry(
    { store, crypto: suite, stdout: capture.stream },
    { id: "entry-1", passphrase: "pw" }
  );

  assert.equal(result.name, "Email");
  assert.equal(result.secret, "hunter2");
  assert.deepEqual(result.tags, ["personal", "mail"]);
  const output = capture.output.join("");
  assert.ok(output.includes("\"Email\""));
  assert.ok(capture.output.join("").includes("\"hunter2\""));
  assert.ok(output.includes("\"personal\""));
});

test("viewEntry requires selector metadata", async () => {
  const suite = await buildCryptoSuite();
  const vault = createVaultFixture(suite);
  const store = stubStore(vault);
  const capture = captureStdout();

  const result = await viewEntry(
    { store, crypto: suite, stdout: capture.stream },
    { passphrase: "pw" }
  );

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("Provide --id or --name"));
});
