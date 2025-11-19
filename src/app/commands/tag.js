const { parseTags } = require("../utils/tags");

function formatError(stream, message) {
  stream.write(`${message}\n`);
  return null;
}

function findEntryIndex(vault, criteria) {
  if (!vault || !Array.isArray(vault.entries)) {
    return -1;
  }

  if (criteria.id) {
    return vault.entries.findIndex((entry) => entry.id === criteria.id);
  }

  if (criteria.name) {
    const target = criteria.name.toLowerCase();
    return vault.entries.findIndex((entry) => entry.name.toLowerCase() === target);
  }

  return -1;
}

function tagEntry(dependencies, flags = {}) {
  const { store, stdout } = dependencies;
  const vault = store.readVault();
  if (!vault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const lookup = {
    id: flags.id,
    name: flags.name,
  };

  if (!lookup.id && !lookup.name) {
    return formatError(stdout, "Provide --id or --name to choose an entry.");
  }

  const tags = parseTags(flags.tags ?? flags.tag);
  if (!tags.length) {
    return formatError(stdout, "Provide at least one tag via --tags or --tag.");
  }

  const entryIndex = findEntryIndex(vault, lookup);
  if (entryIndex === -1) {
    return formatError(stdout, "Entry not found. Check the identifier and try again.");
  }

  const timestamp = new Date().toISOString();
  const entry = vault.entries[entryIndex];
  const updatedEntry = {
    ...entry,
    tags,
    updatedAt: timestamp,
  };

  const updatedVault = {
    ...vault,
    entries: [
      ...vault.entries.slice(0, entryIndex),
      updatedEntry,
      ...vault.entries.slice(entryIndex + 1),
    ],
    updatedAt: timestamp,
  };

  store.writeVault(updatedVault);
  stdout.write(`Updated tags for '${updatedEntry.name}' (${updatedEntry.id})\n`);
  return updatedEntry;
}

module.exports = { tagEntry };
