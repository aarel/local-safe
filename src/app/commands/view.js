function formatError(stream, message) {
  stream.write(`${message}\n`);
  return null;
}

function findEntry(vault, criteria) {
  if (!vault || !Array.isArray(vault.entries)) {
    return null;
  }
  if (criteria.id) {
    return vault.entries.find((entry) => entry.id === criteria.id) || null;
  }
  if (criteria.name) {
    return (
      vault.entries.find((entry) => entry.name.toLowerCase() === criteria.name.toLowerCase()) ||
      null
    );
  }
  return null;
}

async function viewEntry(dependencies, flags = {}) {
  const { store, crypto, stdout } = dependencies;
  const vault = store.readVault();
  if (!vault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const passphrase = flags.passphrase;
  if (!passphrase) {
    return formatError(stdout, "Passphrase required. Provide with `--passphrase <value>`.");
  }

  const lookup = {
    id: flags.id,
    name: flags.name,
  };

  if (!lookup.id && !lookup.name) {
    return formatError(stdout, "Provide --id or --name to select an entry.");
  }

  const entry = findEntry(vault, lookup);
  if (!entry) {
    return formatError(stdout, "Entry not found. Check the identifier and try again.");
  }

  let decrypted;
  try {
    decrypted = crypto.decrypt({ passphrase, payload: entry.secret });
  } catch {
    return formatError(stdout, "Unable to decrypt entry. Verify the passphrase.");
  }

  const secrets = JSON.parse(decrypted);
  const result = {
    id: entry.id,
    name: entry.name,
    username: entry.username,
    url: entry.url,
    tags: entry.tags || [],
    secret: secrets.secret,
    note: secrets.note || "",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };

  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

module.exports = { viewEntry };
