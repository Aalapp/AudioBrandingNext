# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Next.js 15 application using the App Router, TypeScript, React 19, and Tailwind CSS v4. The project was bootstrapped with `create-next-app` and uses Turbopack for fast development and builds.

## Development Commands

```bash
# Start development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm start
```

Development server runs on http://localhost:3000 by default.

## Architecture

- **Framework**: Next.js 15 with App Router (file-based routing in `src/app/`)
- **Styling**: Tailwind CSS v4 via PostCSS plugin (`@tailwindcss/postcss`)
- **Fonts**: Geist Sans and Geist Mono loaded via `next/font/google` in root layout
- **TypeScript**: Path alias `@/*` maps to `./src/*` for imports
- **Build tool**: Turbopack (enabled with `--turbopack` flag)

### Project Structure

```
src/app/
  ├── layout.tsx       # Root layout with fonts and metadata
  ├── page.tsx         # Home page
  └── globals.css      # Global styles
```

All pages and layouts live under `src/app/` following Next.js App Router conventions. The root layout at `src/app/layout.tsx` configures fonts and global metadata.
