# Jiayin's First Month At Work 🌷

A digital version of the hand-drawn colour-by-number card. Every evening at **6pm Singapore time** a new
number unlocks: its spots glow, she colours them in (paint-bucket **Fill** or **Brush**, always inside the
lines), confirms with a "no take-backs" warning, and the **game of the day** is revealed. Afterwards she can
tap any coloured part of the picture to see that day's game again (with a screenshot of it).
When all 21 are coloured she gets **Click to reveal your grand prize** — a gift that pops open into
*a getaway at The Residence in Bintan*, linked to their website.

Works in any phone or computer browser — nothing to install.

| Link | For | What it does |
|------|-----|--------------|
| https://alsttr.github.io/jiayin-first-month/ | **her** | The real thing. Every locked-in day is **saved online**, so her picture shows on any phone/browser. |
| https://alsttr.github.io/jiayin-first-month/test/ | **you** | Test everything with a pretend clock: colour, lock in, see the locked screen she sees, **⏩ 6pm** to skip ahead, "Jump to…" any day, **Reset**. Never saved online, never touches her picture. |
| https://alsttr.github.io/jiayin-first-month/view/ | **you** | Watch her picture (read-only, refreshes itself). Can't colour anything. |

Don't colour on her link yourself — anything locked there is saved to *her* picture. Use the test link.

---

## The schedule

Unlocks at 6pm SGT on each date. Thursdays have the shorter games. 🇸🇬 = Singapore variants.

| # | Date | What she colours | Game of the day | Notes |
|---|------|------------------|-----------------|-------|
| 1 | Mon 5 Oct | sun | [Wordle](https://www.nytimes.com/games/wordle/index.html) | already coloured |
| 2 | Tue 6 Oct | snow caps | [Squaredle](https://squaredle.app/) | Boggle-style word search |
| 3 | Wed 7 Oct | mountain | [Betweenle](https://betweenle.com/) |  |
| 4 | Thu 8 Oct | right tree trunk | [Angle](https://angle.wtf/) | short (Thu) |
| 5 | Fri 9 Oct | left tree trunk | [Connections](https://www.nytimes.com/games/connections) |  |
| 6 | Sat 10 Oct | left tree leaves | [TimeGuessr](https://timeguessr.com/) | the weekend one |
| 7 | Mon 12 Oct | right tree leaves | [Word-leh!](https://word-leh.com/) | 🇸🇬 Singlish Wordle |
| 8 | Tue 13 Oct | 1 fruit | [Krillion](https://krillion.io/) |  |
| 9 | Wed 14 Oct | 3 fruits | [Travle](https://travle.earth/) |  |
| 10 | Thu 15 Oct | 3 fruits | [Worldle](https://worldle.teuteuf.fr/) | short (Thu) |
| 11 | Fri 16 Oct | 1 fruit | [Geodle: MRT](https://geodle.vercel.app/) | 🇸🇬 pick "Singapore MRT & LRT Stations" |
| 12 | Mon 19 Oct | hill | [Wordiply](https://www.wordiply.com/) | longest word around a starter word |
| 13 | Tue 20 Oct | small flowers' leaf + stems | [Metazooa](https://metazooa.com/) |  |
| 14 | Wed 21 Oct | tulip | [Bandle](https://bandle.app/) |  |
| 15 | Thu 22 Oct | big flower's left leaf | [Costcodle](https://costcodle.com/) | short (Thu) |
| 16 | Fri 23 Oct | big flower's right leaf + stem | [FoodGuessr](https://www.foodguessr.com/) |  |
| 17 | Mon 26 Oct | the two small flowers | [Contexto](https://contexto.me/) |  |
| 18 | Tue 27 Oct | grass/ground + tulip's left leaf | [MRT Guessr](https://mrt.ratgames.studio/) | 🇸🇬 (Daily Challenge) |
| 19 | Wed 28 Oct | tulip's right leaf + stem | [Waffle](https://wafflegame.net/) |  |
| 20 | Thu 29 Oct | big flower (centre + petals) | [Framed](https://framed.wtf/) | short (Thu) |
| 21 | Fri 30 Oct | sky | [Globle](https://globle-game.com/) | the finale 🎉 |

Every link was checked on 6 Oct 2026: all free, all with a daily puzzle, all playable without signing up
(a few show an optional "log in" button that can be ignored). Every link goes to the game's **home page**,
never straight into the day's puzzle (so nothing starts by surprise — TimeGuessr's daily link used to).

**After Day 21 — the grand prize:** a getaway at [The Residence Bintan](https://www.cenizaro.com/theresidence/bintan).

### How the drawing was mapped
* Numbers were read from the photo. The fruits are tiny, so these are best readings:
  **8** = lowest fruit on the right tree · **9** = lower-right fruit on the left tree + left fruit on the right tree ·
  **10** = two upper fruits on the left tree + right fruit on the right tree · **11** = lower-left fruit on the left tree.
* Unnumbered parts went to the nearest sensible number: the top fruit of the right tree → 9 (nearest fruit),
  flower petals → their flower's number, stems → the nearest leaf, the bits of sky between/behind the trees → 21 (sky),
  the slivers of the back tree peeking through → 7.
* Clouds stay white (they can't be coloured).
* Any of this can be changed in `js/config.js` → `regions`.

---

## Editing things later

Everything editable is in **`js/config.js`** (plain text, commented):

* **Dates / unlock time** — `days[].date`, `unlockHour`.
* **Games** — `days[].game` (`name`, `url`, `blurb`, and `img`: the screenshot shown with it, in `assets/games/`).
  Keep `url` on the game's home page rather than a link that starts the day's game.
  To swap a game's picture, drop any phone screenshot of it in `assets/games/` (portrait, roughly 480×600 JPG is plenty)
  and point `img` at it; delete the `img` line and the card shows little letter tiles instead.
* **The grand prize** — `prize`: the button text, the title (`link` = the part of the title that's linked),
  `url`, the picture (`assets/prize.jpg`, a screenshot of the resort's website), an optional `blurb` and the button label.
* **Which part is which number** — `regions`.
* **Colour palette** — `palette`. (She can also mix any colour with the **+** bubble; her mixes are kept as extra swatches.)
* **The numbers on the picture** are drawn in the handwriting from the real card (`js/hand.js`, traced by
  `tools/pipeline/digits.py`). They follow `regions` automatically — change a number there and the picture shows it.

Then publish the change (from this folder):

```bash
git add -A && git commit -m "Update schedule" && git push
```

GitHub Pages updates the live site in about a minute. (Tip: bump the `?v=5` numbers in `index.html`
when you change CSS/JS so phones fetch the fresh files straight away.) Edits to games/dates never erase what she has already
coloured — that lives in the database (and on her phone).

---

## Online saving (Supabase)

Locked-in days are saved to a free Supabase database (project **jiayin-first-month**, Singapore):
https://supabase.com/dashboard/project/edvmiplelrueckisnumm — table `jfm_days`, one row per day.

* The database itself enforces the rules: anyone can read the picture, each day can be **added once**,
  and nothing can be edited or deleted from the website (no take-backs). Colours must be hex codes.
  Schema: `supabase/migrations/20261006000000_jfm_days.sql`.
* Her phone keeps a local copy too, so the page opens instantly and works offline; anything locked
  offline uploads by itself next time. Pages refresh from the database when opened, every minute,
  and when she switches back to the tab.
* In-progress colouring (before **Done → Lock it in**) stays on the device until locked.
* The key in `js/config.js` is Supabase's *publishable* key — it's meant to be public.
* Free Supabase projects pause after a week with no visits. During the month her daily visits keep it
  awake; if it ever pauses, press **Restore** on the project in the dashboard (her phone's copy still works).
* On this Mac only (git-ignored): `.secrets/supabase.env` (database password) and `.secrets/publishable.key`.
  The Supabase CLI login token is in your macOS keychain; revoke it any time under
  Supabase → Account → Access Tokens.

## Testing without touching her picture

* **https://alsttr.github.io/jiayin-first-month/test/** — runs on a pretend clock (shown in the purple bar).
  It opens as the next spot unlocks, so you can colour straight away. After **Lock it in** you see exactly what
  she sees: the waiting screen with the countdown, and the picture where every coloured part can be tapped to
  show its game. **⏩ 6pm** jumps to a few seconds before the next unlock so you can watch it open live.
  "Jump to…" goes to any day (earlier days get sample colours) — **All done** shows the grand prize button;
  **Reset** starts over (and wraps the prize up again). Nothing is saved online.
* `?preview=` + any Singapore date/time pretends it's that moment (great for checking countdowns), e.g.
  https://alsttr.github.io/jiayin-first-month/?preview=2026-10-06T17:59 — watch Day 2 unlock live.
  Also sandboxed and never saved online.

## Behind-the-scenes panel & undo

https://alsttr.github.io/jiayin-first-month/?admin shows what's saved on that device and online,
plus **Copy backup code** / **Restore from code**.

**Undo a locked day** (if something goes wrong and she needs a redo): Supabase dashboard → Table editor →
`jfm_days` → tick the row whose `n` is that day → Delete. Every phone/browser drops that day the next
time it opens the site, and she can colour it again.

## Good to know

* Her picture is saved online, so it follows her to any phone, browser, chat-app browser or Home Screen icon.
* If several days are missed, they queue up: she colours them in order and gets each day's game.
* If the page is open at 6pm, the new spot unlocks live with a little celebration.
* Any coloured part of the picture can be tapped (once that day is locked in) to bring back its game card:
  screenshot, description and **Let's play**. On the waiting screen, **Today's game** grows into that card, and the
  game shelf (🎮 button) lists every game — each row opens its card. The game itself is only ever linked from a card.
* After all 21: **Click to reveal your grand prize** (first time: a gift shakes and pops open). Afterwards the panel has
  **Grand prize** (to see it again) and **Save picture**.
* At the end she can **Save picture** (PNG of the finished drawing, numbers removed).

## Files

```
index.html            page
css/styles.css        look & feel
js/config.js          ← everything you'd edit
js/app.js             app logic (no dependencies, no build step)
js/art.js             the digitised drawing (generated)
js/hand.js            the numbers, in the card's handwriting (generated)
assets/               icons + link-preview image
assets/games/         a screenshot of each game (shown on its game card)
assets/prize.jpg      the grand prize picture (screenshot of The Residence Bintan's website)
tools/pipeline/       Python scripts used to trace the photo into vector art + digits (photo not included)
test/, view/          short links that open the test and view-only versions
supabase/migrations/  database schema + rules (Supabase)
tools/og.html         source for the link-preview image
.github/workflows/     safety net: re-requests a Pages build if the site is ever down (switches itself off once live)
```
