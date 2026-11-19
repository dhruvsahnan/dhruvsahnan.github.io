# Personal website

A static, single-page academic website. All content lives in JSON files under `data/` and is rendered in the browser by `js/site.js`, so updating the site means editing a JSON file and pushing.

```
index.html        page shell (rarely edited)
css/site.css      styles
js/site.js        reads data/*.json and renders each section
data/*.json       YOUR CONTENT: one file per section (see data/README.md)
assets/           CV, slides, posters
images/           profile photo and other images
scripts/validate.py   checks the JSON files before you push
```

## Preview locally

Browsers block JSON loading from `file://`, so use a tiny local server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Update content

1. Edit the right file in `data/` (see [`data/README.md`](data/README.md) for every field).
2. Run `python3 scripts/validate.py`.
3. Commit and push.

## Deploy on GitHub Pages

Create a repository named `<your-username>.github.io`, push this folder to its `main` branch, and enable Pages (Settings, Pages, deploy from the `main` branch root). For a custom domain add a `CNAME` file containing the domain name.

## Credits

The layout and styling are adapted from [Aseem Srivastava's site](https://aseemsrivastava.com), which credits [Ashish Sharma's template](https://ash-shar.github.io/), which is built on Sebastin Santy's [minimal-research-theme](https://github.com/SebastinSanty/minimal-research-theme). That theme's README states a [Creative Commons Attribution-ShareAlike 3.0](http://creativecommons.org/licenses/by-sa/3.0/) license, so keep the credit in the footer (`footer` in `data/site.json`).
