const crypto = require("node:crypto");

function normalizeEntry(entry) {
  return {
    id: entry.id,
    name: entry.name || "",
    username: entry.username || "",
    url: entry.url || "",
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    secret: entry.secret,
  };
}

function computeEntryDigest(entry) {
  const normal = normalizeEntry(entry);
  const payload = JSON.stringify(normal);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function stampEntryIntegrity(entry) {
  const digest = computeEntryDigest(entry);
  const meta = { ...(entry.meta || {}), integrity: digest };
  return { ...entry, meta };
}

module.exports = { computeEntryDigest, stampEntryIntegrity };
