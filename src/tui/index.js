#!/usr/bin/env node

const readline = require("node:readline/promises");
const { stdin, stdout, stderr } = require("node:process");

const fs = require("node:fs");
const { loadConfig } = require("../config");
const { createVaultStore } = require("../storage/filesystemStore");
const { buildCryptoSuite } = require("../crypto/vault");
const { promptHidden, promptInput } = require("../app/utils/prompts");
const { viewEntry } = require("../app/commands/view");
const { restoreFromTrash } = require("../app/commands/trash");
const { deleteEntry } = require("../app/commands/delete");
const { addEntry } = require("../app/commands/add");
const { updateEntry } = require("../app/commands/update");
const { verifyVault } = require("../app/commands/verify");
const { computeEntryDigest } = require("../app/utils/integrity");
const MAX_AUDIT_LINES = 10;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function promptText(message, defaultValue = "") {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await promptInput({ stdin, stdout }, `${message}${suffix}: `);
  return answer.trim() || defaultValue;
}

async function collectEntryFields(defaults = {}) {
  const name = (await promptText("Name", defaults.name || "")).trim();
  const username = await promptText("Username", defaults.username || "");
  const url = await promptText("URL", defaults.url || "");
  const tagsInput = await promptText(
    "Tags (comma-separated)",
    (defaults.tags || []).join(", ")
  );
  const note = await promptText("Note", defaults.note || "");
  return {
    name: name || defaults.name || "Untitled",
    username,
    url,
    tags: tagsInput
      ? tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : defaults.tags || [],
    note,
  };
}

function resolveEntry(vault, target) {
  if (!vault || !vault.entries) return null;
  return (
    vault.entries.find((entry) => entry.id === target) ||
    vault.entries[Number(target) - 1] ||
    null
  );
}

function getAuditSummary(auditPath, limit = 5) {
  if (!auditPath || !fs.existsSync(auditPath)) {
    return { total: 0, events: [] };
  }
  const lines = fs
    .readFileSync(auditPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const events = lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });
  return { total: lines.length, events };
}

function getIntegritySummary(vault) {
  if (!vault || !Array.isArray(vault.entries)) {
    return { mismatches: 0 };
  }
  const issues = vault.entries.reduce((count, entry) => {
    if (!entry.meta?.integrity) {
      return count + 1;
    }
    try {
      const digest = computeEntryDigest(entry);
      return digest === entry.meta.integrity ? count : count + 1;
    } catch {
      return count + 1;
    }
  }, 0);
  return { mismatches: issues };
}

function renderDashboard(vault, filters, auditSummary) {
  console.clear();
  console.log("LocalSafe Ops Dashboard");
  console.log("=======================\n");

  if (!vault) {
    console.log("Vault missing. Run `localsafe init` first.\n");
    return null;
  }

  const totalEntries = Array.isArray(vault.entries) ? vault.entries.length : 0;
  const trashCount = Array.isArray(vault.trash) ? vault.trash.length : 0;
  const integrity = getIntegritySummary(vault);
  const filterLabel = [
    filters.filterTag ? `tag=${filters.filterTag}` : null,
    filters.filterDomain ? `domain=${filters.filterDomain}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  console.log("Stats                | Value");
  console.log("-------------------- | -----");
  console.log(`Entries              | ${totalEntries}`);
  console.log(`Trash                | ${trashCount}`);
  console.log(`Integrity warnings    | ${integrity.mismatches}`);
  console.log(`Active filters        | ${filterLabel || "(none)"}`);
  if (auditSummary.events.length) {
    const last = auditSummary.events[auditSummary.events.length - 1];
    console.log(`Last audit event      | ${last.timestamp || "n/a"} (${last.event || last.raw || "raw"})`);
  }
  console.log();

  if (trashCount > 20) {
    console.log("⚠  Trash backlog exceeds 20 items — consider purging.");
  }
  if (integrity.mismatches > 0) {
    console.log("⚠  Integrity mismatches detected — run `verify fix`.");
  }
  console.log();

  return integrity;
}

function renderEntries(vault, filters = {}, auditSummary = { total: 0, events: [] }) {
  const integrity = renderDashboard(vault, filters, auditSummary);
  if (!vault) {
    return;
  }

  let entries = Array.isArray(vault.entries) ? vault.entries : [];
  if (filterTag) {
    const tagMatch = filterTag.toLowerCase();
    entries = entries.filter((entry) =>
      (entry.tags || []).some((tag) => tag.toLowerCase() === tagMatch)
    );
  }
  if (filterDomain) {
    const domainMatch = filterDomain.toLowerCase();
    entries = entries.filter((entry) => {
      try {
        return new URL(entry.url || "").hostname.toLowerCase() === domainMatch;
      } catch {
        return false;
      }
    });
  }

  if (!entries.length) {
    console.log("No entries found with the current filter.\n");
    return;
  }

  console.log("Index  Name                    Tags");
  console.log("-----  ----------------------  ----------------");
  entries.slice(0, 50).forEach((entry, index) => {
    const name = (entry.name || "Untitled").padEnd(22).slice(0, 22);
    const tags = (entry.tags || []).join(", ");
    console.log(String(index + 1).padEnd(5), name, tags);
  });
  console.log(
    "\nCommands: status, monitor <sec> [cycles], add, update <index|id>, view <index|id>, info <index|id>, soft-delete <index|id>, trash, restore <id>, verify [fix], audit, filter tag=<tag>, filter domain=<host>, clear, refresh, help, quit"
  );
  return entries;
}

async function handleView({ store, crypto }, vault, target) {
  if (!vault || !vault.entries || !vault.entries.length) {
    console.log("Vault empty.");
    return;
  }

  let entry =
    vault.entries.find((item) => item.id === target) ||
    vault.entries[Number(target) - 1];

  if (!entry) {
    console.log("Entry not found.");
    return;
  }

  let passphrase;
  try {
    passphrase = await promptHidden({}, "Passphrase: ");
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return;
  }

  const result = await viewEntry(
    { store, crypto, stdout },
    { id: entry.id, passphrase }
  );

  if (!result) {
    return;
  }

  console.log("\n=== Entry Details ===");
  console.log(`Name:      ${result.name}`);
  console.log(`Username:  ${result.username || ""}`);
  console.log(`URL:       ${result.url || ""}`);
  console.log(`Tags:      ${(result.tags || []).join(", ")}`);
  console.log(`Secret:    ${result.secret}`);
  console.log(`Note:      ${result.note || ""}`);
  console.log("======================\n");
}

function showAuditSummary(auditPath) {
  if (!auditPath || !fs.existsSync(auditPath)) {
    console.log("Audit log not found.");
    return;
  }
  const lines = fs.readFileSync(auditPath, "utf8").trim().split(/\r?\n/);
  const recent = lines.slice(-MAX_AUDIT_LINES);
  console.log("\nRecent Audit Events:");
  recent.forEach((line) => {
    try {
      const event = JSON.parse(line);
      console.log(
        `${event.timestamp} • ${event.event} • ${event.name || event.dest || event.destination || ""}`
      );
    } catch {
      console.log(line);
    }
  });
  console.log();
}

async function main() {
  const config = loadConfig();
  const store = createVaultStore(config.paths.vault);
  const crypto = await buildCryptoSuite(config.crypto);

  let vault = store.readVault();
  let filters = {};
  let auditSummary = getAuditSummary(config.paths.auditLog);
  renderEntries(vault, filters, auditSummary);

  const rl = readline.createInterface({ input: stdin, output: stdout, prompt: "tui> " });
  rl.prompt();

  try {
    for await (const line of rl) {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        continue;
      }
      if (input === "quit" || input === "q" || input === "exit") {
        break;
      }
      if (input === "refresh" || input === "r") {
        vault = store.readVault();
        auditSummary = getAuditSummary(config.paths.auditLog);
        renderEntries(vault, filters, auditSummary);
        rl.prompt();
        continue;
      }

      if (input.startsWith("monitor")) {
        const [, intervalArg, cyclesArg] = input.split(/\s+/);
        const seconds = Number(intervalArg) > 0 ? Number(intervalArg) : 5;
        const cycles = Number(cyclesArg) > 0 ? Number(cyclesArg) : 12;
        console.log(`Monitoring every ${seconds}s for ${cycles} cycle(s)...`);
        for (let i = 0; i < cycles; i += 1) {
          vault = store.readVault();
          auditSummary = getAuditSummary(config.paths.auditLog);
          renderEntries(vault, filters, auditSummary);
          console.log(`Monitor cycle ${i + 1}/${cycles}`);
          if (i < cycles - 1) {
            await sleep(seconds * 1000);
          }
        }
        console.log("Monitor mode complete.\n");
        rl.prompt();
        continue;
      }

      if (input === "add") {
        const fields = await collectEntryFields({});
        let secret;
        let note = "";
        try {
          secret = await promptHidden({ stdin, stdout }, "Secret: ");
          note = await promptText("Note", "");
        } catch (error) {
          stderr.write(`${error.message}\n`);
          rl.prompt();
          continue;
        }
        let passphrase;
        try {
          passphrase = await promptHidden({ stdin, stdout }, "Passphrase: ");
        } catch (error) {
          stderr.write(`${error.message}\n`);
          rl.prompt();
          continue;
        }
        if (!secret || !passphrase) {
          console.log("Secret and passphrase are required.");
          rl.prompt();
          continue;
        }
        const entry = await addEntry(
          { store, crypto, stdout },
          {
            name: fields.name,
            username: fields.username,
            url: fields.url,
            tags: fields.tags,
            secret,
            note: fields.note,
            passphrase,
          }
        );
        if (entry) {
          vault = store.readVault();
          auditSummary = getAuditSummary(config.paths.auditLog);
          renderEntries(vault, filters, auditSummary);
        }
        rl.prompt();
        continue;
      }
      if (input === "help") {
        console.log("Commands:");
        console.log("  status           - redraw dashboard with latest stats");
        console.log("  add              - add a credential via prompts");
        console.log("  update <idx|id>  - edit metadata/secret/passphrase");
        console.log("  view <idx|id>    - decrypt and view an entry");
        console.log("  info <idx|id>    - show metadata without decrypting");
        console.log("  soft-delete <..> - stage removal (trash)");
        console.log("  trash            - list trash entries");
        console.log("  restore <id>     - restore an entry from trash");
        console.log("  verify [fix]     - run integrity checks (optionally fix)");
        console.log("  audit            - show recent audit events");
        console.log("  filter tag=<tag> or domain=<host>");
        console.log("  clear            - clear filters");
        console.log("  refresh          - reload vault contents");
        console.log("  quit             - exit TUI\n");
        rl.prompt();
        continue;
      }
      if (input.startsWith("view")) {
        const [, target] = input.split(/\s+/, 2);
        if (!target) {
          console.log("Usage: view <index|id>");
        } else {
          await handleView({ store, crypto }, vault, target);
        }
        rl.prompt();
        continue;
      }

      if (input.startsWith("update")) {
        const [, target] = input.split(/\s+/, 2);
        if (!target) {
          console.log("Usage: update <index|id>");
        } else {
          const entry = resolveEntry(vault, target);
          if (!entry) {
            console.log("Entry not found.");
          } else {
            const fields = await collectEntryFields(entry);
            const updates = { id: entry.id };
            if (fields.name !== entry.name) {
              updates["new-name"] = fields.name;
            }
            if (fields.username !== entry.username) {
              updates.username = fields.username;
            }
            if (fields.url !== entry.url) {
              updates.url = fields.url;
            }
            if (fields.tags.join(",") !== (entry.tags || []).join(",")) {
              updates.tags = fields.tags;
            }
            if ((fields.note || "") !== (entry.note || "")) {
              updates.note = fields.note;
            }
            const changeSecret = (await promptText("Change secret? (y/N)", "N")).toLowerCase() === "y";
            if (changeSecret) {
              try {
                const newSecret = await promptHidden({ stdin, stdout }, "New secret: ");
                if (newSecret) {
                  updates.secret = newSecret;
                }
              } catch (error) {
                stderr.write(`${error.message}\n`);
              }
            }
            const rotate = (await promptText("Rotate passphrase? (y/N)", "N")).toLowerCase() === "y";
            if (rotate) {
              try {
                updates.passphrase = await promptHidden({ stdin, stdout }, "Current passphrase: ");
                updates["new-passphrase"] = await promptHidden({ stdin, stdout }, "New passphrase: ");
              } catch (error) {
                stderr.write(`${error.message}\n`);
              }
            } else if (changeSecret && !updates.passphrase) {
              try {
                updates.passphrase = await promptHidden({ stdin, stdout }, "Passphrase: ");
              } catch (error) {
                stderr.write(`${error.message}\n`);
              }
            }

            const result = updateEntry({ store, crypto, stdout }, updates);
            if (result) {
              vault = store.readVault();
              auditSummary = getAuditSummary(config.paths.auditLog);
              renderEntries(vault, filters, auditSummary);
            }
          }
        }
        rl.prompt();
        continue;
      }

      if (input.startsWith("info")) {
        const [, target] = input.split(/\s+/, 2);
        if (!target) {
          console.log("Usage: info <index|id>");
        } else {
          const entries = renderEntries(vault, filters, auditSummary) || [];
          const entry = entries.find((item) => item.id === target) || entries[Number(target) - 1];
          if (!entry) {
            console.log("Entry not found.");
          } else {
            console.log("\nEntry Info:");
            console.log(`Name: ${entry.name}`);
            console.log(`Username: ${entry.username || ""}`);
            console.log(`URL: ${entry.url || ""}`);
            console.log(`Tags: ${(entry.tags || []).join(", ")}`);
            console.log(`Updated: ${entry.updatedAt}`);
            console.log();
          }
        }
        rl.prompt();
        continue;
      }

      if (input === "trash") {
        const trash = Array.isArray(vault?.trash) ? vault.trash : [];
        if (!trash.length) {
          console.log("Trash empty.");
        } else {
          console.log("\nTrash Entries:");
          trash.forEach((item, index) => {
            console.log(
              `${index + 1}. ${item.entry.name} (${item.entry.id}) • action=${item.action} • archived=${item.timestamp}`
            );
          });
          console.log();
        }
        rl.prompt();
        continue;
      }

      if (input.startsWith("restore")) {
        const [, target] = input.split(/\s+/, 2);
        if (!target) {
          console.log("Usage: restore <entryId>");
        } else {
          const restored = restoreFromTrash({ store, stdout }, { id: target, confirm: "restore" });
          if (restored) {
            vault = store.readVault();
            auditSummary = getAuditSummary(config.paths.auditLog);
            renderEntries(vault, filters, auditSummary);
          } else {
            console.log("Trash entry not found or restore failed.");
          }
        }
        rl.prompt();
        continue;
      }

      if (input.startsWith("soft-delete")) {
        const [, target] = input.split(/\s+/, 2);
        if (!target) {
          console.log("Usage: soft-delete <index|id>");
        } else {
          const entries = Array.isArray(vault?.entries) ? vault.entries : [];
          const entry =
            entries.find((item) => item.id === target) || entries[Number(target) - 1];
          if (!entry) {
            console.log("Entry not found.");
          } else {
            const result = deleteEntry({ store, stdout }, { id: entry.id, confirm: "delete", soft: true });
            if (result) {
              vault = store.readVault();
              auditSummary = getAuditSummary(config.paths.auditLog);
              renderEntries(vault, filters, auditSummary);
            }
          }
        }
        rl.prompt();
        continue;
      }

      if (input === "status") {
        auditSummary = getAuditSummary(config.paths.auditLog);
        renderEntries(vault, filters, auditSummary);
        rl.prompt();
        continue;
      }

      if (input === "audit") {
        showAuditSummary(config.paths.auditLog);
        rl.prompt();
        continue;
      }

      if (input.startsWith("verify")) {
        const shouldFix = input.includes("fix");
        const result = verifyVault({ store, stdout }, { fix: shouldFix });
        if (result) {
          vault = store.readVault();
          auditSummary = getAuditSummary(config.paths.auditLog);
        }
        rl.prompt();
        continue;
      }

      if (input.startsWith("filter")) {
        const [, expression] = input.split(/\s+/, 2);
        if (!expression) {
          console.log("Usage: filter tag=<tag> | filter domain=<domain>");
        } else if (expression.startsWith("tag=")) {
          filters.filterTag = expression.slice(4);
          renderEntries(vault, filters);
        } else if (expression.startsWith("domain=")) {
          filters.filterDomain = expression.slice(7);
          renderEntries(vault, filters);
        } else {
          console.log("Unrecognized filter. Use tag=<tag> or domain=<host>.");
        }
        rl.prompt();
        continue;
      }

      if (input === "clear") {
        filters = {};
        renderEntries(vault, filters, auditSummary);
        rl.prompt();
        continue;
      }

      console.log("Unknown command. Type 'help' for options.");
      rl.prompt();
    }
  } finally {
    rl.close();
    console.log("Goodbye.");
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("TUI error:", error);
    process.exit(1);
  });
}
