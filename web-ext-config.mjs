export default {
  ignoreFiles: [
    "test",
    "docs",
    "scripts",
    "dist",
    ".github",
    "icons/*.png",
    "package.json",
    "package-lock.json",
    "web-ext-config.mjs",
    "README.md",
    "CHANGELOG.md",
  ],
  build: {
    overwriteDest: true,
    filename: "paramlet-{version}-firefox.zip",
  },
};
