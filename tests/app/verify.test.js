const test = require("node:test");
const assert = require("node:assert/strict");

const { verifyVault } = require("../../src/app/commands/verify");
const { stampEntryIntegrity } = require("../../src/app/utils/integrity");

function createStore(entry) {
  let state = {
    version: 1,
    entries: entry ? [entry] : [],
    trash: [],
    createdAt: "today",
    updatedAt: "today",
  };
  return {
    path: "/virtual/vault.json",
    readVault: () => state,
    writeVault: (payload) => {
      state = payload;
      return "/virtual/vault.json";
    },
  };
}

test("verifyVault detects mismatches and can fix them", () => {
  const entry = stampEntryIntegrity({
    id: "id-1",
    name: "Email",
    username: "alice",
    url: "https://mail.example.com",
    tags: ["personal"],
    secret: { ciphertext: "abc" },
    createdAt: "today",
    updatedAt: "today",
  });

  entry.meta.integrity = "tampered";
  const store = createStore(entry);
  const capture = { write: () => {} };

  const result = verifyVault({ store, stdout: capture }, { fix: true });

  assert.equal(result.ok, false);
  const saved = store.readVault();
  assert.notEqual(saved.entries[0].meta.integrity, "tampered");
});
