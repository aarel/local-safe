function parseTags(flagsValue) {
  if (!flagsValue) {
    return [];
  }

  if (Array.isArray(flagsValue)) {
    return flagsValue
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => Boolean(value));
  }

  return String(flagsValue)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => Boolean(value));
}

module.exports = { parseTags };
