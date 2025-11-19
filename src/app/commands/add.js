const { randomUUID } = require("node:crypto");
const { parseTags } = require("../utils/tags");
const { stampEntryIntegrity } = require("../utils/integrity");

function formatError(stdout, message) {
  stdout.write(`${message}\n`);
  return null;
}

function normalizeVault(vault = {}) {
  return {
    version: vault.version || 1,
    createdAt: vault.createdAt || new Date().toISOString(),
    updatedAt: vault.updatedAt || new Date().toISOString(),
    entries: Array.isArray(vault.entries) ? vault.entries : [],
    trash: Array.isArray(vault.trash) ? vault.trash : [],
  };
}

async function addEntry(dependencies, flags = {}) {
  const { store, crypto, stdout } = dependencies;
  const existingVault = store.readVault();
  const vault = normalizeVault(existingVault);
  if (!existingVault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const passphrase = flags.passphrase;
  if (!passphrase) {
    return formatError(stdout, "Passphrase required. Provide with `--passphrase <value>`.");
  }

  const secret = flags.secret;
  if (!secret) {
    return formatError(stdout, "Secret required. Provide with `--secret <value>`.");
  }

  const name = flags.name || "Untitled entry";
  const username = flags.username || "";
  const url = flags.url || "";
  const note = flags.note || "";
  const tags = parseTags(flags);
  const timestamp = new Date().toISOString();

  const encrypted = crypto.encrypt({
    passphrase,
    plaintext: JSON.stringify({ secret, note }),
  });

  const entry = stampEntryIntegrity({
    id: randomUUID(),
    name,
    username,
    url,
    tags,
    secret: encrypted,
    createdAt: timestamp,
    updatedAt: timestamp,
    meta: {
      uses: 0,
    },
  });

  const updatedVault = {
    ...vault,
    entries: [...vault.entries, entry],
    updatedAt: timestamp,
  };

  store.writeVault(updatedVault);
  stdout.write(`Added credential '${entry.name}' (${entry.id})\n`);
  return entry;
}

module.exports = { addEntry };
