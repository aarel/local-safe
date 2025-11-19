function toDomain(url = "") {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    const match = url.match(/^(?:https?:\/\/)?([^/]+)/i);
    return match ? match[1] : "";
  }
}

function matchesTag(entryTags = [], requiredTag) {
  if (!requiredTag) return true;
  const normalized = requiredTag.toLowerCase();
  return entryTags.some((tag) => tag.toLowerCase() === normalized);
}

function matchesDomain(entryUrl = "", requiredDomain) {
  if (!requiredDomain) return true;
  const normalized = requiredDomain.toLowerCase();
  return toDomain(entryUrl).toLowerCase() === normalized;
}

function listEntries({ store, stdout }, flags = {}) {
  const vault = store.readVault();
  if (!vault) {
    stdout.write("Vault not initialized. Run `localsafe init` first.\n");
    return [];
  }

  const entries = Array.isArray(vault.entries) ? vault.entries : [];
  if (!entries.length) {
    stdout.write("Vault empty. Add credentials with `localsafe add`.\n");
    return [];
  }

  const filterTag = flags.tag || flags.tags || null;
  const filterDomain = flags.domain || null;

  const filtered = entries.filter(
    (entry) =>
      matchesTag(entry.tags || [], filterTag) && matchesDomain(entry.url, filterDomain)
  );

  if (!filtered.length) {
    stdout.write("No entries matched the provided filters.\n");
    return [];
  }

  const rows = filtered.map((entry, index) => ({
    index: index + 1,
    id: entry.id,
    name: entry.name,
    username: entry.username || "",
    url: entry.url || "",
    domain: toDomain(entry.url),
    tags: (entry.tags || []).join(","),
    updatedAt: entry.updatedAt || "",
  }));

  const header = ["#", "Name", "Username", "URL", "Domain", "Tags", "Updated"];
  const widths = header.map((column) => column.length);

  rows.forEach((row) => {
    widths[0] = Math.max(widths[0], String(row.index).length);
    widths[1] = Math.max(widths[1], row.name.length);
    widths[2] = Math.max(widths[2], row.username.length);
    widths[3] = Math.max(widths[3], row.url.length);
    widths[4] = Math.max(widths[4], row.domain.length);
    widths[5] = Math.max(widths[5], row.tags.length);
    widths[6] = Math.max(widths[6], row.updatedAt.length);
  });

  function pad(value, width) {
    return value.padEnd(width);
  }

  const lines = [];
  lines.push(
    [
      pad(header[0], widths[0]),
      pad(header[1], widths[1]),
      pad(header[2], widths[2]),
      pad(header[3], widths[3]),
      pad(header[4], widths[4]),
      pad(header[5], widths[5]),
      pad(header[6], widths[6]),
    ].join("  ")
  );
  lines.push(widths.map((width) => "-".repeat(width)).join("  "));

  rows.forEach((row) => {
    lines.push(
      [
        pad(String(row.index), widths[0]),
        pad(row.name, widths[1]),
        pad(row.username, widths[2]),
        pad(row.url, widths[3]),
        pad(row.domain, widths[4]),
        pad(row.tags, widths[5]),
        pad(row.updatedAt, widths[6]),
      ].join("  ")
    );
  });

  stdout.write(`${lines.join("\n")}\n`);
  return rows;
}

module.exports = { listEntries, toDomain, matchesTag, matchesDomain };
