# Guia de Criacao de Fluxos com Playwright

Este documento registra o padrao adotado no projeto para criar, manter e depurar fluxos automatizados no SEI sem depender de conhecimento tacito de uma unica estacao.

## Objetivo

Reduzir o tempo de criacao de novos fluxos e melhorar a manutencao por meio de:

- gravacao assistida de navegacao
- escolha de seletores mais resilientes
- reaproveitamento de sessoes autenticadas
- captura de evidencias e diagnosticos
- padronizacao da estrutura dos fluxos

## Principios adotados

As praticas abaixo seguem a linha recomendada pela documentacao oficial do Playwright:

- priorizar comportamento visivel ao usuario
- preferir locators por papel, texto, label e titulo
- evitar seletores frageis baseados em CSS interno e estrutura acidental
- isolar os passos mais repetidos em funcoes reutilizaveis
- registrar evidencias para diagnostico quando o fluxo nao concluir

Referencias oficiais:

- Playwright Best Practices: https://playwright.dev/docs/best-practices
- Playwright Locators: https://playwright.dev/docs/locators
- Playwright Codegen: https://playwright.dev/docs/codegen

## Fluxo recomendado para criar um novo fluxo

1. Identificar o resultado final esperado no SEI.
2. Executar manualmente o caminho uma vez e anotar:
   - onde o usuario entra
   - quais campos precisam ser preenchidos
   - em que momento o SEI abre popup ou nova janela
   - em que tela a automacao costuma falhar
3. Gravar a navegacao com `codegen`.
4. Extrair do codigo gerado apenas o essencial.
5. Reescrever os passos em funcoes pequenas e reutilizaveis.
6. Adicionar mensagens de progresso para a interface web e CLI.
7. Salvar screenshot e diagnostico quando nao for possivel concluir.

## Gravacao assistida com codegen

Use o Playwright para gravar a navegacao inicial:

```powershell
npx playwright codegen https://sei.trf1.jus.br/sip/login.php?sigla_orgao_sistema=TRF1&sigla_sistema=SEI
```

O `codegen` deve ser usado para:

- descobrir a sequencia real da navegacao
- testar locators sugeridos pelo Inspector
- confirmar se a tela abre popup, modal ou frame

O codigo gravado nao deve ser usado como implementacao final sem revisao.

## Estrutura recomendada de um fluxo

Cada fluxo deve seguir esta ordem logica:

1. validar inputs obrigatorios
2. abrir navegador com sessao persistente
3. entrar no SEI
4. aguardar login manual quando necessario
5. localizar o processo ou a tela alvo
6. executar a acao principal
7. salvar evidencias
8. devolver status e mensagem final claros

## Padrao de locators

Ordem de preferencia:

1. `getByRole`
2. `getByLabel`
3. `getByText`
4. `getByTitle`
5. `placeholder`, `name`, `id`
6. CSS generico apenas como fallback

Evitar:

- XPath como primeira opcao
- seletores baseados em classes visuais
- dependencias em posicao de elementos quando houver alternativa melhor

## Sessoes autenticadas

Para reduzir login repetitivo e 2FA recorrente, este projeto usa perfil persistente por usuario.

Boas praticas:

- usar um perfil separado da automacao
- nao depender do perfil pessoal padrao do navegador
- manter a sessao por usuario em storage local do projeto
- continuar tratando login manual como etapa valida do fluxo

## Evidencias e diagnostico

Sempre que um fluxo nao encontrar o campo esperado ou nao conseguir concluir uma etapa critica, deve:

- salvar screenshot
- salvar diagnostico da pagina
- retornar mensagem clara indicando o ponto em que parou

Isso evita depender de memoria humana para reproduzir falhas.

## Quando usar Documento Modelo

No SEI, quando o objetivo for criar um novo documento com base em um documento existente, preferir o recurso oficial de `Documento Modelo`.

Esse caminho e melhor do que copiar texto manualmente quando:

- existe um documento institucional ja validado
- o tipo documental precisa manter estrutura padrao
- a unidade trabalha com modelos recorrentes

## Evolucao recomendada

Para acelerar ainda mais a criacao de fluxos, os proximos passos sugeridos sao:

- extrair helpers comuns de SEI para `runner/sei/`
- criar utilitarios para popup, iframe e confirmacao manual
- padronizar testes de smoke por fluxo
- adicionar captura estruturada de traces quando necessario
