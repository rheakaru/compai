---
title: Chapel — a sanctuary for the things that moved you
dek: A sanctuary for the things that moved you — a commonplace book, reimagined as a living constellation.
tags: art, commonplace-book, react, firebase, claude, data-visualization
source: https://rheakaru.github.io/projects/chapel.html
---

## The project

### A commonplace book, reimagined as a living constellation

Chapel is where I keep the things that moved me — books, poems, paintings, songs, films, quotes — and let them talk to each other.

Most reading apps end at the list. You log a book, it sits in a row, and that's it. Chapel begins where the list ends. You light a node for each work that stayed with you, and the app weaves those nodes into a graph of shared themes, shapes, lineages, and time.

The same library can be rendered eight different ways. A force-directed map of your whole collection. A daily "window" built from a single seed word. A jigsaw of works that interlock around a theme. An ancestry tree of who influenced what. A timeline that spans centuries. Or a "living essay" you write with @-mentions of your own collection.

Underneath, Claude does the connective tissue: it reads sparse entries and fleshes them out with author, year, cover art, movement, and themes; it identifies a painting from a photo; and it composes each visualization as structured data the app renders directly — no chatbot, no chat window, just compositions.

Built for a single curator, open for anyone to wander. Anyone can sign in and browse; only an allowlist can write. The whole thing lives on Firebase and costs almost nothing to run.

### Today's window

A new window opens each day. Each one casts your constellation differently — and arrives by email at 9am.

### The views

- **Library** — Your whole collection, filterable by type — book, poem, artwork, song, film, TV, article, quote.
- **Constellation** — A force-directed graph where works connect by shared themes, edges weighted by how deeply they overlap.
- **Daily Window** — A new seed word each day; Claude composes a one-of-one visualization from your library — and emails it at 9am.
- **Visualize** — Type any prompt and Claude builds a custom graph of your nodes around that theme. Save the good ones.
- **Pictorial** — A flowing essay where prose is interleaved with sized thumbnails of the works it references.
- **Jigsaw** — Works laid out as interlocking puzzle pieces, edges matched by shared motif.
- **Lineage** — Pick a work; Claude maps its ancestors and descendants, flagging which already live in your library.
- **Span** — A chronological timeline across centuries, collapsing the empty years.
- **Living Essay** — Write an essay where typing @ summons your own nodes inline and # summons tags. Publish it read-only.

## How I built it

### One curator, a thin server, and Claude as a composition partner

Chapel is a React + Vite single-page app on the front, and a single Express server deployed as one Firebase Cloud Function on the back. Firestore is the source of truth; Cloud Storage holds uploaded covers and artwork photos. There's no database I babysit and no server I keep warm.

- Frontend: React 18 · Vite · React Router
- Graph: react-force-graph-2d
- Editor: TipTap (essay + @mentions)
- Backend: Express on Cloud Functions
- Data: Firestore + Cloud Storage
- Auth: Firebase Auth (Google)
- Intelligence: Claude (Anthropic SDK)
- Metadata: Open Library · Google Books · TMDB · Wikipedia
- Email: Scheduled fn + Nodemailer

```
client/   React + Vite SPA  →  Firebase Hosting
server/   Express  →  one HTTPS Cloud Function
          + a scheduled fn (daily window email, 9am IST)
Firestore  nodes · visualizations · essays · daily archive
Storage    uploaded covers & artwork photos
Claude     vision · flesh-out · compose every visualization
```

The key design idea: Claude never returns prose to paste into a chat bubble. Every model call returns structured JSON — a visualization spec, a lineage tree, a jigsaw layout — and the frontend renders it directly. Adding a new way to see the collection is mostly a new page plus a new endpoint that returns its own spec.

Capture is the unglamorous half that makes the rest work. You can add a work by title, by URL, by dragging in an image, or in bulk from a spreadsheet. Claude + the metadata services then flesh out the sparse entry — author, year, cover, medium, movement, tags — so the graph has something real to connect. Point your camera at a painting and Claude Vision returns title, artist, year, and movement.

Security is boring on purpose. Reads are open; writes are gated by an email allowlist enforced both client-side and in server middleware, on top of Firestore security rules. The Firebase web config is public by design — it ships to every browser — and the real keys live only in server-side environment variables, never in the repo.

## Build your own

### The prompt

Drop this into Claude (or your coding agent of choice) to scaffold your own Chapel. Tweak the work-types and the views to taste.

```
Build me a web app called "Chapel" — a personal commonplace book that turns the art that moved someone into a living, connected constellation.

CORE CONCEPT
Users "light a node" for each work that stayed with them. Each node is one of eight types: artwork, book, poem, article, song, movie, tv, quote — each with its own accent color and a small glyph. The same library of nodes can be rendered many different ways; every view is just a different projection of the same data.

STACK
- Frontend: React + Vite single-page app, React Router. Dark, editorial aesthetic: near-black background (#0d0d0d), warm gold accent (#d4b478), EB Garamond serif for headings/body, DM Mono for labels. Calm, gallery-like, generous whitespace.
- Backend: a single Express app deployed as one serverless function. Expose REST routes: /api/nodes, /api/search, /api/visualizations, /api/essays, plus one per extra view.
- Data: a document database (Firestore or similar) as the source of truth; object storage for uploaded cover images.
- Auth: Google sign-in. Reads are public; writes are restricted to an email allowlist enforced on both client and server.
- Intelligence: the Claude API (Anthropic SDK). IMPORTANT — every model call must return STRUCTURED JSON that the frontend renders directly. No chat UI anywhere.

CAPTURE
- Add a node by title, by URL, by drag-and-drop image, or in bulk from a CSV/XLSX.
- "Flesh out": given a sparse node, call Claude + public metadata sources (Open Library, Google Books, TMDB, Wikipedia) to fill in author/creator, year, cover image, medium, movement, themes, and tags.
- "Identify artwork": send a photo to Claude Vision and return {title, artist, year, medium, movement, period} as JSON.

THE VIEWS (each is its own page + endpoint)
1. Library — filterable grid of node cards by type.
2. Constellation — force-directed graph; nodes connected by shared keywords/themes, edge weight scaled to overlap depth.
3. Daily Window — hash today's date to pick a seed word from a curated pool (colors, feelings, elements, abstractions). Claude composes a one-of-one visualization from the user's library around that word. Archive past days. Email a summary each morning via a scheduled function.
4. Visualize — free-text prompt ("solitude in postwar Europe", "the color blue") → Claude returns a custom graph spec of the user's nodes around that theme. Allow saving.
5. Pictorial — flowing prose interleaved with sized thumbnails of referenced works.
6. Jigsaw — Claude lays works out as interlocking puzzle pieces around a theme; edges matched by shared motif.
7. Lineage — pick a node; Claude returns its ancestors (influences) and descendants (influenced), flagging which already exist in the library.
8. Span — a chronological timeline across centuries, collapsing empty year-ranges.
9. Living Essay — a rich-text editor (TipTap) where typing @ summons your nodes inline and # summons tags. Publish a read-only public view at /read/:id.

DETAILS
- Give visualizations an /embed/* route that renders bare (no nav) so they can be iframed onto a personal site.
- Keep all real secrets in server-side env vars; never commit them. The frontend auth config is public by design.
- Ship a clean README and a sensible .gitignore.

Start by scaffolding the data model, the node CRUD endpoints, and the Library + Constellation views, then add the other views one at a time.
```

This is the shape of Chapel, not a copy of my code. The actual source — every view, the Claude prompts, the metadata plumbing — is open on GitHub if you'd rather read the real thing.

## Thinking out loud · notes

### Notes from the build

Posted as I went, from @MillionPageProj.

## Go light a node.

Chapel is live, and the whole thing is open source.

Chapel — a sanctuary for the things that moved you. Built with React, Firebase & Claude.
