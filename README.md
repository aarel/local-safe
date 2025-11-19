# LocalSafe

LocalSafe is an offline credential vault scaffold that combines a CLI and TUI for managing encrypted entries, trash lifecycle, and integrity verification. The project focuses on security-first workflows: masked prompts, per-entry digests, audit logging, and automated trash retention keep secrets resilient during local development.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Initialize the vault (creates `assets/sample-vault.json` structure if absent):
   ```bash
   npm start -- init
   ```
3. Add a credential:
   ```bash
   npm start -- add --name "Email" --username alice --secret "p@ss" --passphrase myvaultpass
   ```
4. Inspect via the CLI:
   ```bash
   npm start -- status
   npm start -- list --tag personal
   npm start -- view --name Email --passphrase myvaultpass
   ```
5. Launch the TUI dashboard for day-to-day operations:
   ```bash
   npm run tui
   ```
   The TUI offers commands such as `status`, `monitor`, `add`, `update`, `view`, `info`, `soft-delete`, `trash`, `restore`, `verify`, `audit`, `filter`, and `clear`. Prompts mask passphrases and secrets automatically.

## Key Commands

| Command | Description |
| --- | --- |
| `npm start -- status` | Shows vault readiness, entry counts, trash backlog, audit log path. |
| `npm start -- add --name ... --secret ... --passphrase ...` | Adds an entry (encrypted secret + metadata). |
| `npm start -- update --id ... [--new-name --username --url --tags --secret --note --new-passphrase] --passphrase ...` | Updates metadata, rotates passphrases, or replaces secrets. |
| `npm start -- delete --id ... --confirm delete` | Hard deletes (moves snapshot to trash); add `--soft` to stage the removal. |
| `npm start -- trash list|restore|purge` | Manages trash with filters (`--before`, `--older-than 7d`). |
| `npm start -- verify [--fix]` | Verifies per-entry integrity digests and optionally repairs them. |
| `npm run tui` | Opens the full TUI dashboard. |

## Integrity & Retention

- Each entry stores a SHA-256 digest of its normalized fields. `add`/`update` stamp these digests, and `verify` recomputes them to detect tampering.
- `retention.trashOlderThan` (set in config) automatically purges trash items older than the configured duration at startup. `trash purge --before <date>` and `--older-than 7d` provide manual controls.

## Audit Logging

All sensitive operations (`add`, `view`, `update`, `delete`, `trash restore/purge`, `export`, etc.) append JSON lines to `logs/activity.log`. The TUI’s `audit` command tails the most recent events, and `monitor` mode refreshes stats periodically for a real-time view.

## Development Scripts

- `npm start -- <command>`: Run any CLI command (status, add, list, verify, trash ...).
- `npm run tui`: Launch the dashboard.
- `npm test`: Run the test suite (node's built-in test runner).
- `npm run lint`: Prettier check for `src/**/*.js` and `tests/**/*.js`.

## Project Structure

```
├── assets/                # Sample vault data / fixtures
├── src/
│   ├── app/               # Core CLI commands, config, prompts, integrity
│   ├── crypto/            # Encryption helpers
│   ├── storage/           # Filesystem vault persistence
│   └── tui/               # TUI dashboard entrypoint
├── tests/                 # node:test suites (app commands, utils)
└── logs/                  # Activity log (ignored until generated)
```

## Security Notes

- Secrets and passphrases are never echoed; prompts mask input when possible.
- No data leaves the local filesystem; ensure the vault JSON and audit log directories are protected with OS permissions.
- Trash retains snapshots for forensic recovery—use `trash purge` or retention policies to avoid long-term buildup.
- Always run `npm start -- verify` periodically or before shipment to ensure entries still match their integrity digests.

## Contributing

See `AGENTS.md` for detailed repository guidelines, coding style, retention policies, and the expanded TUI command reference.
