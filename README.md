# Announcement Board

Front end for a **congregation announcement board** — the cork board that hangs in a
hallway, rebuilt as a mobile-first web app. Members read notices; leaders publish them
to one or more boards.

The interface is in **European Portuguese**. There is no framework, no bundler and no
runtime dependency: three stylesheets' worth of CSS and five plain scripts.

**[See it running (standalone demo) →](https://aocampo93.github.io/AnnouncementBoard/)**
That link serves the `demo` branch, which persists to `localStorage` so it works with no
server behind it. The `main` branch is the real front end and expects an API.

---

## How it is put together

```
index.html              Shell, SVG icon sprite, permanent toast and overlay containers
assets/
  css/app.css           One stylesheet, mobile-first, three breakpoints
  js/
    config.js           API base URL, timeouts, token storage — the only per-environment file
    data.js             Fixed vocabulary: announcement types and the parts a notice is made of
    api.js              HTTP client. Nothing else in the app knows about fetch
    store.js            In-memory cache over the API, with optimistic writes
    app.js              Routing, screens, actions, overlays
tools/
  mock-api.js           Development server implementing the contract below
  semente.json          Sample content for that server
build-preview.js        Bundles everything into one self-contained HTML file
```

The important decision is in `store.js`: **reads are synchronous, writes are asynchronous.**
Screen functions build their HTML in one pass from an in-memory cache, so they never have
to await anything or juggle loading flags. Writes mutate the cache first, render
immediately, then talk to the server, and roll the cache back if the server refuses.

Routing uses the History API over hash URLs, so every screen is linkable, the back button
behaves, and overlays consume one back gesture instead of navigating away underneath.

## Configuration

The API base URL comes from a meta tag in `index.html`, so it can change per environment
without touching JavaScript:

```html
<meta name="api-base" content="/api">
```

Leave it as `/api` when the API is served from the same host as the front end. Point it at
a full URL when it is not — in that case the API must send the usual CORS headers.

Everything else lives in `assets/js/config.js`: request timeout, image downscaling limits,
and where the session token is kept.

## The API contract

The front end expects these endpoints. Errors always carry the same shape, so the
interface knows what to show:

```json
{ "erro": { "codigo": "validacao", "mensagem": "…", "campos": { "title": "…" } } }
```

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/quadros` | Boards, each with `total` and `porLer` counts |
| `GET` | `/avisos?quadro=&q=&tipo=` | `{ avisos: [...], total }` |
| `GET` | `/avisos/:id` | One announcement |
| `POST` | `/avisos` | Create — returns `201` and the stored object |
| `PATCH` | `/avisos/:id` | Update |
| `DELETE` | `/avisos/:id` | Soft delete — returns `204` |
| `POST` | `/avisos/:id/restaurar` | Undo a delete |
| `POST` | `/avisos/:id/lido` | Mark read for the current user |
| `POST` | `/avisos/lidos` | Mark everything read |
| `POST` | `/ficheiros` | Upload, `multipart/form-data` → `{ url, nome, tamanho }` |
| `GET` | `/sessao` | Current session, used to revalidate the stored token |
| `POST` | `/sessao` | Sign in → session plus `token` |
| `DELETE` | `/sessao` | Sign out |

Authentication is a **bearer token** sent as `Authorization: Bearer <token>`. A `401` on
any request other than sign-in clears the session and sends the user to the sign-in
screen, keeping the destination so they land back where they were going.

**Two things the server owns, not the client.** Each announcement carries `podeEditar` and
`podeEliminar`; the interface only obeys them and never decides permissions itself. Each
announcement also carries `porLer` for the current user. Client-side permission checks
here are cosmetic — the server must enforce its own rules regardless of what the front
end sends.

### Shape of an announcement

```json
{
  "id": "a1b2c3",
  "boards": ["ala", "jovens"],
  "kind": "Atividade",
  "ts": 1755761400000,
  "title": "…",
  "summary": "…",
  "body": ["paragraph", "paragraph"],
  "when":  { "day": "…", "time": "19:00", "place": "…" },
  "hero":  { "url": "/uploads/x.jpg", "legenda": "…", "medidas": "1200×800" },
  "gallery": [ { "url": "…", "legenda": "…" } ],
  "links": [ { "type": "map|pdf|phone|link", "label": "…", "meta": "…", "destino": {} } ],
  "contact": { "name": "…", "phone": "…", "note": "…" },
  "author": "…", "authorRole": "…", "autorId": "…",
  "porLer": true, "podeEditar": true, "podeEliminar": true
}
```

`ts` is an epoch timestamp; the readable date label is derived on the client, in the
reader's own timezone. The server does not need to send one.

## Running it

The development server serves the front end and implements the contract in memory:

```bash
node tools/mock-api.js          # http://127.0.0.1:8765
```

Sign in as `marta.soares` (administers every board), `daniel.ferreira` or `silvia.horta`
(each responsible for one). Any password works — the development server does not check
them, and it is not meant to be exposed to anything.

`POST /api/repor` puts the sample content back.

To produce the single-file build:

```bash
node build-preview.js           # writes preview.html
```

## Responsive layout

The layout changes shape three times, not just in scale:

| Width | Shape |
| --- | --- |
| `< 768px` | Full-bleed page, bottom tab bar, large touch targets |
| `768–1119px` | The screen becomes a sheet pinned to the desk; navigation moves to a top rail |
| `≥ 1120px` | The cork board opens up: left rail with the board index and account, multi-column grid, and the announcement splits into article plus a sticky side column |

## Design

A single visual world — paper, cork and ink — rather than a light and a dark theme.

- **Surfaces** desk `#e6dfd0`, cork `#cba97f`, paper `#faf6ec`, card `#fffdf6`, kraft `#f3e7cd`, sticky note `#f7e6a8`
- **Ink** `#1f1b16`, with a muted ladder down to `#a8967a`
- **Accent** a single stamp red for anything unread, pinned or destructive
- **Type** [Archivo](https://fonts.google.com/specimen/Archivo) for everything structural, [Courier Prime](https://fonts.google.com/specimen/Courier+Prime) for dates, counts and labels

Borders are 2px solid ink with hard offset shadows — no blur, no gradients.

## Notes

Touch targets are at least 44px throughout, and the layout never scrolls sideways down to
320px wide. Overlays trap focus and close on Escape, on a backdrop click, and on the
browser's back gesture. Every icon sits inside a labelled control.

Waiting, failing and saving are all visible states: skeletons on first load, a retry
screen when the API cannot be reached, a spinner on the button while a write is in
flight, and per-field messages when the server rejects a form.

The sample content — people, phone numbers, addresses, announcements — is fictional.
