# Walkthrough by The Art Walk

A gallery website kit for showing and selling art on phones. Collectors see every work to scale on a virtual wall, open it full screen, swipe between works, zoom into the surface, see it above a sofa at true size, and ask about it on WhatsApp.

No build step, no server, no database. Plain HTML, CSS and JavaScript, hosted on Vercel, with artworks managed in a Google Sheet.

## Set up a new gallery

1. Copy this repository (Use this template, or fork it).
2. Edit `gallery.config.js`: name, city, address, WhatsApp number, email, Instagram, exhibition title, dates and intro.
3. Make the artworks Sheet (below), publish it as CSV, paste the link into `sheetCsvUrl`.
4. Import the repo into Vercel. No settings needed; it deploys as a static site.
5. Add the gallery's domain in Vercel, under Project, Settings, Domains.

Without a Sheet link the site shows the ten sample works in `data/works.js`. The sample artists and works are fictional and their images are drawn in the browser.

## The artworks Sheet

One row per artwork. Copy `data/sample-sheet.csv` into Google Sheets to start. Column names must match:

| Column | Example | Notes |
| --- | --- | --- |
| id | w1 | Short and unique; used in share links |
| title | Monsoon Ledger | |
| artist | Ira Malhotra | |
| year | 2025 | |
| medium | Oil on canvas | |
| width_cm | 120 | Needed for the to-scale wall |
| height_cm | 150 | Needed for the to-scale wall |
| price_inr | 480000 | Leave empty for "Price on request" |
| status | available | available, reserved or sold |
| image_url | https://... | A direct link to a JPG or PNG, about 2000 px on the long side |
| description | A few sentences | Shown in the details panel |

Publish: File, Share, Publish to web, choose the artworks tab and "Comma-separated values (.csv)", Publish, copy the link. Changes to the Sheet show on the site within about five minutes.

## How it feels

The motion follows Apple's fluid interface ideas:

- Works grow out of their thumbnail and shrink back into it.
- Dragging tracks the finger 1:1; flicks are judged by speed, not distance.
- Every animation is a spring and can be grabbed and reversed mid-way.
- Edges rubber-band instead of stopping dead.
- Reduced motion and reduced transparency settings are respected.

## Files

- `index.html` page structure
- `styles.css` design tokens, layout, glass surfaces
- `app.js` data loading, the wall, grid, viewer, gestures, springs, wall preview
- `gallery.config.js` the one file each gallery changes
- `data/works.js` sample works for the demo
- `data/sample-sheet.csv` starter Sheet
