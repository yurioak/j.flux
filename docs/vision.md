# Visao do Produto

## Nome

SEI Flow Platform (SFP)

## Resumo

A SFP e uma plataforma de automacao para o SEI desenhada para funcionar de forma leve na maquina do usuario, com um executor local simples, fluxos compartilhaveis e segregacao clara de dados por usuario.

## Objetivo Geral

Automatizar fluxos operacionais recorrentes no SEI com minima intervencao humana e baixo custo operacional para ambientes com computadores modestos.

## Objetivos Especificos

- Reduzir tempo de execucao de tarefas repetitivas
- Padronizar documentos institucionais
- Permitir compartilhamento de fluxos entre areas
- Facilitar importacao e exportacao de fluxos e artefatos
- Preservar configuracoes e historico individual de cada usuario
- Garantir rastreabilidade completa

## Personas

### Servidor Operacional

- Executa tarefas repetitivas
- Usa computador com capacidade limitada
- Precisa de uma ferramenta leve e direta

### Gestor de Unidade

- Quer fluxos reaproveitaveis entre equipes
- Precisa padronizar documentos e operacoes
- Busca visibilidade sobre o que foi executado e exportado

### Administrador do Sistema

- Mantem catalogo de fluxos e configuracoes
- Publica atualizacoes de fluxos compartilhados
- Define convencoes para templates, logs e storage

## Escopo do MVP

### Incluido

- Runner local leve
- Descoberta automatica de fluxos pela pasta `flows/`
- Estrutura de configuracao por arquivo
- Exportacao de resultados e pacotes de fluxo
- Geracao automatica de documentos via templates
- Logs basicos, screenshots e outputs organizados

### Fora do Escopo

- Integracoes externas complexas
- IA avancada para conteudo ou tomada de decisao
- Agendamento distribuido entre multiplas maquinas
- Painel corporativo centralizado completo

## Principios do Produto

- Leveza operacional
- Simplicidade de uso
- Modularidade
- Reutilizacao entre unidades
- Isolamento de dados individuais
- Compartilhamento sem atrito
- Auditoria local clara

## Jornada Padrao

1. Abrir o runner local
2. Escolher um fluxo disponivel
3. Informar os dados minimos
4. Executar o fluxo
5. Salvar ou exportar resultado, logs e evidencias

## Casos iniciais do MVP

- Consultar processo
- Baixar documento
- Gerar despacho
- Anexar documento

## Beneficios Esperados

- Aumento de produtividade
- Reducao de retrabalho
- Padronizacao institucional
- Compartilhamento de automacoes entre areas
- Melhor organizacao de arquivos, evidencias e configuracoes
