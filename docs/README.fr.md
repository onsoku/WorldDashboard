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
- **Navigation Drilldown** — Cliquez sur n'importe quel mot-cle dans la carte, decouverte cle dans l'apercu ou suggestion "prochain article" pour lancer instantanement une nouvelle recherche (suivi parent-enfant via `meta.parentSlug`)
- **Import/Export** — Bouton exporter (↓) dans l'en-tete telecharge le sujet courant en JSON ; bouton importer (↑) dans la barre laterale ou glissez-deposez des fichiers JSON
- **Schema Flexible** — Seuls `meta.topic` et `meta.slug` sont obligatoires ; tous les autres champs sont optionnels. Systeme d'extensions pour les donnees thematiques (carte, chronologie, tableau, graphique, profil)
- **Affichage Enrichi** — Rendu Markdown (tableaux, gras, titres, listes) dans l'apercu et les resumes d'articles. Renderers d'extensions pour tableau, graphique (barres/lignes/camembert via Recharts) et chronologie
- **Mises a jour avec Gestion de Versions** — Mettez a jour les sujets existants avec de nouvelles informations tout en preservant l'historique des versions. Les versions precedentes restent intactes et consultables. Les corrections sont suivies lorsque les faits changent
- **Traduction Culturellement Consciente** — Traduisez les sujets dans n'importe laquelle des 6 langues supportees avec evaluation automatique des differences culturelles. Va au-dela de la traduction litterale avec recherche web complementaire lorsque le contexte culturel differe
- **Graphiques et Cartes Etendus** — 7 types de graphiques (barres, lignes, camembert, aire, radar, dispersion, barres empilees) avec support multi-series. Cartes interactives via Leaflet/OpenStreetMap avec marqueurs et popups

## Stack Technique

| Couche | Technologie |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Styles | Tailwind CSS 4 |
| Markdown | react-markdown + remark-gfm |
| Graphiques | Recharts |
| Cartes | Leaflet + react-leaflet |
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
6. **Drilldown** — Cliquez sur un mot-cle ou une suggestion pour rechercher un sujet connexe
7. **Exporter** — Cliquez sur ↓ dans l'en-tete pour telecharger le JSON ; **Importer** — Cliquez sur ↑ dans la barre laterale ou glissez-deposez des fichiers JSON
8. **Mettre a jour** — Cliquez sur le bouton de mise a jour (↻) pour actualiser un sujet avec les dernieres informations
9. **Traduire** — Cliquez sur le bouton de traduction pour convertir un sujet dans une autre langue
10. Changez le theme/langue via l'icone ⚙️

## Licence

MIT
