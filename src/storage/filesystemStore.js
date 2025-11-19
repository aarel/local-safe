const fs = require("node:fs");
const path = require("node:path");

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createVaultStore(vaultPath) {
  const resolvedPath = path.resolve(vaultPath);

  function readVault() {
    if (!fs.existsSync(resolvedPath)) {
      return null;
    }
    const contents = fs.readFileSync(resolvedPath, "utf8");
    return contents.trim() ? JSON.parse(contents) : null;
  }

  function writeVault(payload) {
    ensureDirectory(resolvedPath);
    fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2));
    return resolvedPath;
  }

  return {
    path: resolvedPath,
    readVault,
    writeVault,
  };
}

module.exports = { createVaultStore };
