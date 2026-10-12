export default {
  ignoreFiles: [
    "test",
    "docs",
    ".github",
    "package.json",
    "package-lock.json",
    "web-ext-config.mjs",
    "CHANGELOG.md",
  ],
  build: {
    overwriteDest: true,
  },
};
