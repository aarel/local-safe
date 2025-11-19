module.exports = {
  encrypt: ({ plaintext }) => ({ ciphertext: Buffer.from(plaintext).toString("base64") }),
  decrypt: ({ payload }) => Buffer.from(payload.ciphertext, "base64").toString("utf8"),
};
