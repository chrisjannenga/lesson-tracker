# Lesson Tracker

A small two-panel (Math / Language Arts) tracker for finishing an IXL skill
plan by the end of the month. Built with React + Vite.

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Deploy to Vercel

**Option A — Vercel CLI (fastest, no GitHub needed)**

```bash
npm install -g vercel   # one-time
cd lesson-tracker-react
vercel                  # follow the prompts, accept the defaults
vercel --prod           # promote to your production URL
```

**Option B — GitHub + Vercel dashboard**

1. Push this folder to a new GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import that repo.
3. Vercel auto-detects the Vite framework preset — no config needed.
   Build command: `vite build`, output directory: `dist`.
4. Click **Deploy**.

## Updating the dates each month

`src/App.jsx` has two constants near the top:

```js
const START_DATE = new Date(2026, 8, 24) // Sept 24, 2026
const END_DATE = new Date(2026, 8, 30)   // Sept 30, 2026
```

Note JavaScript months are 0-indexed (0 = January, 8 = September). Update
these two lines and the `defaultRemaining` props passed to each
`<SubjectPanel>` in `App.jsx` whenever you start a new tracking period.

## How it works

- **Lessons remaining** (top of each panel) is a number you type in by hand
  whenever you re-check the actual IXL skill plan. Editing it immediately
  recalculates that subject's daily goal.
- **Days left** is computed live from today's real date against `END_DATE`.
- **Per day to finish** is a frozen goal — it only changes when you edit
  "lessons remaining" or tap **Recount**. Recount tallies everything logged
  since the last recount, subtracts it from the total, and re-splits
  whatever's left evenly across today and the remaining days. So if a day
  or two falls short, Recount raises the pace for what's left instead of
  quietly leaving the goal too low to finish on time.
- The **daily log** lets you tap `+` each time a lesson is finished. Tapping
  `−` requires a second confirming tap within ~2.5 seconds before it
  actually removes one, so an accidental tap won't undo progress.
- Everything is saved in the browser's `localStorage`, per browser/device —
  it isn't synced anywhere.
