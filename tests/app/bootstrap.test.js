const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const { bootstrap } = require("../../src/app/index");

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

test("bootstrap returns a CLI contract", async () => {
  const cli = await bootstrap();
  assert.equal(typeof cli.run, "function");
});

test("cli status reports when vault is missing", async () => {
  const store = {
    path: "/virtual/vault.json",
    readVault: () => null,
    writeVault: () => "/virtual/vault.json",
  };
  const capture = captureStdout();

  const cli = await bootstrap({
    services: { store },
    io: { stdout: capture.stream },
  });

  await cli.run(["status"]);

  assert.ok(capture.output.join("").includes("Vault missing"));
});

test("bootstrap purges trash when retention policy configured", async () => {
  const devNull = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  let data = {
    version: 1,
    createdAt: "today",
    updatedAt: "today",
    entries: [],
    trash: [
      { action: "delete", timestamp: "2024-01-01T00:00:00.000Z", entry: { id: "old" } },
    ],
  };

  const store = {
    path: "/virtual/vault.json",
    readVault: () => data,
    writeVault: (payload) => {
      data = payload;
      return "/virtual/vault.json";
    },
  };

  await bootstrap({
    configOverrides: { retention: { trashOlderThan: "1d" } },
    services: { store },
    io: { stdout: devNull, stderr: devNull },
  });

  assert.equal(data.trash.length, 0);
});
