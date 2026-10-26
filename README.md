# Autocomplete Keyword Finder

A free keyword research tool that collects Google Autocomplete suggestions and organises them into something you can pick from. **It runs entirely in the user's browser** — there is no backend, no database and no account. Each user's requests go from their own browser straight to Google.

## What it does

1. You enter a seed keyword, a country and a language, then choose **Quick**, **Standard** or **Deep**.
2. The tool asks Google for suggestions using several methods (the keyword itself, A–Z after/before, 0–9, question words, connector words, and optional words of your own).
3. At deeper levels it expands the most promising keywords it found (those that still contain the seed, ranked by how often Google returned them).
4. Results are analysed in the browser:
   - **Intent tags** — question, comparison, commercial, local, year, informational (word-list rules)
   - **Word count** — filter to 4+ words for long-tail terms
   - **Hits** — how many different queries returned the keyword (a free popularity hint)
   - **Position** — best position in Google's list (1 = top)
   - **New words** — words in the results that aren't in the seed, ranked by frequency (the sub-topics)
   - **Topics** — keywords grouped by their most common new word (roughly one article per group)
5. Star keywords, filter, sort, and export CSV (all, filtered, or starred).

| Preset | Depth | Max requests | Time at 0.5 s |
|---|---|---|---|
| Quick | 1 | 100 | ~1 min |
| Standard | 2 | 400 | ~3.5 min |
| Deep | 3 | 800 | ~7 min |

Requests are capped at 800 per run. The default delay is 0.5 s. If Google stops answering, the delay doubles automatically; after 5 failures in a row the run **cools down for 2 minutes and retries by itself** (4, 8, then up to 10 minutes if it keeps happening), with a countdown and a "Retry now" button. Progress is saved in the browser (localStorage), so a refresh doesn't lose results.

### Seed rule

Every keyword must contain all the seed words, in any order. Plurals and words with the same root count: for "age calculator", *calculate age in days* and *age calculators* are kept, *agent calculator* and *pregnancy due date* are skipped. Short grammar words in the seed ("for", "in", "the") are optional. Skipped suggestions are counted as "Off-topic skipped".

### Clean up

- **Exclude words** — hide every keyword containing a word or phrase (plurals included). Suggestions such as *login, job, reddit, salary* are offered only when they appear in the results. In the **New words** tab, ✕ excludes a word in one click.
- **Only keep keywords containing** — any of the words you list.
- **Hide other languages/scripts** (on by default) and **hide very long keywords** (10+ words).

Hidden keywords stay in the run and return when a rule is removed. Topics, new words and exports use the cleaned list.

## How it reaches Google without a server

Browsers block `fetch()` to Google's Suggest endpoint (no CORS headers). The tool loads the endpoint as a `<script>` instead (JSONP, `client=chrome&callback=...`), which browsers allow. All Google access lives in **`src/lib/suggest.js`**. The endpoint is unofficial: if Google changes or removes JSONP support, only that file needs replacing (for example with a browser-extension transport).

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (fake Google, no network)
npm run build    # production build in dist/
```

## Deploy to Vercel (free)

1. Push this folder to a new GitHub repository.
2. In Vercel: **Add New → Project**, import the repository.
3. Vercel detects Vite automatically (build command `npm run build`, output `dist`). Click **Deploy**.

Any static host works the same way (Netlify, Cloudflare Pages, GitHub Pages): build with `npm run build` and serve `dist/`.

## Project layout

```
src/
  lib/
    suggest.js     Google Suggest via JSONP (the only network code)
    expansion.js   builds the queries for each method
    engine.js      level-by-level research with budget, pause/resume, back-off
    analysis.js    intent tags, new words, topic groups
    cleanup.js     exclude/include words, script and length filters
    wordlists.js   per-language word lists (questions, connectors, intents, stopwords)
    text.js        normalising, tokenising, seed matching
    csv.js         CSV export (UTF-8 BOM, formula-safe)
    storage.js     save/restore the current run in the browser
  components/
    SetupForm.jsx  seed, country, language, presets, advanced settings
    RunPanel.jsx   progress and controls
    Results.jsx    keyword table, topics, new words, export
    CleanupPanel.jsx  exclude/include chips and junk filters
```

## Limits

- Google Autocomplete gives no search volume or competition data.
- Country (`gl`) and language (`hl`) are hints; Google also uses the user's own location. A VPN in the target country gives the closest match.
- Intent tags and topics are simple text rules, so a few keywords will be tagged or grouped imperfectly.
- Results live in one browser. Export CSV to keep them elsewhere.
