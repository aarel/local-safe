const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG = {
  paths: {
    vault: path.join(process.cwd(), "assets", "sample-vault.json"),
    auditLog: path.join(process.cwd(), "logs", "activity.log"),
  },
  crypto: {
    algorithm: "aes-256-gcm",
    iterations: 210000,
    keySize: 32,
  },
  retention: {
    trashOlderThan: null,
  },
};

function loadConfig(configPath) {
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const resolvedPath = path.resolve(configPath);
  if (!fs.existsSync(resolvedPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const contents = fs.readFileSync(resolvedPath, "utf8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(contents) };
}

module.exports = { loadConfig, DEFAULT_CONFIG };
