function getExportSummary() {
  return {
    allowFlowExport: true,
    allowRunExport: true,
    folders: {
      exports: "./storage/users/<user>/exports",
      outputs: "./storage/users/<user>/outputs",
      logs: "./storage/users/<user>/logs"
    }
  };
}

function getExportTargets() {
  return ["flow-package", "run-artifacts", "logs-only"];
}

module.exports = {
  getExportSummary,
  getExportTargets
};
