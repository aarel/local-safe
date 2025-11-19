const crypto = require("node:crypto");

const DEFAULTS = {
  algorithm: "aes-256-gcm",
  iterations: 210000,
  keySize: 32,
};

function deriveKey(passphrase, salt, { iterations, keySize }) {
  return crypto.pbkdf2Sync(passphrase, salt, iterations, keySize, "sha512");
}

async function buildCryptoSuite(options = {}) {
  const config = { ...DEFAULTS, ...options };

  function encrypt({ passphrase, plaintext }) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = deriveKey(passphrase, salt, config);

    const cipher = crypto.createCipheriv(config.algorithm, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      algorithm: config.algorithm,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  function decrypt({ passphrase, payload }) {
    const salt = Buffer.from(payload.salt, "base64");
    const iv = Buffer.from(payload.iv, "base64");
    const authTag = Buffer.from(payload.authTag, "base64");
    const ciphertext = Buffer.from(payload.ciphertext, "base64");

    const key = deriveKey(passphrase, salt, config);
    const decipher = crypto.createDecipheriv(config.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  }

  return {
    encrypt,
    decrypt,
    getDefaults: () => ({ ...config }),
  };
}

module.exports = { buildCryptoSuite, DEFAULTS };
