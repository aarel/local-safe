const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCryptoSuite } = require("../../src/crypto/vault");

test("buildCryptoSuite encrypts and decrypts payloads", async () => {
  const suite = await buildCryptoSuite();
  const payload = suite.encrypt({ passphrase: "secret", plaintext: "top-secret" });
  const result = suite.decrypt({ passphrase: "secret", payload });

  assert.equal(result, "top-secret");
});
