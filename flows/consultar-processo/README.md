# Consultar processo

Fluxo compartilhavel para consulta de processo no SEI.

## Entrada

- Numero do processo
- URL do SEI opcional via input ou `config/settings.json`

## Saidas esperadas

- Log de execucao
- Possiveis screenshots
- Metadados consultados

## Observacao

Este fluxo ja suporta teste inicial de navegador:

- abre o navegador configurado
- acessa a URL do SEI
- pode aguardar login manual
- orienta o usuario no terminal durante login manual e possivel 2FA
- reutiliza o perfil persistente do navegador do usuario, quando habilitado
- tenta localizar pesquisa de processo por heuristica e pelos campos reais da tela de pesquisa do SEI
- registra screenshot

Se a heuristica nao encontrar o campo correto, o fluxo salva um diagnostico da pagina em `storage/users/<usuario>/logs`.
