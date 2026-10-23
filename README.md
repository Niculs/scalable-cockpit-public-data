# Scalable Cockpit public JSON

Public, read-only copies of the existing sanitized summary, positions and historical purchases APIs. No credentials or raw broker imports belong in this repository.

The JSON files preserve financial values and original quote/data timestamps. `delivery.copied_at` identifies the copy time. Intended automatic refresh interval: 15 minutes; scheduled runs can be delayed. Treat copies older than an hour as stale. This is a snapshot service, not a live proxy.

The publisher validates all three source responses before writing anything. Failed refreshes fail visibly and do not replace the last successful publication. No paid hosting, custom domain or local installation is required.

Run `node --test sync.test.mjs` and `node sync.mjs` with the preinstalled Node runtime. Only the generated `public/` folder is published through GitHub Pages.
