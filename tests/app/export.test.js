const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { exportVault } = require("../../src/app/commands/export");

function captureStreams() {
  const outChunks = [];
  const errChunks = [];

  const stdout = new Writable({
    write(chunk, encoding, callback) {
      outChunks.push(chunk.toString());
      callback();
    },
  });

  const stderr = new Writable({
    write(chunk, encoding, callback) {
      errChunks.push(chunk.toString());
      callback();
    },
  });

  return { stdout, stderr, outChunks, errChunks };
}

function stubStore(vault) {
  return {
    path: "/virtual/vault.json",
    readVault: () => vault,
    writeVault: () => "/virtual/vault.json",
  };
}

test("exportVault prints JSON to stdout by default", () => {
  const vault = {
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [
      {
        id: "id-1",
        name: "Email",
        username: "alice",
        url: "https://mail.example.com",
        tags: ["personal"],
        updatedAt: "today",
      },
    ],
  };
  const store = stubStore(vault);
  const capture = captureStreams();

  const summary = exportVault({ store, stdout: capture.stdout, stderr: capture.stderr }, { pretty: true });

  assert.equal(summary.destination, "stdout");
  assert.equal(summary.format, "json");
  const stdoutPayload = capture.outChunks.join("");
  assert.ok(stdoutPayload.includes("\"entries\""));
  assert.ok(stdoutPayload.includes("\"tags\""));
  assert.equal(capture.errChunks.length, 0);
});

test("exportVault rejects unsupported formats", () => {
  const store = stubStore({ entries: [] });
  const capture = captureStreams();

  const result = exportVault(
    { store, stdout: capture.stdout, stderr: capture.stderr },
    { format: "yaml" }
  );

  assert.equal(result, null);
  assert.ok(capture.errChunks.join("").includes("Unsupported export format"));
});
