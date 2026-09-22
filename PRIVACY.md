# Data in Personal Cabinet

[English](PRIVACY.md) · [Русский](PRIVACY.ru.md)

The page also loads Tailwind from its CDN, Google Fonts and Telegram scripts. These providers receive ordinary browser requests and apply their own processing policies.

The public repository contains code and fictional examples. User records, tokens, the author's configuration and private repository history are excluded. Do not add them to issues, logs or screenshots.

Your deployment stores personal state, journals, transcripts and reports in its configured database. Netlify processes requests; Telegram verifies identity. When SendPulse is enabled, mapped fields are sent to your provider account. `local` mode disables that transport but does not make the app an offline, server-free program.

User-requested AI features send selected material to the configured OpenAI project. Calls use `store:false`; that does not override every provider retention and logging policy. Email sends a report to the selected recipient. `MAIL_BCC` defaults to empty; configuring it sends every email to an additional recipient.

Secrets stay in server configuration. `npm run setup` generates new secrets; use separate credentials for production and test deployments. The database and backups contain sensitive data, including a cached integration token. The operator controls access, retention and deletion; this application does not promise automatic deletion of copies held by external services.

See the [operator guide](docs/operator-install.md) for data flows and a two-account isolation check. AI output is material for human review, not an established cause or a verified personal change.
