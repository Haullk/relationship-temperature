# GeoPrizm GitHub Pages docs

This folder is the static developer documentation site published with GitHub Pages.

The docs are intentionally separate from the production Next.js app. They are meant for:

- API notes and future API reference
- data pipeline and deployment notes
- local development setup
- contribution guidance
- method transparency for developers and researchers

## Local preview

Open `docs/index.html` directly in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 8080 -d docs
```

## Publishing

The repository includes `.github/workflows/pages.yml`, which uploads the `docs/` folder to GitHub Pages.

In GitHub repository settings, set:

- Settings -> Pages -> Source -> GitHub Actions

After the workflow runs, the expected Pages URL is:

```text
https://haullk.github.io/relationship-temperature/
```

