# SEI Flow Platform (SFP)

Plataforma agnostica para automacao de fluxos operacionais e geracao de documentos no Sistema Eletronico de Informacoes (SEI), no formato de executor local leve com fluxos compartilhaveis.

## Modelo adotado

A SFP passa a ser composta por:

- `runner local leve`: programa principal executado na maquina do usuario
- `fluxos compartilhaveis`: pacotes importaveis, versionaveis e reutilizaveis
- `scripts Playwright`: automacao standalone, sem IA obrigatoria
- `storage local`: pasta para logs, evidencias, exportacoes e arquivos gerados
- `configuracoes`: arquivos editaveis com exemplos de uso

## Beneficios desse formato

- Instalacao leve para computadores pouco potentes
- Sem app desktop pesado
- Fluxos podem ser adicionados sem reinstalar o programa inteiro
- Facil compartilhamento entre usuarios e unidades
- Pastas claras para salvar saidas, templates e evidencias

## Estrutura do projeto

- `docs/vision.md`: visao atualizada do produto e do modo local
- `docs/architecture.md`: arquitetura do runner, catalogo de fluxos e storage
- `docs/mvp-roadmap.md`: MVP, backlog e evolucao do produto
- `docs/flow-package-spec.md`: especificacao de pacotes de fluxo compartilhaveis
- `docs/operational-memory.md`: memoria operacional e decisoes que nao devem ficar apenas em conversa
- `docs/playwright-flow-authoring.md`: padrao para criar novos fluxos com Playwright
- `CONTRIBUTING.md`: regras de contribuicao e continuidade operacional
- `config/settings.example.json`: configuracao base do programa
- `config/settings.base.json`: configuracao institucional compartilhada
- `config/users/*.json`: perfis individuais de usuario
- `config/units.json`: regras por unidade
- `runner/app.js`: catalogo e shell inicial do executor local
- `runner/flow-loader.js`: leitura de manifests e descoberta de fluxos
- `runner/export-manager.js`: regras de exportacao e organizacao de saidas
- `flows/*`: fluxos importaveis e compartilhaveis
- `storage/users/<usuario>/`: logs, screenshots, outputs, exports e templates locais
- `web/index.html`: prototipo visual da plataforma

## Organizacao das pastas do usuario

- `storage/users/<usuario>/logs`: logs de execucao
- `storage/users/<usuario>/screenshots`: evidencias visuais
- `storage/users/<usuario>/outputs`: documentos e arquivos gerados
- `storage/users/<usuario>/exports`: pacotes exportados pelo usuario
- `storage/users/<usuario>/templates`: modelos locais de documentos

## Como funciona

1. O usuario abre o runner local.
2. O runner identifica o usuario ativo.
3. O runner lista os fluxos disponiveis lendo a pasta `flows/`.
4. O usuario escolhe uma acao e informa os dados minimos.
5. O runner executa o script daquele fluxo.
6. O fluxo usa Playwright para operar o SEI, se necessario.
7. O resultado e salvo na pasta individual do usuario.
8. O usuario pode exportar o fluxo, os logs ou os artefatos gerados.

## Compartilhamento de fluxos

Cada fluxo e um pacote autocontido com:

- `manifest.json`
- `index.js`
- `README.md`
- `templates/` quando houver
- `examples/` quando necessario

Isso permite:

- copiar um fluxo para outra maquina
- versionar em repositorio ou pasta compartilhada
- importar novos fluxos sem alterar o nucleo do runner

## Como usar o prototipo atual

Abra `web/index.html` no navegador para visualizar a interface conceitual.

## Como usar a interface web local

Para abrir a interface operacional local:

```powershell
npm run web
```

Depois acesse no navegador:

```text
http://127.0.0.1:4317
```

Na interface web voce consegue:

- selecionar o usuario local configurado
- listar fluxos reais a partir da pasta `flows/`
- iniciar execucoes reais no runner local
- acompanhar status, mensagens e execucoes recentes
- confirmar pela propria interface quando um fluxo pedir login manual ou 2FA

Observacao:

- a interface web usa o mesmo runner local e o mesmo storage do modo CLI
- quando um fluxo exigir autenticacao manual, o navegador do SEI sera aberto na maquina do usuario

## Como testar o runner local

### Listar fluxos

```powershell
npm run list
```

### Teste local sem navegador

```powershell
npm run test:consultar
```

### Teste real com navegador e URL informada

```powershell
node runner/cli.js run consultar-processo --input processo=00000.000000/0000-00 --input seiUrl=https://seu-sei-aqui
```

### Configurar URL do SEI e navegador

Edite:

- `config/settings.base.json` para configuracao compartilhada
- `config/users/default.json` ou outro perfil em `config/users/`

Observacoes importantes:

- o runner agora usa, por padrao, um perfil persistente do navegador por usuario em `storage/users/<usuario>/browser-profile`
- isso ajuda o SEI a reconhecer o mesmo navegador entre execucoes, o que pode reduzir pedidos repetidos de 2FA quando o ambiente do SEI respeita essa confianca
- se voce quiser desativar esse comportamento, ajuste `browser.persistentSession` para `false`

Depois disso, voce pode executar:

```powershell
node runner/cli.js run consultar-processo --input processo=00000.000000/0000-00
```

### Listar usuarios

```powershell
node runner/cli.js users
```

### Executar com usuario explicito

```powershell
node runner/cli.js run consultar-processo --user default --input processo=00000.000000/0000-00
```

### Login manual e 2FA

Quando usar `--input manualLogin=true`, o fluxo:

- abre o navegador e informa no terminal que o login esta em modo manual
- aguarda voce concluir login e possivel 2FA no navegador
- so continua apos voce voltar ao terminal e pressionar `Enter`
- reutiliza o perfil persistente do navegador do usuario para tentar manter a confianca do dispositivo entre execucoes

## Resultado da validacao atual

Foi validado localmente:

- descoberta de fluxos
- execucao por CLI
- gravacao em `storage/users/<usuario>/logs`
- gravacao em `storage/users/<usuario>/outputs`
- captura de screenshot com Playwright em `storage/users/<usuario>/screenshots`

## Proximos passos recomendados

1. Implementar CLI ou interface local do runner
2. Conectar o runner a execucao real via Node.js + `playwright-core`
3. Criar empacotamento de fluxos para importacao/exportacao
4. Implementar o primeiro fluxo real do SEI com evidencias e logs
