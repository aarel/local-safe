const readline = require("node:readline/promises");

const { initVault } = require("./commands/init");
const { addEntry } = require("./commands/add");
const { viewEntry } = require("./commands/view");
const { exportVault } = require("./commands/export");
const { listEntries } = require("./commands/list");
const { tagEntry } = require("./commands/tag");
const { deleteEntry } = require("./commands/delete");
const { updateEntry } = require("./commands/update");
const { listTrash, restoreFromTrash, purgeTrash } = require("./commands/trash");
const { verifyVault } = require("./commands/verify");
const { promptHidden, promptInput } = require("./utils/prompts");

function parseFlags(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const [keyPart, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[keyPart] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[keyPart] = next;
      index += 1;
    } else {
      parsed[keyPart] = true;
    }
  }
  return parsed;
}

async function ensurePassphrase(flags, io, stderr, message = "Passphrase: ") {
  if (flags.passphrase) {
    return flags.passphrase;
  }
  try {
    const passphrase = await promptHidden(io, message);
    if (!passphrase) {
      stderr.write("Passphrase cannot be empty.\n");
      return null;
    }
    flags.passphrase = passphrase;
    return passphrase;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return null;
  }
}

async function ensureConfirmation(flags, key, expected, io, stderr, promptMessage) {
  if (flags[key] === expected) {
    return true;
  }
  try {
    const answer = await promptInput(io, promptMessage);
    if (answer === expected) {
      flags[key] = expected;
      return true;
    }
    stderr.write(`Confirmation mismatch. Expected '${expected}'.\n`);
    return false;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return false;
  }
}

function resolveCli(dependencies) {
  const { store, crypto, audit, config, io = {}, workingDirectory } = dependencies;
  const stdin = io.stdin || process.stdin;
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;

  function printHelp() {
    stdout.write("Usage: localsafe <command> [options]\n\n");
    stdout.write("Commands:\n");
    stdout.write("  status                Show vault location and entry count\n");
    stdout.write("  init                  Create a new vault file if missing\n");
    stdout.write(
      "  add [options]         Add a credential entry. Requires --passphrase and --secret.\n"
    );
    stdout.write(
      "  list [options]        Show entry metadata without decrypting secrets (supports --tag, --domain).\n"
    );
    stdout.write(
      "  view [options]        View a decrypted entry. Requires --passphrase and (--id | --name).\n"
    );
    stdout.write(
      "  export [options]      Export vault data (default stdout). Use --dest <path> to write file.\n"
    );
    stdout.write(
      "  tag [options]         Replace tags for an entry. Requires (--id | --name) and --tags value.\n"
    );
    stdout.write(
      "  delete [options]      Remove entries by id/name/tag/domain (use --soft to stage, requires --confirm delete).\n"
    );
    stdout.write("  verify [--fix]        Check integrity digests and optionally repair missing/mismatched ones.\n");
    stdout.write(
      "  update [options]      Modify metadata or secrets for an entry. Use --id|--name selectors.\n"
    );
    stdout.write(
      "  trash <action>        Manage archived entries. Actions: list, restore, purge (--before <date> | --older-than 7d).\n"
    );
    stdout.write("  help                  Show this help output\n\n");
    stdout.write("Examples:\n");
    stdout.write(
      "  localsafe init\n  localsafe add --name Email --username alice --secret \"p@55\" --passphrase dev\n"
    );
    stdout.write(
      "  localsafe view --name Email --passphrase dev\n  localsafe export --pretty --dest backups/vault.json\n  localsafe list --tag personal\n  localsafe tag --name Email --tags personal,mail\n  localsafe update --id <entry> --username newuser\n  localsafe trash list\n"
    );
    return null;
  }

  function handleStatus() {
    const vault = store.readVault();
    const auditPath = config?.paths?.auditLog;

    if (!vault) {
      stdout.write(`Vault missing • initialize with \`localsafe init\`\n`);
      if (auditPath) {
        stdout.write(`Audit log target • ${auditPath}\n`);
      }
      return null;
    }

    const entryCount = Array.isArray(vault.entries) ? vault.entries.length : 0;
    const trashCount = Array.isArray(vault.trash) ? vault.trash.length : 0;
    const suffix = entryCount === 1 ? "entry" : "entries";
    stdout.write(
      `Vault ready • ${entryCount} ${suffix} stored • path: ${store.path}\n`
    );
    stdout.write(`Trash contains ${trashCount} item${trashCount === 1 ? "" : "s"}\n`);
    if (auditPath) {
      stdout.write(`Audit log target • ${auditPath}\n`);
    }
    return vault;
  }

  async function handleCommand(command, args) {
    switch (command) {
      case "status":
        return handleStatus();
      case "init":
        return initVault({ store, stdout });
      case "add": {
        const flags = parseFlags(args);
        if (!flags.passphrase) {
          const provided = await ensurePassphrase(flags, io, stderr, "Vault passphrase: ");
          if (!provided) {
            return null;
          }
        }
        const result = await addEntry(
          { store, crypto, stdout, stderr, workingDirectory },
          flags
        );
        if (result) {
          audit.record("add_entry", {
            id: result.id,
            name: result.name,
            tags: result.tags,
          });
        }
        return result;
      }
      case "list": {
        const flags = parseFlags(args);
        return listEntries({ store, stdout }, flags);
      }
      case "view": {
        const flags = parseFlags(args);
        if (!flags.passphrase) {
          const provided = await ensurePassphrase(flags, io, stderr, "Passphrase: ");
          if (!provided) {
            return null;
          }
        }
        const result = await viewEntry({ store, crypto, stdout, stderr }, flags);
        if (result) {
          audit.record("view_entry", {
            id: result.id,
            name: result.name,
            tags: result.tags,
          });
        }
        return result;
      }
      case "export": {
        const flags = parseFlags(args);
        if (!flags.dest && flags.confirm !== "export") {
          const confirmed = await ensureConfirmation(
            flags,
            "confirm",
            "export",
            io,
            stderr,
            "Type 'export' to stream decrypted vault to stdout: "
          );
          if (!confirmed) {
            return null;
          }
        }
        const result = exportVault({ store, stdout, stderr }, flags);
        if (result) {
          audit.record("export_vault", {
            destination: result.destination,
            format: result.format,
          });
        }
        return result;
      }
      case "tag": {
        const flags = parseFlags(args);
        const result = tagEntry({ store, stdout }, flags);
        if (result) {
          audit.record("update_tags", {
            id: result.id,
            name: result.name,
            tags: result.tags,
          });
        }
        return result;
      }
      case "update": {
        const flags = parseFlags(args);
        const needsSecretUpdate = Boolean(flags.secret || flags.note);
        const wantsRotation = Boolean(flags["new-passphrase"] || flags.newPassphrase);
        if ((needsSecretUpdate || wantsRotation) && !flags.passphrase) {
          const provided = await ensurePassphrase(flags, io, stderr, "Passphrase: ");
          if (!provided) {
            return null;
          }
        }
        if (wantsRotation && !flags["new-passphrase"]) {
          const tempFlags = { passphrase: null };
          const nextPass = await ensurePassphrase(tempFlags, io, stderr, "New passphrase: ");
          if (!nextPass) {
            return null;
          }
          flags["new-passphrase"] = nextPass;
        }
        const result = updateEntry({ store, crypto, stdout }, flags);
        if (result) {
          audit.record("update_entry", {
            id: result.id,
            name: result.name,
            tags: result.tags,
          });
        }
        return result;
      }
      case "delete": {
        const flags = parseFlags(args);
        if (!flags.soft && flags.confirm !== "delete") {
          const confirmed = await ensureConfirmation(
            flags,
            "confirm",
            "delete",
            io,
            stderr,
            "Type 'delete' to confirm removal: "
          );
          if (!confirmed) {
            return null;
          }
        }
        const results = deleteEntry({ store, stdout }, flags) || [];
        results.forEach((entry) =>
          audit.record("delete_entry", {
            id: entry.id,
            name: entry.name,
            tags: entry.tags,
            softDelete: entry.softDelete,
          })
        );
        return results.length ? results : null;
      }
      case "verify": {
        const flags = parseFlags(args);
        return verifyVault({ store, stdout }, flags);
      }
      case "help":
      case "--help":
      case "-h":
        return printHelp();
      case "trash": {
        const [action, ...trashArgs] = args;
        const flags = parseFlags(trashArgs);
        switch (action) {
          case "list": {
            const result = listTrash({ store, stdout }, flags);
            if (result) {
              audit.record("trash_list", { count: result.length });
            }
            return result;
          }
          case "restore": {
            const confirmed = await ensureConfirmation(
              flags,
              "confirm",
              "restore",
              io,
              stderr,
              "Type 'restore' to confirm undeleting: "
            );
            if (!confirmed) {
              return null;
            }
            const restored = restoreFromTrash({ store, stdout }, flags);
            if (restored) {
              audit.record("trash_restore", { id: restored.id, name: restored.name });
            }
            return restored;
          }
          case "purge": {
            if (flags.confirm !== "purge") {
              const confirmed = await ensureConfirmation(
                flags,
                "confirm",
                "purge",
                io,
                stderr,
                "Type 'purge' to empty trash: "
              );
              if (!confirmed) {
                return null;
              }
            }
            const purged = purgeTrash({ store, stdout }, flags);
            if (purged) {
              audit.record("trash_purge", { count: purged.length });
            }
            return purged;
          }
          default:
            stdout.write("Usage: localsafe trash <list|restore|purge> [options]\n");
            return null;
        }
      }
      default:
        stdout.write(`Unknown command: ${command}\n`);
        stdout.write("Run `localsafe help` for a full list of commands.\n");
        return null;
    }
  }

  async function startInteractive() {
    stdout.write("LocalSafe shell ready. Type `help` for commands, `exit` to quit.\n");
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
      prompt: "localsafe> ",
    });

    rl.prompt();
    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) {
          rl.prompt();
          continue;
        }
        if (trimmed === "exit") {
          break;
        }
        const tokens = trimmed.split(/\s+/);
        await handleCommand(tokens[0], tokens.slice(1));
        rl.prompt();
      }
    } finally {
      rl.close();
    }
    return null;
  }

  async function run(argv = []) {
    if (!argv.length) {
      return startInteractive();
    }
    const [command, ...args] = argv;
    return handleCommand(command, args);
  }

  return { run };
}

module.exports = { resolveCli };
