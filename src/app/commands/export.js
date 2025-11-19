const fs = require("node:fs");
const path = require("node:path");

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function exportVault(dependencies, flags = {}) {
  const { store, stdout, stderr } = dependencies;
  const vault = store.readVault();
  if (!vault) {
    stdout.write("Vault not initialized. Run `localsafe init` first.\n");
    return null;
  }

  const format = (flags.format || "json").toLowerCase();
  if (format !== "json") {
    stderr.write(`Unsupported export format '${flags.format}'. Only json is available.\n`);
    return null;
  }

  const pretty = Boolean(flags.pretty);
  const payload = JSON.stringify(vault, null, pretty ? 2 : 0);

  if (flags.dest) {
    const destPath = path.resolve(flags.dest);
    ensureDirectory(destPath);
    fs.writeFileSync(destPath, `${payload}\n`);
    stdout.write(`Vault written to ${destPath}\n`);
    return { destination: destPath, format };
  }

  stdout.write(`${payload}\n`);
  return { destination: "stdout", format };
}

module.exports = { exportVault };
