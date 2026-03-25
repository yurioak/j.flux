# Gerar despacho

Fluxo compartilhavel para gerar despacho a partir de um processo.

## Entradas

- Numero do processo
- Unidade
- Responsavel
- Resumo
- Tipo de documento opcional, padrao `Despacho`
- Numero de documento modelo opcional para criar a partir de um documento existente no SEI
- Login manual opcional

## Artefatos previstos

- Documento gerado
- Log de execucao
- Evidencias de tela

## Observacao

Este fluxo agora:

- gera um rascunho local do despacho
- acessa o processo no SEI
- tenta incluir um novo documento na arvore do processo
- permite usar `Documento Modelo` quando o numero do documento base for informado
- salva evidencias e diagnosticos quando a automacao nao conseguir concluir alguma etapa
