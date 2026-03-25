# Memoria Operacional do Projeto

Este documento registra aprendizados operacionais que nao devem ficar apenas na conversa.

## Objetivo

Garantir que qualquer estacao, usuario ou colaborador que baixar o projeto do GitHub consiga entender:

- como o projeto esta organizado
- como os fluxos devem ser criados
- como o login manual funciona
- como depurar falhas
- como evoluir a aplicacao sem depender de contexto externo

## Decisoes importantes ja adotadas

### 1. Sessao persistente por usuario

O navegador usado pelos fluxos pode manter um perfil persistente em `storage/users/<usuario>/browser-profile`.

Razao:

- reduzir repeticao de login
- diminuir pedidos recorrentes de 2FA quando o ambiente do SEI respeitar a confianca do dispositivo

### 2. Login manual faz parte do fluxo

Nao tratamos login manual como excecao. Em varios contextos do SEI, isso e necessario.

O fluxo correto e:

1. abrir o navegador
2. permitir login e possivel 2FA
3. confirmar na CLI ou interface web
4. retomar automacao

### 3. A web e uma camada de operacao

A interface web nao deve ser apenas demonstracao visual.

Ela precisa:

- iniciar execucoes reais
- exibir progresso real
- pedir confirmacoes humanas quando necessario
- mostrar historico e resultado

### 4. Evidencia local e obrigatoria

Toda execucao relevante deve deixar rastros locais:

- logs
- screenshots
- outputs
- diagnosticos de pagina quando houver falha

### 5. Fluxos podem estar em estados diferentes de maturidade

A biblioteca deve separar claramente:

- fluxos disponiveis agora
- fluxos em desenvolvimento

Isso evita expectativa errada do usuario final.

## Aprendizados praticos sobre o SEI neste projeto

### Consulta de processo

Foi validado que o fluxo de consulta:

- consegue abrir o SEI
- aceitar login manual
- localizar o processo informado
- abrir o processo corretamente

### Geracao de despacho

O fluxo de despacho teve tres fases neste projeto:

1. rascunho local simples
2. geracao de documento local
3. tentativa de criacao real de documento na arvore do SEI

O estado desejado e o terceiro, mas a etapa de criacao real ainda depende de validacao fina de seletores e comportamento da tela do SEI em uso.

## O que nunca deve ficar so na conversa

Sempre que surgir um aprendizado novo, ele deve virar ao menos um destes itens:

- codigo
- README
- documento em `docs/`
- comentario curto em ponto critico do fluxo

Exemplos:

- seletor mais confiavel do SEI
- comportamento de popup
- exigencia de 2FA
- tipo de documento que funciona melhor
- caminho correto para `Documento Modelo`

## Processo recomendado de aprendizado continuo

1. testar o fluxo
2. registrar o que aconteceu
3. transformar o achado em ajuste de codigo ou documentacao
4. versionar no Git
5. subir ao GitHub

## Regra operacional

Nao depender de memoria de conversa.

Se o projeto precisar ser retomado em outra estacao, por outro usuario ou em outra sessao do Codex, a base minima de entendimento precisa estar no repositorio.
