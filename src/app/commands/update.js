const { parseTags } = require("../utils/tags");
const { stampEntryIntegrity } = require("../utils/integrity");

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

function updateEntry(dependencies, flags = {}) {
  const { store, crypto, stdout } = dependencies;
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

  const entryIndex = findEntryIndex(vault, lookup);

  if (entryIndex === -1) {
    return formatError(stdout, "Entry not found. Check the identifier and try again.");
  }

  const entry = vault.entries[entryIndex];
  const previousEntry = JSON.parse(JSON.stringify(entry));
  let changed = false;
  const next = { ...entry };

  const newName = flags["new-name"] || flags.newName;
  if (newName) {
    next.name = newName;
    changed = true;
  }
  if (flags.username) {
    next.username = flags.username;
    changed = true;
  }
  if (flags.url) {
    next.url = flags.url;
    changed = true;
  }
  if (flags.tags || flags.tag) {
    next.tags = parseTags(flags.tags ?? flags.tag);
    changed = true;
  }

  const wantsSecretChange = Boolean(flags.secret || flags.note);
  const wantsPassphraseRotation = Boolean(flags.newPassphrase || flags["new-passphrase"]);
  if (flags["new-passphrase"]) {
    flags.newPassphrase = flags["new-passphrase"];
  }
  if (wantsPassphraseRotation) {
    if (!flags.passphrase || !flags.newPassphrase) {
      return formatError(stdout, "Passphrase rotation requires --passphrase and --new-passphrase.");
    }
  }

  const shouldReencrypt = wantsSecretChange || wantsPassphraseRotation;
  if (wantsSecretChange) {
    const passphrase = flags.passphrase;
    if (!passphrase) {
      return formatError(stdout, "Passphrase required to update secret or note.");
    }

    let decrypted;
    try {
      decrypted = JSON.parse(
        crypto.decrypt({
          passphrase,
          payload: entry.secret,
        })
      );
    } catch {
      return formatError(stdout, "Unable to decrypt existing secret. Verify the passphrase.");
    }

    const newSecret = flags.secret ?? decrypted.secret;
    const newNote = flags.note ?? decrypted.note;

    const targetSecret = wantsPassphraseRotation ? flags.newPassphrase : passphrase;
    const newPayload = {
      secret: flags.secret ?? decrypted.secret,
      note: flags.note ?? decrypted.note,
    };

    if (newPayload.secret !== decrypted.secret || newPayload.note !== decrypted.note || wantsPassphraseRotation) {
      next.secret = crypto.encrypt({
        passphrase: targetSecret,
        plaintext: JSON.stringify(newPayload),
      });
      changed = true;
    }
  } else if (wantsPassphraseRotation) {
    try {
      const decrypted = JSON.parse(
        crypto.decrypt({
          passphrase: flags.passphrase,
          payload: entry.secret,
        })
      );
      next.secret = crypto.encrypt({
        passphrase: flags.newPassphrase,
        plaintext: JSON.stringify(decrypted),
      });
      changed = true;
    } catch {
      return formatError(stdout, "Unable to decrypt existing secret. Verify the passphrase.");
    }
  }

  if (!changed) {
    stdout.write("No changes supplied. Provide fields like --new-name, --username, --url, --tags, --secret, or --note.\n");
    return null;
  }

  const timestamp = new Date().toISOString();
  next.updatedAt = timestamp;
  const stampedEntry = stampEntryIntegrity(next);

  const trash = Array.isArray(vault.trash) ? vault.trash : [];
  const updatedVault = {
    ...vault,
    entries: [
      ...vault.entries.slice(0, entryIndex),
      stampedEntry,
      ...vault.entries.slice(entryIndex + 1),
    ],
    trash: [
      ...trash,
      {
        action: "update",
        timestamp,
        entry: previousEntry,
      },
    ],
    updatedAt: timestamp,
  };

  store.writeVault(updatedVault);
  stdout.write(`Updated credential '${stampedEntry.name}' (${stampedEntry.id})\n`);
  return stampedEntry;
}

module.exports = { updateEntry };
