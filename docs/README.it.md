# World Dashboard

**La Tua Enciclopedia Personale** — Una dashboard di ricerca alimentata dall'IA che indaga qualsiasi argomento utilizzando ricerca web e articoli accademici, mostrando i risultati in una dashboard interattiva.

[English](../README.md) | [日本語](./README.ja.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [Français](./README.fr.md)

## Funzionalita

- **Agente di Ricerca IA** — Claude Code cerca automaticamente nel web e nei database accademici (Semantic Scholar)
- **Dashboard Interattiva** — Panoramica, mappa delle parole chiave, lista fonti con schede
- **Riassunti stile Ochiai** — Riassunto strutturato in 6 punti per ogni articolo (Cos'e / Novita / Metodo / Validazione / Discussione / Prossimo)
- **Articoli Prima** — Scheda articoli accademici predefinita, ordinati per citazioni
- **Multilingue** — UI e contenuti generati in inglese, giapponese, cinese, spagnolo, italiano e francese
- **Cambio Tema** — Temi chiaro, scuro e monocromatico
- **Impostazioni Persistenti** — Preferenze salvate in localStorage
- **Base di Conoscenza in Crescita** — Ogni argomento salvato localmente e consultabile in qualsiasi momento
- **Navigazione Drilldown** — Clicca su qualsiasi parola chiave nella mappa, scoperta chiave nella panoramica o suggerimento "prossimo articolo" per avviare immediatamente una nuova ricerca (tracciamento genitore-figlio tramite `meta.parentSlug`)
- **Importa/Esporta** — Pulsante esporta (↓) nell'intestazione scarica l'argomento corrente come JSON; pulsante importa (↑) nella barra laterale o trascina e rilascia file JSON
- **Schema Flessibile** — Solo `meta.topic` e `meta.slug` sono obbligatori; tutti gli altri campi sono opzionali. Sistema di estensioni per dati tematici (mappa, timeline, tabella, grafico, profilo)
- **Visualizzazione Avanzata** — Rendering Markdown (tabelle, grassetto, intestazioni, elenchi) nella panoramica e nei riassunti degli articoli. Renderer di estensioni per tabella, grafico (barre/linee/torta tramite Recharts) e timeline

## Stack Tecnologico

| Livello | Tecnologia |
|---------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Stili | Tailwind CSS 4 |
| Markdown | react-markdown + remark-gfm |
| Grafici | Recharts |
| Icone | Lucide React |
| Agente IA | Claude Code CLI |
| Articoli | Semantic Scholar API (gratuito) |
| Dati | File JSON locali |

## Prerequisiti

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Abbonamento Claude Code

## Installazione

```bash
git clone git@github.com:onsoku/WorldDashboard.git
cd WorldDashboard
npm install
claude auth login   # solo la prima volta
npm run dev
```

Apri http://localhost:5173 nel browser

## Utilizzo

1. Clicca **"+ Nuovo"** nella barra laterale
2. Inserisci un argomento di ricerca
3. Clicca **"Inizia ricerca"** — il progresso viene mostrato in tempo reale
4. La dashboard mostra i risultati al completamento
5. Passa tra gli argomenti precedenti nella barra laterale
6. **Drilldown** — Clicca su qualsiasi parola chiave o suggerimento per ricercare un argomento correlato
7. **Esporta** — Clicca ↓ nell'intestazione per scaricare JSON; **Importa** — Clicca ↑ nella barra laterale o trascina e rilascia file JSON
8. Cambia tema/lingua con l'icona ⚙️

## Licenza

MIT
