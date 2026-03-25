const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const settingsBasePath = path.join(projectRoot, "config", "settings.base.json");
const usersDir = path.join(projectRoot, "config", "users");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mergeDeep(baseValue, overrideValue) {
  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue ?? baseValue;
  }

  if (
    baseValue &&
    overrideValue &&
    typeof baseValue === "object" &&
    typeof overrideValue === "object"
  ) {
    const merged = { ...baseValue };
    Object.keys(overrideValue).forEach((key) => {
      merged[key] = mergeDeep(baseValue[key], overrideValue[key]);
    });
    return merged;
  }

  return overrideValue ?? baseValue;
}

function listUserProfiles() {
  if (!fs.existsSync(usersDir)) {
    return [];
  }

  return fs
    .readdirSync(usersDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => path.basename(fileName, ".json"));
}

function loadUserProfile(userId = "default") {
  const userPath = path.join(usersDir, `${userId}.json`);

  if (!fs.existsSync(userPath)) {
    throw new Error(`Perfil de usuario nao encontrado: ${userId}`);
  }

  return readJson(userPath);
}

function loadSettings(userId = "default") {
  const baseSettings = readJson(settingsBasePath);
  const userProfile = loadUserProfile(userId);
  const settings = mergeDeep(baseSettings, userProfile);

  return {
    ...settings,
    user: {
      id: userProfile.id,
      displayName: userProfile.displayName,
      unit: userProfile.unit
    }
  };
}

module.exports = {
  loadSettings,
  loadUserProfile,
  listUserProfiles,
  projectRoot
};
