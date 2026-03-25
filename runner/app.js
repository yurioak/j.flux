const { loadSettings } = require("./config");
const { loadFlows } = require("./flow-loader");
const { getExportSummary } = require("./export-manager");

function bootstrapRunner(userId = "default") {
  const settings = loadSettings(userId);
  const flows = loadFlows(settings);

  return {
    appName: "SEI Flow Platform",
    mode: "local-light-runner",
    settings,
    user: settings.user,
    flows,
    exportSummary: getExportSummary()
  };
}

module.exports = {
  bootstrapRunner
};
