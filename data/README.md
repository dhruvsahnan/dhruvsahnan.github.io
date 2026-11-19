# Editing your site's content

Everything on the site comes from the JSON files in this folder. To add something new, open the matching file, add an entry, save, push. You never need to touch `index.html`.

After editing, run `python3 scripts/validate.py` from the site folder. It catches typos (a missing comma breaks the whole file) before you publish.

## Text formatting

Every text field accepts this light markup:

| You type | You get |
|---|---|
| `[label](https://example.com)` | a link (opens in a new tab) |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `\n` | a line break |

Anything else is shown literally, so `&`, `<` and quotes are safe. Inside JSON strings, write a double quote as `\"`.

## Dates

Use `"2026"`, `"2026-04"` or `"2026-04-19"`. News, publications, tutorials and talks are **sorted newest first automatically**, so add new entries anywhere in the list (top is easiest). Entries with no date go last. News and talks accept `date_label` to override how the date is displayed (e.g. `"2025 | 2026"`).

Any entry accepts `"hidden": true` to hide it without deleting it.

## Files

### `site.json`: global settings

| Field | Meaning |
|---|---|
| `title` | browser tab title |
| `description` | meta description |
| `author_names` | every spelling of your name used in author lists; these get underlined |
| `sections` | which sections appear and in what order. Remove a name to hide the section |
| `footer` | footer text (supports links) |

Social-preview tags (`og:image`, etc.) live in `index.html` because crawlers don't run JavaScript. Edit those by hand once.

### `profile.json`: sidebar

`name.first`, `name.last`, `photo` (path to an image), `email` (shown as plain text; write it as `you [at] domain.edu` to dodge scrapers), and `links`: a list of `{ "label", "url", "icon" }`. Icons are [Font Awesome 5 free](https://fontawesome.com/v5/search?m=free) class names such as `fab fa-github`.

### `about.json`

`title` (the "Hello!" heading) and `paragraphs`: a list of strings, one per paragraph.

### `news.json`

`title`, `visible_count` (how many show before "Show more"), and `items`:

```json
{ "date": "2026-11", "text": "Our paper got accepted at [Conf](https://example.com)!", "highlight": true, "emoji": "🔥" }
```

`highlight` and `emoji` are optional (highlight shows the line in bold maroon).

### `publications.json` and `tutorials.json`

```json
{
  "date": "2026-07",
  "title": "Paper title",
  "authors": ["You", "Someone Else"],
  "venue_short": "ACL '26",
  "venue": "Annual Meeting of the Association for Computational Linguistics 2026",
  "venue_url": "https://2026.aclweb.org/",
  "award": "Best Paper Award",
  "note": "* equal contribution",
  "links": [{ "label": "paper", "url": "https://arxiv.org/abs/..." }]
}
```

Only `title` and `authors` are required (plus `date` for published work). Link labels are free text: `paper`, `code`, `dataset`, `slides`, `poster`, `video`, anything.

Add `"status": "under_review"` (or `"preprint"`) for work not yet published. These show after a dotted divider with "Under Review" / "Preprint" instead of a venue. Use `status_label` for custom wording.

Authors matching `author_names` are underlined. A trailing `*` or dagger is ignored when matching, so `"You*"` still counts. In `tutorials.json` you can also set `authors_prefix` (e.g. `"Organizers:"`).

### `talks.json`

```json
{
  "date": "2026-10",
  "title": "One-line description of the talk",
  "event": "Event name",
  "event_url": "https://example.com",
  "links": [{ "label": "Slides", "url": "assets/slides.pdf" }]
}
```

### `responsibilities.json` and `teaching.json`

`title` and `items`: a list of strings (or `{ "text": "..." }`), shown in the order you write them.

## Adding files

Put PDFs (CV, slides, posters) in `assets/` and link them as `assets/your-file.pdf`. Put images in `images/`.
