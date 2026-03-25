# Especificacao de Pacote de Fluxo

## Objetivo

Definir um formato simples para fluxos que possam ser instalados, compartilhados, exportados e reutilizados em qualquer instancia da SFP.

## Estrutura Minima

```text
nome-do-fluxo/
  manifest.json
  index.js
  README.md
```

## Estrutura Recomendada

```text
nome-do-fluxo/
  manifest.json
  index.js
  README.md
  templates/
  examples/
  assets/
```

## Manifesto

Campos recomendados:

- `id`
- `name`
- `version`
- `description`
- `author`
- `tags`
- `inputs`
- `exports`

## Exemplo

```json
{
  "id": "gerar-despacho",
  "name": "Gerar despacho",
  "version": "0.1.0",
  "description": "Gera e anexa despacho a partir de um processo no SEI",
  "author": "Equipe SFP",
  "tags": ["sei", "documento", "despacho"],
  "inputs": [
    { "id": "processo", "label": "Numero do processo", "type": "text", "required": true },
    { "id": "unidade", "label": "Unidade", "type": "text", "required": true },
    { "id": "responsavel", "label": "Responsavel", "type": "text", "required": true },
    { "id": "resumo", "label": "Resumo", "type": "textarea", "required": false }
  ],
  "exports": {
    "allowFlowExport": true,
    "allowRunExport": true
  }
}
```

## Regras

- O fluxo deve ser autocontido.
- O `manifest.json` deve ser legivel sem executar o fluxo.
- O `index.js` deve expor uma funcao de execucao.
- O fluxo pode salvar artefatos em `storage/outputs/`, `storage/logs/` e `storage/screenshots/`.
- O fluxo pode trazer templates e exemplos para facilitar compartilhamento.

## Compartilhamento

Pacotes podem ser compartilhados por:

- copia direta da pasta
- arquivo compactado
- repositorio institucional

## Boas praticas

- incluir README do proprio fluxo
- declarar claramente os campos exigidos
- manter templates dentro do proprio fluxo ou em storage conhecido
- registrar evidencias uteis para suporte
