const path = require("node:path");

const { loadConfig } = require("../config");
const { createVaultStore } = require("../storage/filesystemStore");
const { buildCryptoSuite } = require("../crypto/vault");
const { createAuditLogger } = require("../logger/audit");
const { resolveCli } = require("./cli");
const { purgeTrash } = require("./commands/trash");

function mergeConfig(base, overrides = {}) {
  const result = { ...base, ...overrides };
  result.paths = { ...base.paths, ...(overrides.paths || {}) };
  result.crypto = { ...base.crypto, ...(overrides.crypto || {}) };
  result.retention = { ...base.retention, ...(overrides.retention || {}) };
  return result;
}

async function bootstrap({ configPath, configOverrides, services = {}, io = {} } = {}) {
  const baseConfig = loadConfig(configPath);
  const config = mergeConfig(baseConfig, configOverrides);
  const store = services.store || createVaultStore(config.paths.vault);
  const crypto = services.crypto || (await buildCryptoSuite(config.crypto));
  const audit = services.audit || createAuditLogger(config.paths.auditLog);
  const workingDirectory = services.workingDirectory || path.dirname(config.paths.vault);

  const stdin = io.stdin || process.stdin;
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;

  if (config.retention?.trashOlderThan) {
    try {
      purgeTrash(
        { store, stdout },
        { "older-than": config.retention.trashOlderThan, confirm: "purge", silent: true }
      );
    } catch (error) {
      stderr.write(`Retention purge failed: ${error.message}\n`);
    }
  }

  return resolveCli({
    config,
    store,
    crypto,
    audit,
    workingDirectory,
    io: { stdin, stdout, stderr },
  });
}

module.exports = { bootstrap };
