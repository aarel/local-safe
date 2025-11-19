const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { listEntries } = require("../../src/app/commands/list");

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

function stubStore(vault) {
  return {
    path: "/virtual/vault.json",
    readVault: () => vault,
    writeVault: () => "/virtual/vault.json",
  };
}

test("listEntries reports empty vault state", () => {
  const store = stubStore({
    version: 1,
    entries: [],
  });
  const capture = captureStdout();

  const rows = listEntries({ store, stdout: capture.stream });

  assert.equal(rows.length, 0);
  assert.ok(capture.output.join("").includes("Vault empty"));
});

test("listEntries formats metadata table", () => {
  const store = stubStore({
    version: 1,
    entries: [
      {
        id: "id-1",
        name: "Email",
        username: "alice",
        url: "https://mail.example.com",
        updatedAt: "2024-06-01T00:00:00.000Z",
      },
      {
        id: "id-2",
        name: "Bank",
        username: "bob",
        url: "https://bank.example.com",
        updatedAt: "2024-06-02T00:00:00.000Z",
      },
    ],
  });

  const capture = captureStdout();

  const rows = listEntries({ store, stdout: capture.stream });

  assert.equal(rows.length, 2);
  const output = capture.output.join("");
  assert.ok(output.includes("Email"));
  assert.ok(output.includes("Bank"));
  assert.ok(output.includes("alice"));
});
test("listEntries filters by tag and domain", () => {
  const store = stubStore({
    version: 1,
    entries: [
      {
        id: "id-1",
        name: "Email",
        username: "alice",
        url: "https://mail.example.com",
        updatedAt: "2024-06-01T00:00:00.000Z",
        tags: ["personal"],
      },
      {
        id: "id-2",
        name: "Work Mail",
        username: "bob",
        url: "https://mail.example.com",
        updatedAt: "2024-06-02T00:00:00.000Z",
        tags: ["work"],
      },
      {
        id: "id-3",
        name: "Bank",
        username: "alice",
        url: "https://bank.example.com",
        updatedAt: "2024-06-03T00:00:00.000Z",
        tags: ["finance"],
      },
    ],
  });

  const capture = captureStdout();

  const rows = listEntries(
    { store, stdout: capture.stream },
    { tag: "work", domain: "mail.example.com" }
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Work Mail");
  const output = capture.output.join("");
  assert.ok(output.includes("Work Mail"));
  assert.ok(!output.includes("Bank"));
});
