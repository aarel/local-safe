function buildVaultTemplate() {
  const timestamp = new Date().toISOString();
  return {
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    entries: [],
    trash: [],
  };
}

async function initVault({ store, stdout }) {
  const existing = store.readVault();
  if (existing) {
    stdout.write(`Vault already exists at ${store.path}\n`);
    return existing;
  }

  const template = buildVaultTemplate();
  store.writeVault(template);
  stdout.write(`Created new vault at ${store.path}\n`);
  return template;
}

module.exports = { initVault, buildVaultTemplate };
