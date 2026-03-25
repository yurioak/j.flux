const fs = require("fs");
const path = require("path");
const { projectRoot } = require("./config");

function loadFlows(settings) {
  const flowsDir = path.resolve(projectRoot, settings.flows.directory);

  if (!fs.existsSync(flowsDir)) {
    return [];
  }

  return fs
    .readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const flowPath = path.join(flowsDir, entry.name);
      const manifestPath = path.join(flowPath, "manifest.json");

      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version || "0.0.0",
        path: flowPath,
        manifestPath,
        shared: Boolean(manifest.exports?.allowFlowExport),
        manifest
      };
    })
    .filter(Boolean);
}

function findFlowById(flowId, settings) {
  return loadFlows(settings).find((flow) => flow.id === flowId) ?? null;
}

module.exports = {
  loadFlows,
  findFlowById
};
