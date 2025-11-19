const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { tagEntry } = require("../../src/app/commands/tag");

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

function createVault(entries) {
  return {
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries,
    trash: [],
  };
}

test("tagEntry updates tags by name", () => {
  const store = createStore(
    createVault([
      {
        id: "id-1",
        name: "Email",
        username: "alice",
        url: "https://mail.example.com",
        tags: [],
        updatedAt: "today",
      },
    ])
  );
  const capture = captureStdout();

  const updated = tagEntry(
    { store, stdout: capture.stream },
    { name: "Email", tags: "personal,mail" }
  );

  assert.deepEqual(updated.tags, ["personal", "mail"]);
  const saved = store.readVault();
  assert.deepEqual(saved.entries[0].tags, ["personal", "mail"]);
  assert.ok(capture.output.join("").includes("Updated tags"));
});

test("tagEntry requires tags input", () => {
  const store = createStore(
    createVault([
      {
        id: "id-1",
        name: "Email",
        username: "alice",
        url: "",
        tags: [],
        updatedAt: "today",
      },
    ])
  );
  const capture = captureStdout();

  const result = tagEntry({ store, stdout: capture.stream }, { name: "Email" });

  assert.equal(result, null);
  assert.ok(capture.output.join("").includes("Provide at least one tag"));
});
