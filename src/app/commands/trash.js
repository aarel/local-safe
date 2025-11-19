function formatError(stream, message) {
  stream.write(`${message}\n`);
  return null;
}

function listTrash({ store, stdout }, flags = {}) {
  const vault = store.readVault();
  if (!vault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const trash = Array.isArray(vault.trash) ? vault.trash : [];
  if (!trash.length) {
    stdout.write("Trash empty. No archived entries available.\n");
    return [];
  }

  const filtered = trash.filter((item) => {
    if (flags.action && item.action !== flags.action) {
      return false;
    }
    if (flags.name && item.entry.name.toLowerCase() !== flags.name.toLowerCase()) {
      return false;
    }
    return true;
  });

  filtered.forEach((item, index) => {
    stdout.write(
      `${index + 1}. action=${item.action} name=${item.entry.name} id=${item.entry.id} archived=${item.timestamp}\n`
    );
  });

  if (!filtered.length) {
    stdout.write("No trash entries matched the supplied filters.\n");
  }
  return filtered;
}

function restoreFromTrash({ store, stdout }, flags = {}) {
  const vault = store.readVault();
  if (!vault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const trash = Array.isArray(vault.trash) ? [...vault.trash] : [];
  if (!trash.length) {
    return formatError(stdout, "Trash is empty.");
  }

  const selector = {
    id: flags.id,
    name: flags.name,
  };

  if (!selector.id && !selector.name) {
    return formatError(stdout, "Provide --id or --name to choose a trash entry.");
  }

  const index = trash.findIndex(
    (item) =>
      (selector.id && item.entry.id === selector.id) ||
      (selector.name && item.entry.name.toLowerCase() === selector.name.toLowerCase())
  );

  if (index === -1) {
    return formatError(stdout, "Trash entry not found.");
  }

  const item = trash.splice(index, 1)[0];
  const updatedVault = {
    ...vault,
    entries: [...vault.entries, { ...item.entry, updatedAt: new Date().toISOString() }],
    trash,
    updatedAt: new Date().toISOString(),
  };

  store.writeVault(updatedVault);
  stdout.write(`Restored '${item.entry.name}' (${item.entry.id}) from trash.\n`);
  return item.entry;
}

function resolveCutoff(flags) {
  if (flags.before) {
    const date = new Date(flags.before);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
    return null;
  }

  if (flags["older-than"]) {
    const duration = parseDuration(flags["older-than"]);
    if (!duration) {
      return false;
    }
    return new Date(Date.now() - duration);
  }

  return undefined;
}

function parseDuration(value) {
  const match = String(value).trim().match(/^(\d+)([dh])$/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "d") {
    return amount * 24 * 60 * 60 * 1000;
  }
  if (unit === "h") {
    return amount * 60 * 60 * 1000;
  }
  return null;
}

function purgeTrash({ store, stdout }, flags = {}) {
  const vault = store.readVault();
  if (!vault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const trash = Array.isArray(vault.trash) ? vault.trash : [];
  if (trash.length === 0) {
    stdout.write("Trash already empty.\n");
    return [];
  }

  let candidates = trash;
  const cutoff = resolveCutoff(flags);
  if (cutoff === null) {
    return formatError(stdout, "Invalid --before date. Use ISO format (e.g., 2024-01-01).");
  }
  if (cutoff === false) {
    return formatError(stdout, "Invalid --older-than value. Use formats like 7d or 12h.");
  }
  if (cutoff instanceof Date) {
    candidates = trash.filter((item) => new Date(item.timestamp) <= cutoff);
  }

  if (!candidates.length) {
    stdout.write("No trash entries matched the purge filters.\n");
    return [];
  }

  if (!flags.confirm || flags.confirm !== "purge") {
    stdout.write(
      `Pending purge for ${candidates.length} entr${candidates.length === 1 ? "y" : "ies"}. Re-run with --confirm purge to proceed.\n`
    );
    return null;
  }

  const remainder = trash.filter((item) => !candidates.includes(item));
  const updatedVault = {
    ...vault,
    trash: remainder,
    updatedAt: new Date().toISOString(),
  };

  store.writeVault(updatedVault);
  stdout.write(`Purged ${candidates.length} trash entr${candidates.length === 1 ? "y" : "ies"}.\n`);
  return candidates;
}

module.exports = { listTrash, restoreFromTrash, purgeTrash, parseDuration };
