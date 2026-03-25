# Arquitetura do MVP

## Visao Geral

A arquitetura prioriza execucao local leve. O nucleo do sistema e um runner simples que descobre fluxos importaveis, coleta parametros, executa scripts e organiza artefatos em storage local segregado por usuario.

## Componentes

### 1. Runner Local

Responsavel por:

- Ler configuracoes locais
- Resolver o usuario ativo
- Descobrir fluxos instalados
- Exibir catalogo de acoes
- Coletar inputs minimos
- Acionar exportacao de resultados

### 2. Flow Loader

Responsavel por:

- Ler a pasta `flows/`
- Validar `manifest.json`
- Carregar metadados do fluxo
- Expor fluxos disponiveis ao runner

### 3. Pacote de Fluxo

Responsavel por:

- Declarar nome, descricao e inputs
- Implementar automacao ou logica documental
- Levar seus proprios templates, exemplos e README

Estrutura minima:

- `manifest.json`
- `index.js`
- `README.md`

### 4. Script de Execucao

Responsavel por:

- Rodar a logica do fluxo
- Usar Playwright quando o fluxo precisar operar o SEI
- Registrar logs, screenshots e outputs

Tecnologia candidata:

- `Node.js`
- `playwright-core`
- navegador do proprio usuario, como Edge

### 5. Export Manager

Responsavel por:

- Empacotar outputs gerados
- Exportar logs e evidencias
- Copiar ou compactar fluxos compartilhaveis
- Organizar exportacoes em pasta padronizada

### 6. Storage Local

Responsavel por:

- Guardar logs
- Guardar screenshots
- Guardar documentos gerados
- Guardar fluxos exportados
- Guardar templates locais
- Isolar cada conjunto por usuario

## Pastas Padrao

- `flows/`
- `config/settings.base.json`
- `config/users/`
- `storage/users/<usuario>/logs/`
- `storage/users/<usuario>/screenshots/`
- `storage/users/<usuario>/outputs/`
- `storage/users/<usuario>/exports/`
- `storage/users/<usuario>/templates/`

## Fluxo Macro

`Usuario -> Runner Local -> Perfil do Usuario -> Flow Loader -> Fluxo Selecionado -> Playwright / Doc Logic -> Storage Local por Usuario -> Exportacao`

## Compartilhamento de Fluxos

Fluxos devem ser:

- autocontidos
- copiaveis entre maquinas
- versionaveis
- legiveis por manifesto
- independentes do runner principal

## Requisitos Nao Funcionais

- Baixo consumo de memoria
- Baixa friccao de instalacao
- Facilidade de manutencao
- Logs legiveis por humanos
- Estrutura clara para backup e compartilhamento
- Compatibilidade com maquinas institucionais restritas

## Decisoes Arquiteturais

- Sem dependencia obrigatoria de IA
- Sem dependencia de app desktop pesado
- Fluxos como modulos importaveis
- Exportacao nativa como capacidade do produto
- Storage local explicito e organizado por tipo de artefato
