const fs = require("fs");
const path = require("path");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function collectInputCandidates(page) {
  const frames = page.frames();
  const diagnostics = [];

  for (const frame of frames) {
    const frameData = await frame.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll("input, textarea, select, button, a")
      ).slice(0, 250);

      return nodes.map((element) => {
        const text = element.innerText || element.textContent || "";
        return {
          tag: element.tagName,
          type: element.getAttribute("type") || "",
          id: element.id || "",
          name: element.getAttribute("name") || "",
          title: element.getAttribute("title") || "",
          placeholder: element.getAttribute("placeholder") || "",
          value: element.getAttribute("value") || "",
          ariaLabel: element.getAttribute("aria-label") || "",
          text: text.trim().replace(/\s+/g, " ").slice(0, 200)
        };
      });
    });

    diagnostics.push({
      frameUrl: frame.url(),
      elements: frameData
    });
  }

  return diagnostics;
}

function writeDiagnostics(context, diagnostics) {
  const filePath = path.join(
    context.storage.logsDir,
    `${context.runId}.page-diagnostics.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(diagnostics, null, 2));
  return filePath;
}

function isLikelyProcessSearchCandidate(element) {
  const haystack = normalizeText(
    [
      element.id,
      element.name,
      element.title,
      element.placeholder,
      element.value,
      element.ariaLabel,
      element.text
    ].join(" ")
  );

  return (
    (haystack.includes("processo") ||
      haystack.includes("protocolo") ||
      haystack.includes("pesquisa") ||
      haystack.includes("pesquisar") ||
      haystack.includes("buscar")) &&
    !haystack.includes("senha") &&
    !haystack.includes("login")
  );
}

module.exports = {
  collectInputCandidates,
  writeDiagnostics,
  isLikelyProcessSearchCandidate
};
