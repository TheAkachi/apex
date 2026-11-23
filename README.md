# Apex

Aplicativo **PWA (Progressive Web App)** escuro e minimalista para foco, imersão em fluxo, planejamento diário e acompanhamento de constância.

Instalável como aplicativo independente no Windows e no celular, 100% **offline-first** e sem necessidade de login.

## Funcionalidades

- **Foco (Timer Pomodoro):**
  - Cronômetro central editável diretamente em **`Min : Seg`** (Atividade e Descanso independentes — alternar entre abas não interrompe o timer ativo).
  - **Modo Blitz (`⚡ 10 min`)** para quebrar a inércia inicial.
  - **Timer Flutuante (Picture-in-Picture):** janela sempre no topo via `Document Picture-in-Picture API` (com fallback automático via `Canvas + Video PiP`).
  - **Ampulheta animada minimalista** em SVG + CSS puro (ciclo contínuo de 30s).
  - **Anotação da sessão** e **Pendências de hoje** integradas ao lado do cronômetro, com salvamento automático a cada minuto.
- **Maratona (Cronômetro crescente):**
  - Dois cronômetros crescentes (tempo em fluxo + tempo de descanso livre quando quiser).
  - Confirmação antes de encerrar, proteção de progresso automático e integração com o Timer Flutuante.
- **Calendário & Pendências:**
  - Visão **Mês** com Top 3 prioridades do dia e blocos com horário de **Início** e **Previsão de término** (incluindo suporte a tarefas que viram a meia-noite).
  - Visão **Pendências** com cards de resumo (*Em aberto* / *Resolvidas*), relatório escrito filtrável e **grade semanal de 24 horas** mostrando horários ocupados e livres.
  - Categorias opcionais (`Estudo`, `Trabalho`, `Família`, `Amigos` ou personalizadas salvas localmente), seletor de horário customizado e conclusão automática após o término previsto.
- **Constância (Relatórios):**
  - **Mapa de constância anual (Jan–Dez)** e gráficos em **SVG puro** (*Tempo de atividade por dia* + *Tempo por categoria*).
  - Edição completa de sessões e anotações + registro manual.
- **Áudio & Dados Locais:**
  - **Ruído marrom opcional** sintetizado via `Web Audio API` (acessível no topo e nas configurações).
  - Persistência 100% local com `IndexedDB` atrás de uma interface de repositório desacoplada, exportar/importar backup em JSON e modo demonstração reversível.

## Stack

- **Vite + React + TypeScript**
- **PWA** (`vite-plugin-pwa` com Service Worker e cache offline)
- **APIs nativas do navegador:** `IndexedDB`, `Document Picture-in-Picture`, `Web Audio API`, `Notifications API`
- **Zero bibliotecas pesadas de gráficos** (SVG e CSS puros)

## Como executar localmente

```bash
npm install
npm run dev
```

Para gerar e testar a versão de produção (PWA completo):

```bash
npm run build
npm run preview
```
