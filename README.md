# Jiayin's First Month At Work 🌷

A digital version of the hand-drawn colour-by-number card. Every evening at **6pm Singapore time** a new
number unlocks: its spots glow, she colours them in (paint-bucket **Fill** or **Brush**, always inside the
lines), confirms with a "no take-backs" warning, and the **game of the day** is revealed.

**Live site:** https://alsttr.github.io/jiayin-first-month/

Works in any phone or computer browser — nothing to install.

---

## The schedule

Unlocks at 6pm SGT on each date. Thursdays have the shorter games. 🇸🇬 = Singapore variants.

| # | Date | What she colours | Game of the day | Notes |
|---|------|------------------|-----------------|-------|
| 1 | Mon 5 Oct | sun | [Wordle](https://www.nytimes.com/games/wordle/index.html) | already coloured |
| 2 | Tue 6 Oct | snow caps | [Squardle](https://fubargames.se/squardle/) |  |
| 3 | Wed 7 Oct | mountain | [Betweenle](https://betweenle.com/) |  |
| 4 | Thu 8 Oct | right tree trunk | [Angle](https://angle.wtf/) | short (Thu) |
| 5 | Fri 9 Oct | left tree trunk | [Connections](https://www.nytimes.com/games/connections) |  |
| 6 | Sat 10 Oct | left tree leaves | [TimeGuessr](https://timeguessr.com/play?mode=daily) | the weekend one |
| 7 | Mon 12 Oct | right tree leaves | [Word-leh!](https://word-leh.com/) | 🇸🇬 Singlish Wordle |
| 8 | Tue 13 Oct | 1 fruit | [Krillion](https://krillion.io/) |  |
| 9 | Wed 14 Oct | 3 fruits | [Travle](https://travle.earth/) |  |
| 10 | Thu 15 Oct | 3 fruits | [Worldle](https://worldle.teuteuf.fr/) | short (Thu) |
| 11 | Fri 16 Oct | 1 fruit | [Geodle: MRT](https://geodle.vercel.app/sg-mrt-lrt) | 🇸🇬 MRT/LRT stations |
| 12 | Mon 19 Oct | hill | [Squaredle](https://squaredle.app/) |  |
| 13 | Tue 20 Oct | small flowers' leaf + stems | [Metazooa](https://metazooa.com/) |  |
| 14 | Wed 21 Oct | tulip | [Bandle](https://bandle.app/) |  |
| 15 | Thu 22 Oct | big flower's left leaf | [Costcodle](https://costcodle.com/) | short (Thu) |
| 16 | Fri 23 Oct | big flower's right leaf + stem | [FoodGuessr](https://www.foodguessr.com/) |  |
| 17 | Mon 26 Oct | the two small flowers | [Contexto](https://contexto.me/) |  |
| 18 | Tue 27 Oct | grass/ground + tulip's left leaf | [MRT Guessr](https://mrt.ratgames.studio/) | 🇸🇬 (Daily Challenge) |
| 19 | Wed 28 Oct | tulip's right leaf + stem | [Waffle](https://wafflegame.net/daily) |  |
| 20 | Thu 29 Oct | big flower (centre + petals) | [Framed](https://framed.wtf/) | short (Thu) |
| 21 | Fri 30 Oct | sky | [Globle](https://globle-game.com/) | the finale 🎉 |

Every link was checked on 6 Oct 2026: all free, all with a daily puzzle, all playable without signing up
(a few show an optional "log in" button that can be ignored).

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
* **Games** — `days[].game` (`name`, `url`, `blurb`).
* **Which part is which number** — `regions`.
* **Colour palette** — `palette`.

Then publish the change (from this folder):

```bash
git add -A && git commit -m "Update schedule" && git push
```

GitHub Pages updates the live site in about a minute. Her colouring is stored on her device, so edits to
games/dates never erase what she has already coloured. (Only changing `storageKey` would start fresh.)

---

## Testing without touching her picture

Add `?preview=` with any Singapore date/time to the link — it runs in a separate sandbox on your device:

* https://alsttr.github.io/jiayin-first-month/?preview=2026-10-06T18:01 — Day 2 just unlocked
* https://alsttr.github.io/jiayin-first-month/?preview=2026-10-30T19:00 — everything unlocked (try the finale)

A dark "Preview" badge shows at the top with **Reset** (clears the sandbox) and **Exit**.

## Behind-the-scenes panel

Open the site with `?admin` (on **her** device, since that's where her picture lives):
https://alsttr.github.io/jiayin-first-month/?admin

* **Copy backup code** / **Restore from code** — move her picture to a new phone, or keep a backup.
* **Undo last locked day** — if something goes wrong and she needs a redo.
* **Erase everything on this device**.

## Good to know

* Her progress lives in her browser on her device (no accounts, no servers). If she opens it on a
  different phone/browser, that one starts from the beginning — use the backup code to move it.
* **iPhone tip:** a site added to the Home Screen can open as its own little app with its *own* storage.
  If she wants the Home Screen icon, add it **before** she starts colouring (or move her picture over with the backup code).
* If several days are missed, they queue up: she colours them in order and gets each day's game.
* If the page is open at 6pm, the new spot unlocks live with a little celebration.
* At the end she can **Save picture** (PNG of the finished drawing, numbers removed).

## Files

```
index.html            page
css/styles.css        look & feel
js/config.js          ← everything you'd edit
js/app.js             app logic (no dependencies, no build step)
js/art.js             the digitised drawing (generated)
assets/               icons + link-preview image
tools/pipeline/       Python scripts used to trace the photo into vector art (photo not included)
tools/og.html         source for the link-preview image
```
