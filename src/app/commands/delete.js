function formatError(stream, message) {
  stream.write(`${message}\n`);
  return null;
}

function matchesSelector(entry, criteria) {
  if (criteria.id && entry.id !== criteria.id) {
    return false;
  }

  if (criteria.name && entry.name.toLowerCase() !== criteria.name.toLowerCase()) {
    return false;
  }

  if (criteria.tag) {
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    if (!tags.some((tag) => tag.toLowerCase() === criteria.tag.toLowerCase())) {
      return false;
    }
  }

  if (criteria.domain) {
    try {
      const hostname = new URL(entry.url || "").hostname;
      if (hostname.toLowerCase() !== criteria.domain.toLowerCase()) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function deleteEntry(dependencies, flags = {}) {
  const { store, stdout } = dependencies;
  const vault = store.readVault();
  if (!vault) {
    return formatError(stdout, "Vault not initialized. Run `localsafe init` first.");
  }

  const lookup = {
    id: flags.id,
    name: flags.name,
    tag: flags.tag,
    domain: flags.domain,
  };

  const targets = (vault.entries || []).filter((entry) => matchesSelector(entry, lookup));
  if (!targets.length) {
    return formatError(stdout, "No entries matched the provided delete selector.");
  }

  const softDelete = Boolean(flags.soft);

  if (!softDelete && flags.confirm !== "delete") {
    stdout.write(
      `Pending deletion for ${targets.length} entr${targets.length === 1 ? "y" : "ies"}. Re-run with --confirm delete to proceed.\n`
    );
    return null;
  }

  const trash = Array.isArray(vault.trash) ? vault.trash : [];
  const timestamp = new Date().toISOString();

  const survivors = vault.entries.filter((entry) => !targets.includes(entry));
  const trashUpdates = targets.map((entry) => ({
    action: softDelete ? "soft-delete" : "delete",
    timestamp,
    entry,
  }));

  const updatedVault = {
    ...vault,
    entries: softDelete ? vault.entries : survivors,
    trash: [...trash, ...trashUpdates],
    updatedAt: timestamp,
  };

  store.writeVault(updatedVault);
  const actionMessage = softDelete ? "Soft-deleted" : "Removed";
  stdout.write(
    `${actionMessage} ${targets.length} entr${targets.length === 1 ? "y" : "ies"}.`
  );
  if (softDelete) {
    stdout.write(" Restore using 'localsafe trash restore --id <entryId>'.\n");
  } else {
    stdout.write("\n");
  }

  return targets.map((entry) => ({ ...entry, softDelete }));
}

module.exports = { deleteEntry };
