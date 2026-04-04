# World Dashboard

**Tu Enciclopedia Personal** — Un panel de investigacion impulsado por IA que investiga cualquier tema utilizando busqueda web y articulos academicos, y muestra los resultados en un panel interactivo.

[English](../README.md) | [日本語](./README.ja.md) | [中文](./README.zh.md) | [Italiano](./README.it.md) | [Français](./README.fr.md)

## Caracteristicas

- **Agente de Investigacion IA** — Claude Code busca automaticamente en la web y bases de datos academicas (Semantic Scholar)
- **Panel Interactivo** — Resumen, mapa de palabras clave, lista de fuentes con pestanas
- **Resumenes estilo Ochiai** — Resumen estructurado de 6 puntos para cada articulo (Que / Novedad / Metodo / Validacion / Discusion / Siguiente)
- **Articulos Primero** — Pestana de articulos academicos por defecto, ordenados por citas
- **Multilingue** — UI y contenido generado en ingles, japones, chino, espanol, italiano y frances
- **Cambio de Tema** — Temas claro, oscuro y monocromo
- **Configuracion Persistente** — Preferencias guardadas en localStorage
- **Base de Conocimiento Creciente** — Cada tema se guarda localmente y se puede consultar en cualquier momento

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 4 |
| Graficos | Recharts |
| Iconos | Lucide React |
| Agente IA | Claude Code CLI |
| Articulos | Semantic Scholar API (gratuito) |
| Datos | Archivos JSON locales |

## Requisitos Previos

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Suscripcion a Claude Code

## Instalacion

```bash
git clone git@github.com:onsoku/WorldDashboard.git
cd WorldDashboard
npm install
claude auth login   # solo la primera vez
npm run dev
```

Abre http://localhost:5173 en tu navegador

## Uso

1. Haz clic en **"+ Nuevo"** en la barra lateral
2. Ingresa un tema de investigacion
3. Haz clic en **"Iniciar investigacion"** — el progreso se muestra en tiempo real
4. El panel muestra los resultados al completar
5. Cambia entre temas anteriores en la barra lateral
6. Cambia tema/idioma con el icono ⚙️

## Licencia

MIT
