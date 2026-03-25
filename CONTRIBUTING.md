# Contribuindo

Este repositorio deve ser evoluido com foco em continuidade operacional. O objetivo e evitar dependencia de conhecimento informal, conversas passadas ou uma unica maquina.

Referencia oficial do GitHub sobre guias de contribuicao:

- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-issue-and-pull-request-templates
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/setting-guidelines-for-repository-contributors

## Regras para contribuir

1. Toda decisao operacional relevante deve virar codigo ou documentacao.
2. Toda mudanca em fluxo deve preservar logs, evidencias e mensagens claras para o usuario.
3. Fluxos em desenvolvimento devem ser marcados como tal na biblioteca.
4. Nunca depender apenas de conversa para explicar como um fluxo funciona.

## Antes de abrir um commit

Confirme:

- o fluxo executa ou falha com mensagem clara
- inputs obrigatorios estao corretos
- a interface web comunica o estado ao usuario sem linguagem excessivamente tecnica
- o comportamento novo esta documentado quando necessario

## Documentacao minima esperada

Atualize ou crie documentacao quando houver:

- novo fluxo
- mudanca estrutural no runner
- novo padrao de automacao com Playwright
- novo comportamento de login manual ou 2FA
- novo aprendizado sobre o SEI que impacte outros desenvolvedores

## Arquivos principais para consulta

- `README.md`
- `docs/operational-memory.md`
- `docs/playwright-flow-authoring.md`
- `flows/*/README.md`

## Commits

Prefira commits objetivos e descritivos, por exemplo:

- `Add web run confirmation flow`
- `Implement dispatch generation in SEI`
- `Document Playwright authoring workflow`
