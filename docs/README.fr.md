# World Dashboard

**Votre Encyclopedie Personnelle** — Un tableau de bord de recherche alimente par l'IA qui explore n'importe quel sujet en utilisant la recherche web et les articles academiques, puis affiche les resultats dans un tableau de bord interactif.

[English](../README.md) | [日本語](./README.ja.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [Italiano](./README.it.md)

## Fonctionnalites

- **Agent de Recherche IA** — Claude Code recherche automatiquement sur le web et dans les bases de donnees academiques (Semantic Scholar)
- **Tableau de Bord Interactif** — Apercu, carte des mots-cles, liste des sources avec onglets
- **Resumes style Ochiai** — Resume structure en 6 points pour chaque article (Quoi / Nouveaute / Methode / Validation / Discussion / Suite)
- **Articles en Premier** — Onglet articles academiques par defaut, tries par citations
- **Multilingue** — Interface et contenu genere en anglais, japonais, chinois, espagnol, italien et francais
- **Changement de Theme** — Themes clair, sombre et monochrome
- **Parametres Persistants** — Preferences sauvegardees dans localStorage
- **Base de Connaissances Croissante** — Chaque sujet sauvegarde localement et consultable a tout moment

## Stack Technique

| Couche | Technologie |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Styles | Tailwind CSS 4 |
| Graphiques | Recharts |
| Icones | Lucide React |
| Agent IA | Claude Code CLI |
| Articles | Semantic Scholar API (gratuit) |
| Donnees | Fichiers JSON locaux |

## Prerequis

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Abonnement Claude Code

## Installation

```bash
git clone git@github.com:onsoku/WorldDashboard.git
cd WorldDashboard
npm install
claude auth login   # premiere fois uniquement
npm run dev
```

Ouvrez http://localhost:5173 dans votre navigateur

## Utilisation

1. Cliquez sur **"+ Nouveau"** dans la barre laterale
2. Entrez un sujet de recherche
3. Cliquez sur **"Demarrer la recherche"** — la progression s'affiche en temps reel
4. Le tableau de bord affiche les resultats une fois termine
5. Basculez entre les sujets precedents dans la barre laterale
6. Changez le theme/langue via l'icone ⚙️

## Licence

MIT
