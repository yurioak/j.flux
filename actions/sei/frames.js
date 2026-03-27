async function fillFirstAvailable(pageOrFrame, selectors, value) {
  for (const selector of selectors) {
    const locator = pageOrFrame.locator(selector).first();
    const count = await pageOrFrame.locator(selector).count().catch(() => 0);
    if (!count) continue;

    try {
      await locator.click({ timeout: 1000 });
      await locator.fill(value, { timeout: 1000 });
      return { ok: true, selector };
    } catch (_error) {
      continue;
    }
  }
  return { ok: false };
}

async function clickFirstAvailable(pageOrFrame, selectors) {
  for (const selector of selectors) {
    const locator = pageOrFrame.locator(selector).first();
    const count = await pageOrFrame.locator(selector).count().catch(() => 0);
    if (!count) continue;

    try {
      await locator.click({ timeout: 1500 });
      return { ok: true, selector };
    } catch (_error) {
      continue;
    }
  }
  return { ok: false };
}

async function clickFirstAvailableInFrames(page, selectors) {
  const frames = page.frames();
  for (const frame of frames) {
    const result = await clickFirstAvailable(frame, selectors);
    if (result.ok) {
      return { ...result, frame, frameUrl: frame.url() };
    }
  }
  return { ok: false };
}

async function fillFirstAvailableInFrames(page, selectors, value) {
  const frames = page.frames();
  for (const frame of frames) {
    const result = await fillFirstAvailable(frame, selectors, value);
    if (result.ok) {
      return { ...result, frame, frameUrl: frame.url() };
    }
  }
  return { ok: false };
}

async function selectOptionByLabel(pageOrFrame, fieldSelectors, optionLabel) {
  for (const selector of fieldSelectors) {
    const count = await pageOrFrame.locator(selector).count().catch(() => 0);
    if (!count) continue;

    try {
      await pageOrFrame.locator(selector).first().selectOption({ label: optionLabel });
      return { ok: true, selector };
    } catch (_error) {
      continue;
    }
  }
  return { ok: false };
}

async function selectOptionByLabelInFrames(page, fieldSelectors, optionLabel) {
  const frames = page.frames();
  for (const frame of frames) {
    const result = await selectOptionByLabel(frame, fieldSelectors, optionLabel);
    if (result.ok) {
      return { ...result, frame, frameUrl: frame.url() };
    }
  }
  return { ok: false };
}

module.exports = {
  fillFirstAvailable,
  clickFirstAvailable,
  clickFirstAvailableInFrames,
  fillFirstAvailableInFrames,
  selectOptionByLabel,
  selectOptionByLabelInFrames
};
