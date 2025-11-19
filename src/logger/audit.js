const fs = require("node:fs");
const path = require("node:path");

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createAuditLogger(logPath, options = {}) {
  const resolved = path.resolve(logPath);
  const writer =
    options.writer ||
    ((line) => {
      ensureDirectory(resolved);
      fs.appendFileSync(resolved, line);
    });

  function record(eventType, payload = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      event: eventType,
      ...payload,
    };
    writer(`${JSON.stringify(entry)}\n`);
    return entry;
  }

  return { record, path: resolved };
}

module.exports = { createAuditLogger };
