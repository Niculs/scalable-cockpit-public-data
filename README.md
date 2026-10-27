# Scalable Cockpit public JSON

Public, read-only copies of the existing sanitized summary, positions, historical purchases and complete dated transactions APIs. Purchases cover all imported securities, including closed positions. Transactions additionally include sales, net/gross dividends, reinvestments, fees, taxes, transfers and corporate actions. No credentials, account numbers, raw import IDs or counterparty names belong in this repository.

The JSON files preserve financial values and original quote/data timestamps. `delivery.copied_at` identifies the copy time. Intended automatic refresh interval: 15 minutes; scheduled runs can be delayed. Treat copies older than an hour as stale. This is a snapshot service, not a live proxy.

The publisher validates all four source responses and matching broker revisions before writing anything. A partial paginated transactions response is rejected. Failed refreshes fail visibly and do not replace the last successful publication. No paid hosting, custom domain or local installation is required.

`transactions.json` contains the entire imported broker history without pagination. The MCP tool `get_portfolio_transactions` returns 100 rows by default; follow `pagination.next_offset` until `has_more` is false. Available filters include ISIN, broker, transaction type, dates and virtual depot. Virtual depot assignments are current/remembered preferences, not historically verified membership. Do not interpret the first purchase of an assigned ISIN as an independently verified depot start. BW LPG has linked earlier ISINs documented in `corporate_action_links`.

Run `node --test sync.test.mjs` and `node sync.mjs` with the preinstalled Node runtime. Only the generated `public/` folder is published through GitHub Pages.
