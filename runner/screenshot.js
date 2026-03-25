const path = require("path");

async function saveScreenshot(page, context, label = "screen") {
  const filePath = path.join(context.storage.screenshotsDir, `${context.runId}.${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

module.exports = {
  saveScreenshot
};
