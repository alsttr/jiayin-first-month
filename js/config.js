/* ==========================================================================
   Jiayin's First Month At Work — EDITABLE SETTINGS
   --------------------------------------------------------------------------
   Everything you might want to change lives in this file:
     • the schedule (which date unlocks which number)
     • the game of the day for every number
     • which part of the picture belongs to which number
     • the colour palette
   After editing, commit + push (see README.md) and the site updates in ~1 min.
   ========================================================================== */
window.CONFIG = {
  title: "Jiayin's First Month At Work",
  name: 'Jiayin',

  // New spots unlock at this time, Singapore time (UTC+8), on each scheduled date.
  unlockHour: 18,
  unlockMinute: 0,

  // Saved on her device under this key. Changing it starts everything from scratch.
  storageKey: 'jiayin-first-month-v1',

  /* ONLINE SAVING — every locked-in day is saved here, so her picture shows on any phone or browser.
     Supabase project "jiayin-first-month" (Singapore). The publishable key is meant to be public:
     the database itself only allows reading, and adding each day ONCE (no edits, no deletes).
     Set url to '' to switch online saving off (then it's saved on her device only). */
  sync: {
    url: 'https://edvmiplelrueckisnumm.supabase.co',
    key: 'sb_publishable_DLUL_VqHLWgCOmo2ANGwJQ_r6yJXhMz',
    table: 'jfm_days',
  },

  /* ------------------------------------------------------------------------
     THE SCHEDULE — one entry per number in the drawing.
     date  : the day it unlocks (YYYY-MM-DD, unlocks at 6pm SGT that day)
     game  : name, link and a one-line description shown after she locks it in.
             img = a screenshot of the game (in assets/games/) shown with it — optional.
                   Several pictures (img: ['a.jpg', 'b.jpg']) take turns; phone: true shows them in a phone.
             say = how the card says it, if not just the name ("We're playing a PUBG match today!").
             Links go to each game's home page (not straight into the day's puzzle).
     games : instead of game, for a day with more than one — games: [ {...}, {...} ].
     Thursdays use the shorter games (Thu 8 and 22 Oct have a second one too).
     ------------------------------------------------------------------------ */
  days: [
    { n: 1,  date: '2026-10-05', game: { name: 'Wordle',      url: 'https://www.nytimes.com/games/wordle/index.html',   img: 'assets/games/wordle.jpg',      blurb: 'The classic. Guess the five-letter word in six tries.' } },
    { n: 2,  date: '2026-10-06', game: { name: 'Squaredle',   url: 'https://squaredle.app/',                            img: 'assets/games/squaredle.jpg',   blurb: 'Boggle-style word hunt: swipe through the letter grid to find every hidden word.' } },
    { n: 3,  date: '2026-10-07', game: { name: 'Betweenle',   url: 'https://betweenle.com/',                            img: 'assets/games/betweenle.jpg',   blurb: 'The secret word hides alphabetically between two others. Squeeze it out.' } },
    { n: 4,  date: '2026-10-08', games: [
        { name: 'Angle',       url: 'https://angle.wtf/',                                img: 'assets/games/angle.jpg',       blurb: 'Guess the angle in four tries. Thirty seconds, tops.' },
        { name: 'Connections', url: 'https://www.nytimes.com/games/connections',         img: 'assets/games/connections.jpg', blurb: 'Sort sixteen words into four secret groups.' } ] },
    { n: 5,  date: '2026-10-09', game: { name: 'PUBG match', say: 'a PUBG match', url: 'https://www.pubgmobile.com/en-US/home.shtml', phone: true,
        img: ['assets/games/pubg-1.jpg', 'assets/games/pubg-2.jpg', 'assets/games/pubg-3.jpg', 'assets/games/pubg-4.jpg'],
        blurb: 'Squad up, drop in together and go for that chicken dinner. 🍗' } },
    { n: 6,  date: '2026-10-10', game: { name: 'TimeGuessr',  url: 'https://timeguessr.com/',                           img: 'assets/games/timeguessr.jpg',  blurb: 'Five photos from history — guess where and when each was taken.' } },
    { n: 7,  date: '2026-10-12', game: { name: 'Word-leh!',   url: 'https://word-leh.com/',                             img: 'assets/games/word-leh.jpg',    blurb: 'Wordle, but make it Singlish. Steady lah.' } },
    { n: 8,  date: '2026-10-13', game: { name: 'Size It Up',  url: 'https://magnitudle.com/',                           img: 'assets/games/size-it-up.jpg',  blurb: 'Stretch each mystery silhouette to its real size next to something you know. Five rounds.' } },
    { n: 9,  date: '2026-10-14', game: { name: 'Travle',      url: 'https://travle.earth/',                             img: 'assets/games/travle.jpg',      blurb: 'Hop from one country to another using only their neighbours.' } },
    { n: 10, date: '2026-10-15', game: { name: 'Worldle',     url: 'https://worldle.teuteuf.fr/',                       img: 'assets/games/worldle.jpg',     blurb: 'Name the country from its silhouette.' } },
    { n: 11, date: '2026-10-16', game: { name: 'Geodle: MRT', url: 'https://geodle.vercel.app/',                        img: 'assets/games/geodle-mrt.jpg',  blurb: 'Pick “Singapore MRT & LRT Stations”, then find the mystery station in six guesses.' } },
    { n: 12, date: '2026-10-19', game: { name: 'Wordiply',    url: 'https://www.wordiply.com/',                         img: 'assets/games/wordiply.jpg',    blurb: 'Five goes to build the longest word you can around the day’s starter word.' } },
    { n: 13, date: '2026-10-20', game: { name: 'Metazooa',    url: 'https://metazooa.com/',                             img: 'assets/games/metazooa.jpg',    blurb: 'Guess the mystery animal — each guess shows how closely related you are.' } },
    { n: 14, date: '2026-10-21', games: [
        { name: 'Bandle',      url: 'https://bandle.app/',                               img: 'assets/games/bandle.jpg',      blurb: 'Name the song as the band adds one instrument at a time.' },
        { name: 'Quordle',     url: 'https://www.merriam-webster.com/games/quordle/',    img: 'assets/games/quordle.jpg',     blurb: 'Four Wordles at once, nine guesses to crack them all.' } ] },
    { n: 15, date: '2026-10-22', games: [
        { name: 'Costcodle',   url: 'https://costcodle.com/',                            img: 'assets/games/costcodle.jpg',   blurb: 'Guess the price of a Costco find, higher-or-lower style.' },
        { name: 'Murdle',      url: 'https://murdle.com/',                               img: 'assets/games/murdle.jpg',      blurb: 'A daily whodunit: use the clues to work out who did it, with what, and where.' } ] },
    { n: 16, date: '2026-10-23', game: { name: 'FoodGuessr',  url: 'https://www.foodguessr.com/',                       img: 'assets/games/foodguessr.jpg',  blurb: 'Guess where in the world each dish comes from.' } },
    { n: 17, date: '2026-10-26', game: { name: 'Contexto',    url: 'https://contexto.me/',                              img: 'assets/games/contexto.jpg',    blurb: 'Find the secret word — every guess tells you how close in meaning you are.' } },
    { n: 18, date: '2026-10-27', game: { name: 'MRT Guessr',  url: 'https://mrt.ratgames.studio/',                      img: 'assets/games/mrt-guessr.jpg',  blurb: 'Pin stations on a blank MRT map. Go for the Daily Challenge!' } },
    { n: 19, date: '2026-10-28', game: { name: 'Waffle',      url: 'https://wafflegame.net/',                           img: 'assets/games/waffle.jpg',      blurb: 'Swap letters to fix six words woven into a waffle.' } },
    { n: 20, date: '2026-10-29', game: { name: 'Framed',      url: 'https://framed.wtf/',                               img: 'assets/games/framed.jpg',      blurb: 'Name the movie from a single frame — more frames each miss.' } },
    { n: 21, date: '2026-10-30', game: { name: 'Globle',      url: 'https://globle-game.com/',                          img: 'assets/games/globle.jpg',      blurb: 'Find the mystery country — the map gets warmer the closer you get.' } },
  ],

  /* ------------------------------------------------------------------------
     WHICH PART OF THE PICTURE IS WHICH NUMBER
     (names come from js/art.js; null = stays white, like the clouds)
     Parts without a number in the drawing were given the nearest sensible number.
     ------------------------------------------------------------------------ */
  regions: {
    sun: 1,
    snow_left: 2, snow_right: 2,
    mountain: 3,
    trunk_right: 4,
    trunk_left: 5,
    canopy_left: 6,
    canopy_right: 7, canopy_right_nook: 7, canopy_right_strip: 7,   // the bits of the back tree peeking through
    fruit_R4: 8,                                    // right tree, lowest fruit
    fruit_L4: 9, fruit_R2: 9, fruit_R1: 9,          // R1 = the top berry of the right tree
    fruit_L1: 10, fruit_L2: 10, fruit_R3: 10,
    fruit_L3: 11,
    hill: 12,
    flower_leaf: 13, flower_big_stem: 13, flower_small_stem: 13,   // stems → nearest leaf
    tulip_head: 14,
    daisy_leaf_left: 15,
    daisy_leaf_right: 16, daisy_stem: 16,
    flower_big_centre: 17, flower_big_petals: 17, flower_small_petals: 17, flower_small_centre: 17,
    ground: 18, ground_between_flowers: 18, tulip_leaf_left: 18,
    tulip_leaf_right: 19, tulip_stem: 19,
    daisy_centre: 20, daisy_petals: 20,
    sky: 21, sky_between_trees: 21,
    cloud_front: null, cloud_back: null,            // clouds stay white
  },

  /* ------------------------------------------------------------------------
     THE GRAND PRIZE — once all 21 spots are coloured in, she gets a button to reveal it.
     ------------------------------------------------------------------------ */
  prize: {
    button: 'Click to reveal your grand prize',
    title: 'A getaway at The Residence in Bintan!',
    link: 'The Residence in Bintan',                     // this part of the title links to url
    url: 'https://www.cenizaro.com/theresidence/bintan',
    img: 'assets/prize.jpg',                             // a screenshot of their website (optional)
    blurb: '',                                           // optional line under the title
    go: 'Take a look',                                   // the button under it
  },

  // Spots that were already coloured in on the real card (Day 1 = the yellow sun).
  prefilled: {
    1: { sun: '#F4C21B' },
  },

  // Colour palette offered to her (she can also mix any colour with the "+" bubble).
  palette: [
    '#FFE45C', '#F4C21B', '#FFB347', '#FF8A5B', '#F25C54', '#FF8FAB', '#FFC2D4', '#E9B8F2',
    '#B49CF0', '#7E6BD6', '#A9DDF7', '#5DADEC', '#3A6EA5', '#8FE3D3', '#B8EBC0', '#7CCB72',
    '#3E9E54', '#2E6B45', '#C4D97A', '#F2DEB8', '#D9A066', '#9C6B43', '#5E3D2B', '#FFFFFF',
    '#D7DAE5', '#8A8FA3', '#3F3A45',
  ],
};
