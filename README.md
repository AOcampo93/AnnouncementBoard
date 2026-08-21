# Announcement Board

A responsive front-end demo for a **congregation announcement board** — the kind of
cork board that hangs in a hallway, rebuilt as a mobile-first web app.

**[Open the live demo →](https://aocampo93.github.io/AnnouncementBoard/)**

The interface is written in **European Portuguese**, set in a fictional ward in Leiria.

---

## This is a demo, not a product

Please read this before drawing any conclusions from the code:

- **There is no backend.** Everything runs in the browser.
- **Sign-in is deliberately fake.** Any username and any password will get you in.
  The only rule is that neither field may be empty. Do not reuse this pattern anywhere real.
- **Data lives in `localStorage`**, under a single versioned key. Clearing your browser
  data resets the app, and so does the *"Repor demonstração"* button in the settings panel.
- **All content is invented** — the people, phone numbers, dates, addresses and
  announcements are fictional and do not refer to anyone.

## What it does

Members read announcements without signing in. Leaders sign in to publish them.

- **Novidades** — everything from every board, newest first, with unread stamps and type filters
- **Quadros** — the six boards, shown as folders on a cork surface
- **Um quadro** — one board, with tabs to move between boards and a sort toggle
- **Aviso** — the full announcement: date and place, gallery, attachments, contact
- **Procurar** — live search with quick filters and a result count
- **Entrar** — sign-in for board leaders
- **Criar / Editar aviso** — a two-step wizard: content, then destination
- **A minha conta** — your own announcements, plus the ones you administer

Announcements can be created, edited and deleted for real, and they survive a page reload.
A single announcement can be published to several boards at once.

Two permission levels are simulated: a leader who administers every board, and one
responsible for a single board. You can switch between them in the settings panel
(the sliders button in the corner), along with the unread stamps and the session state.

## Responsive layout

The layout changes shape three times, not just in scale:

| Width | Shape |
| --- | --- |
| `< 768px` | Full-bleed page, bottom tab bar, large touch targets |
| `768–1119px` | The screen becomes a sheet pinned to the desk; navigation moves to a top rail |
| `≥ 1120px` | The cork board opens up: left rail with the board index and account, multi-column grid, and the announcement splits into article plus a sticky side column |

## Structure

```
index.html              App shell, SVG icon sprite, permanent toast and overlay containers
assets/
  css/app.css           Single stylesheet, mobile-first, three breakpoints
  js/
    data.js             Seed content and the shape of every object (the data contract)
    store.js            Persistence, CRUD, read state, session, draft
    app.js              Routing, screens, actions, overlays
build-preview.js        Bundles everything into one self-contained HTML file
```

No framework, no build step, no dependencies. The three scripts are plain classic
scripts loaded in order; `build-preview.js` only exists to produce a single portable file.

Routing uses the History API over hash URLs, so every screen is linkable and the
browser's back button behaves correctly, including inside overlays.

## Design

A single visual world — paper, cork and ink — rather than a light and a dark theme.

- **Surfaces** desk `#e6dfd0`, cork `#cba97f`, paper `#faf6ec`, card `#fffdf6`, kraft `#f3e7cd`, sticky note `#f7e6a8`
- **Ink** `#1f1b16`, with a muted ladder down to `#a8967a`
- **Accent** a single stamp red for anything unread, pinned or destructive
- **Type** [Archivo](https://fonts.google.com/specimen/Archivo) for everything structural, [Courier Prime](https://fonts.google.com/specimen/Courier+Prime) for dates, counts and labels

Borders are 2px solid ink with hard offset shadows — no blur, no gradients.

## Running it locally

Serve the folder over HTTP. Opening `index.html` straight from disk mostly works, but
`localStorage` is unavailable on `file://` origins, so nothing will persist.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To produce the single-file version:

```bash
node build-preview.js          # writes preview.html
```

## Accessibility notes

Touch targets are at least 44px throughout. The layout never scrolls sideways, down to
320px wide. Overlays trap focus and close on Escape, on a backdrop click, and on the
browser's back gesture. Icons are decorative; every one of them sits inside a labelled control.
