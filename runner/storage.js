const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureStorage(settings) {
  const userRoot = path.resolve(
    __dirname,
    "..",
    settings.storage.rootDir,
    settings.storage.subdir
  );

  [
    userRoot,
    path.join(userRoot, settings.storage.logsDirName),
    path.join(userRoot, settings.storage.screenshotsDirName),
    path.join(userRoot, settings.storage.outputsDirName),
    path.join(userRoot, settings.storage.exportsDirName),
    path.join(userRoot, settings.storage.templatesDirName),
    path.join(
      userRoot,
      settings.storage.browserProfilesDirName || "browser-profile"
    )
  ].forEach(ensureDir);
}

function writeRunLog(context, payload) {
  const filePath = path.join(context.storage.logsDir, `${context.runId}.log.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function writeRunOutput(context, payload) {
  const filePath = path.join(context.storage.outputsDir, `${context.runId}.result.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

module.exports = {
  ensureStorage,
  writeRunLog,
  writeRunOutput
};
