# Med Tracker

Post-transplant medication, vitals, and lab tracker. Vanilla JS PWA — no framework, no build step, no server. Your data lives in your own Google Sheets.

## What it does

- **Medication schedule** — define meds with times, doses, alternating dose rules (odd/even days, weekday patterns), and conditional meds (e.g. "take if BP > 140/90")
- **Daily tracker** — check off meds, log blood pressure (AM/PM), weight, temperature, notes
- **Fluid tracking** — water intake and urine output with running totals
- **Lab results** — creatinine, tacrolimus levels with history
- **Offline-first** — works without internet, syncs when back online
- **Multi-device** — data syncs through Google Sheets, accessible from any device

## How it works

1. Sign in with Google
2. The app creates a Google Sheet in your Drive (you own the data)
3. All tracking data syncs to that sheet automatically
4. You can open the sheet directly anytime — it's a normal spreadsheet

## Setup

### Run locally

```bash
npx serve -l 3000 .
```

Open `http://localhost:3000`.

### Deploy to Vercel

```bash
vercel
```

The included `vercel.json` handles SPA routing.

### GCP project setup

The app needs a Google Cloud project with:

1. **APIs enabled**: Google Sheets API, Google Drive API
2. **OAuth consent screen**: External, no scopes needed on the consent screen itself
3. **OAuth client**: Web application type, with your domain in Authorized JavaScript origins
4. **API key**: unrestricted is fine (browser-visible by design)

Update `CLIENT_ID` and `API_KEY` in `js/auth.js` with your own credentials.

## Tech

- Vanilla JS (ES modules, no bundler)
- Google Identity Services (GIS) for auth
- `gapi.client` for Sheets/Drive API calls
- Service worker for offline caching
- localStorage for offline state + sync queue

## File structure

```
index.html          Main page (all views)
css/styles.css      Styles
js/
  auth.js           Google sign-in + gapi init
  sheets.js         Google Sheets API wrapper
  store.js          localStorage state + Sheets sync
  schedule.js       Med schedule config + versioning
  tracker.js        Daily tracker UI (meds, fluids, vitals)
  editor.js         Med schedule editor UI
  labs.js           Lab results UI
  app.js            Entry point, routing, glue
sw.js               Service worker (stale-while-revalidate)
manifest.json       PWA manifest
vercel.json         Vercel SPA config
```

## License

MIT
