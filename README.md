# CMA Design Questionnaire

A single-page intake questionnaire for prospective clients of Carlisle Moore
Architects. Each submission becomes a labelled GitHub Issue in this repo, so
every client's answers are searchable, taggable, and version-controlled.

The form lives at [`public/index.html`](./public/index.html). The serverless
submission handler lives at [`netlify/functions/submit.mjs`](./netlify/functions/submit.mjs).

---

## How it works

1. The client opens the deployed page (e.g. `https://cma-questionnaire.netlify.app/`).
2. They fill in any of the eight sections; the `§0 Opening` box at the top is for
   anything else they want to share.
3. On **Submit**, the page POSTs JSON to `/submit`.
4. The Netlify function authenticates with a GitHub Personal Access Token,
   creates a new Issue in the configured repo with:
   - **Title:** `{Client name} — Design Questionnaire — {YYYY-MM-DD}`
   - **Body:** the full Markdown-formatted answers, plus raw JSON in a collapsed `<details>`
   - **Labels:** `intake`, `client:{name-slug}`
5. The page shows a thank-you with a link back to the issue.

If the server is unreachable, the page falls back to a downloaded JSON file the
client can email manually. There are also two always-available alternate
buttons: **Download my answers** and **Email Scott directly** (mailto).

The form auto-saves to `sessionStorage` on every keystroke, so an accidental
reload doesn't lose the work.

---

## Per-client links

You can pre-fill the name field by appending `?client=Greenwich+Residence` to
the URL. Useful when sending unique-feeling links to specific prospects.

---

## Local development

```bash
# 1. Install Netlify CLI once (system-wide)
npm install -g netlify-cli

# 2. From this directory
cp .env.example .env       # then fill in GITHUB_TOKEN and GITHUB_REPO
netlify dev                # serves on http://localhost:8888
```

`netlify dev` runs both the static site and the function locally and proxies
`/submit` to the function automatically.

---

## Deployment (Netlify, free tier, private GitHub repo)

1. **Create the GitHub repo (private).**
   - Push this folder to `github.com/<your-handle>/cma-questionnaire`.
2. **Create a fine-grained GitHub Personal Access Token.**
   - https://github.com/settings/tokens?type=beta
   - Repository access: *only this repo*.
   - Permissions → Repository → **Issues: Read and write**.
   - Copy the token. It starts with `github_pat_…`.
3. **Connect the repo to Netlify.**
   - https://app.netlify.com/start
   - Pick GitHub → select the private repo → accept the auto-detected
     settings (publish dir `public`, functions dir `netlify/functions`).
4. **Set environment variables on the Netlify site.**
   - Site settings → Environment variables → Add:
     - `GITHUB_TOKEN` = the token from step 2
     - `GITHUB_REPO`  = `<your-handle>/cma-questionnaire`
   - Trigger a redeploy.
5. **Seed the labels (optional, one-time).**
   ```bash
   GITHUB_TOKEN=github_pat_... GITHUB_REPO=your/repo node scripts/create-labels.mjs
   ```
   The submit function will fall back to creating issues without labels on its
   first run, so this is a polish step rather than a blocker.

That's it. Send the deploy URL to a prospect.

---

## Where the data lives

- **Each submission:** a GitHub Issue, tagged `intake` + `client:{slug}`.
- **Filter by client:** `https://github.com/<repo>/issues?q=label%3Aclient%3Agreenwich-residence`
- **Export everything:** `gh issue list --label intake --json …` or the GitHub
  Issues API.
- **Raw JSON:** every issue body has a `<details>Raw JSON</details>` block so
  you can re-read the data programmatically.

If you ever want a flat-file mirror (one `submissions/{slug}-{date}.json` per
client committed to the repo), the function can be extended in ~20 lines using
the GitHub Contents API. Not done by default to keep the moving parts low.

---

## Files in this repo

```
.
├── README.md
├── netlify.toml                  # publish + functions config
├── package.json                  # node module type + scripts
├── .gitignore
├── .env.example                  # copy to .env locally
├── public/
│   └── index.html                # the questionnaire (Tufte, single-page)
├── netlify/
│   └── functions/
│       └── submit.mjs            # POST /submit → creates GitHub Issue
└── scripts/
    └── create-labels.mjs         # one-time label seeder
```

The repo also contains an `intake/` folder with reference HTML from CMA's
other tools (kept for design-language consistency) and the original
`cma-design-questionnaire.html` from the previous build.

---

## Privacy and security

- The repo is private. Submissions live in private Issues.
- The GitHub token never leaves the Netlify function — it is not exposed to
  the browser.
- The form sets only `sessionStorage` (not `localStorage`), so any draft is
  cleared when the tab closes.
- HTTPS is enforced by Netlify by default.

---

## Credits

Typography: [ET Book](https://github.com/edwardtufte/et-book) by Edward Tufte
and contributors, served via the jsDelivr CDN.

Color and rule-discipline: derived from CMA's existing project board and
billing tools so the questionnaire feels like part of the family.
