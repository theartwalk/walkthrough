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
| public | yes | Write `no` to hide a work from the public site (it can still appear in a private viewing) |
| rooms | winter-preview | Private viewings this work appears in, separated by commas |

Publish: File, Share, Publish to web, choose the artworks tab and "Comma-separated values (.csv)", Publish, copy the link. Changes to the Sheet show on the site within about five minutes.

## Private viewings

A private viewing is a link that shows a chosen set of works to one collector or group, for example `https://your-site.vercel.app/?room=mehra-7k2p`. The page says who it is for and when it closes, and every WhatsApp enquiry from it names the viewing.

1. In the artworks tab, type the room name in the `rooms` column of each work it should show. Set `public` to `no` for works that must not appear on the public site.
2. Add a second tab called `rooms` (copy `data/sample-rooms.csv`) with one row per viewing:

| Column | Example | Notes |
| --- | --- | --- |
| room | mehra-7k2p | The part after `?room=`. Add a few random letters so it can't be guessed |
| title | Autumn selection | Shown as the page heading |
| for | the Mehra family | Shown as "for the Mehra family" |
| message | A short note | Shown under the heading |
| expires | 2026-12-31 | After this date the link shows "This viewing has closed" |

3. Publish the `rooms` tab as CSV too and paste its link into `roomsCsvUrl`.
4. Send the collector the link on WhatsApp.

Two limits to know. A room link is private because it is hard to guess, not because it has a password; anyone the collector forwards it to can open it. And a Sheet published to the web can be read by anyone who has its CSV link, so do not put anything in the Sheet you would mind being seen. The admin dashboard with its database fixes both (below).

Try the samples: add `?room=winter-preview` (open) or `?room=autumn-collectors` (closed) to the site address.

## Admin dashboard

Open `/admin` on the site (for example `walkthrough-nu.vercel.app/admin`). From there the gallery can:

- add works with a photo, size, price and description, and edit or delete them
- mark works available, reserved or sold, and hide or show them on the site
- create private viewings: pick works, set a closing date, copy the link or send it on WhatsApp
- see which works get looked at and which get enquiries, and when each viewing was opened
- edit the gallery's name, contacts and current exhibition

Until the database is connected, `/admin` runs in demo mode: any email works, and changes are saved in that browser only (the site shows them in that browser too).

### Connect the database (Supabase, free tier)

About 20 minutes, once per gallery or once for all your galleries.

1. Sign up at supabase.com and click New project. Name it `walkthrough`, set a database password (save it), choose the Mumbai region, and create it. Wait a minute or two.
2. In the project, open SQL Editor, click New query, paste everything in `supabase/schema.sql`, and click Run. You should see "Success. No rows returned".
3. Open Authentication, then Users, then Add user, then Create new user. Enter the gallery's email and a password, tick Auto Confirm User, and create it.
4. Back in SQL Editor, paste `supabase/add-gallery.sql`, change the gallery slug, name, city and the email from step 3, and Run.
5. Open Project Settings, then API (or Data API). Copy the Project URL and the `anon` `public` key.
6. In `gallery.config.js` fill in `supabaseUrl`, `supabaseKey` (the anon public key) and `gallery` (the slug from step 4). Commit the change on GitHub; Vercel redeploys.
7. Go to `/admin`, sign in with the email and password from step 3, and add the first works.

The anon public key is meant to be in website code. The database rules in `schema.sql` decide what it can do: visitors can only read public works and open viewings through their links, and only signed-in members of a gallery can change that gallery.

Several galleries can share one Supabase project: run `add-gallery.sql` once per gallery with its own slug and login, and give each gallery's copy of the site its own `gallery` slug.

### What changes once it's connected

- Private works are really private. They are not in any public file, and the site only receives them through an open viewing link.
- Viewings close on their date even if someone kept the link.
- Photos are resized on upload (2000 px and a 700 px thumbnail) and stored in Supabase.
- The Google Sheet settings are ignored.

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
- `art.js` artwork images (real photos, or drawn placeholders for the samples)
- `gallery.config.js` the one file each gallery changes
- `admin/` the admin dashboard
- `supabase/schema.sql` database tables, access rules and functions
- `supabase/add-gallery.sql` adds a gallery and its login
- `data/works.js` sample works for the demo
- `data/sample-sheet.csv` starter Sheet
