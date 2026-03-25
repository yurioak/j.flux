const { bootstrapRunner } = require("./app");
const { listUserProfiles } = require("./config");
const { runFlowById } = require("./flow-runner");

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || "list";
  const rest = args.slice(1);
  const options = {
    inputs: {},
    dryRun: false,
    json: false,
    userId: "default"
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--json") {
      options.json = true;
      continue;
    }

    if (token === "--user") {
      options.userId = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--input") {
      const pair = rest[index + 1];
      index += 1;

      if (!pair || !pair.includes("=")) {
        throw new Error("Use --input campo=valor.");
      }

      const separatorIndex = pair.indexOf("=");
      const key = pair.slice(0, separatorIndex);
      const value = decodeURIComponent(pair.slice(separatorIndex + 1));
      options.inputs[key] = value;
      continue;
    }

    if (!options.target) {
      options.target = token;
      continue;
    }
  }

  return { command, options };
}

function printList(state) {
  console.log(`${state.appName} - fluxos disponiveis`);
  console.log(`usuario: ${state.user.displayName} (${state.user.id})`);
  console.log(`unidade: ${state.user.unit}`);
  console.log("");

  state.flows.forEach((flow) => {
    console.log(`- ${flow.id}: ${flow.name} (${flow.version})`);
    console.log(`  pasta: ${flow.path}`);
    console.log(`  compartilhavel: ${flow.shared ? "sim" : "nao"}`);
  });
}

async function main() {
  const { command, options } = parseArgs(process.argv);
  const state = bootstrapRunner(options.userId);

  if (command === "list") {
    printList(state);
    return;
  }

  if (command === "users") {
    listUserProfiles().forEach((profileId) => console.log(`- ${profileId}`));
    return;
  }

  if (command === "run") {
    if (!options.target) {
      throw new Error("Informe o id do fluxo. Ex.: node runner/cli.js run consultar-processo");
    }

    const result = await runFlowById(options.target, {
      input: options.inputs,
      dryRun: options.dryRun,
      userId: options.userId
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Fluxo: ${result.flow.id}`);
    console.log(`Usuario: ${result.user.displayName} (${result.user.id})`);
    console.log(`Unidade: ${result.user.unit}`);
    console.log(`Execucao: ${result.runId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Mensagem: ${result.message}`);
    console.log(`Log: ${result.logFile}`);
    if (result.outputFile) {
      console.log(`Saida: ${result.outputFile}`);
    }
    return;
  }

  throw new Error(`Comando nao suportado: ${command}`);
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
});
