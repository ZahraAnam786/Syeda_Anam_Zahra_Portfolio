# Syeda Anam Zahra Portfolio

A static portfolio (plain HTML, CSS and JavaScript) hosted on GitHub Pages.

## Managing projects without touching code

Every project (the five original ones too) is edited from `admin.html` on the live site, for example
`https://<username>.github.io/<repo>/admin.html`.

1. **Connect** with a GitHub token (one time, see below). Tick "Remember" to stay connected on that device.
2. Click **New project**, or **Edit** on an existing one. Fill in the name, description, technologies, links,
   colour and the **sections** of the project page (each section holds text, highlights, screenshots or a table).
3. Click **Preview**, then **Publish**.

The admin page has two tabs:

- **Projects**: add, edit, reorder and delete projects (steps above).
- **Site content**: everything else on the home page. Name, the rotating words (add, delete, swap order), the
  line under the name, photo, CV (PDF), contact details and links, About (paragraphs, numbers, quick facts),
  Skills groups, Experience and Education timeline, the scrolling tech strip, the Contact text, and the
  **order of the sections** (move up/down or hide). **Preview** shows the page before **Save and publish**.

Publishing saves everything to the repository as one commit. GitHub Pages rebuilds the site and the change shows
up after about 1 to 2 minutes. The project at the top of the list is the big "Latest project" panel on the home
page. Use the arrow buttons in the list to change the order. **Delete** removes a project and the pictures that
were uploaded for it.

The admin page has a **Download demo (PDF)** button. The PDF explains which field takes what, with an example.
Its source is `docs/admin-demo-guide.html` (open it in Chrome and print to PDF to rebuild
`assets/pdf/Admin-Demo-Guide.pdf`).

### Creating the token (one time)

1. Open <https://github.com/settings/personal-access-tokens/new>.
2. Name it `portfolio-admin` and pick an expiration (90 days or more).
3. Repository access: **Only select repositories**, then choose this repository.
4. Repository permissions: **Contents: Read and write**.
5. Generate the token and paste it into the admin page. Do not share it. When it expires, make a new one.

The token is only sent to `api.github.com`. Without it, `admin.html` cannot change anything.

## How it works

- `data/projects.json` holds all projects (newest first), each with its sections and blocks.
- `assets/img/projects/<project>/` holds screenshots uploaded from the admin page (resized to 1600px wide).
  The original pictures stay in `assets/img/`.
- `project.html?id=<project>` is the one template page for every project.
- `data/site.json` holds all the other home page content (edited in the admin "Site content" tab).
  `index.html` is an empty shell: `assets/js/site.js` draws the menu, hero, About, Skills, Experience, Contact and
  the footer (the footer on project pages too) from it, and `assets/js/projects.js` draws the project panel and
  cards. The admin preview uses the same code. `assets/js/admin-site.js` is the editor for `site.json`.
- `assets/img/site/` and `assets/pdf/CV-*.pdf` hold the photo and CV uploaded from the admin page.
- `assets/js/model.js` converts between the data file and the admin form.
- `assets/js/github.js` saves a change as a single commit through the GitHub API.

The old per-project pages (`EventPlanner.html`, `ChitChat.html`, ...) were replaced by this template, so links
to them no longer exist. Delete them from the repository too if they are still there.

## Running locally

```
python -m http.server 8080
```

Then open <http://localhost:8080>. (Opening index.html straight from the folder does not work: the page loads its content from the data files.) (Opening index.html straight from the folder does not work, because the page loads its content from the data files.) The home page needs a web server (not `file://`) because it loads
`data/projects.json`.
