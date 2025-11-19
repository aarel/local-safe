const { computeEntryDigest, stampEntryIntegrity } = require("../utils/integrity");

function verifyVault({ store, stdout }, flags = {}) {
  const vault = store.readVault();
  if (!vault) {
    stdout.write("Vault missing. Run `localsafe init` first.\n");
    return { ok: false, mismatches: [] };
  }
  const entries = Array.isArray(vault.entries) ? vault.entries : [];
  const mismatches = [];
  const updatedEntries = [...entries];

  entries.forEach((entry, index) => {
    const digest = computeEntryDigest(entry);
    const stored = entry.meta?.integrity;
    if (stored !== digest) {
      mismatches.push({ id: entry.id, name: entry.name, reason: stored ? "mismatch" : "missing" });
      if (flags.fix) {
        updatedEntries[index] = stampEntryIntegrity(entry);
      }
    }
  });

  if (flags.fix && mismatches.length) {
    store.writeVault({ ...vault, entries: updatedEntries, updatedAt: new Date().toISOString() });
    stdout.write(`Applied integrity fixes to ${mismatches.length} entr${mismatches.length === 1 ? "y" : "ies"}.\n`);
  }

  if (!mismatches.length) {
    stdout.write(`Integrity OK • ${entries.length} entr${entries.length === 1 ? "y" : "ies"} verified.\n`);
  } else {
    stdout.write(`Integrity FAIL • ${mismatches.length} entr${mismatches.length === 1 ? "y" : "ies"} mismatched.\n`);
    mismatches.forEach((item) =>
      stdout.write(` - ${item.id} (${item.name || ""}) • ${item.reason}\n`)
    );
  }

  return { ok: mismatches.length === 0, mismatches };
}

module.exports = { verifyVault };
