[English](operator-install.md) · [Русский](operator-install.ru.md) · [SendPulse setup](sendpulse-setup.md) · [Repository](../README.md)

# Operator installation guide: Личный кабинет

Deploy your own application with your own Telegram bot, Netlify site, Neon PostgreSQL database, and SendPulse account. This guide is derived from the public source and describes a reproducible setup and its acceptance checks. It does **not** certify a live deployment, bot scenario, email delivery, or AI output.

The application provides Telegram sign-in, editable personal context, diary and analysis history, consultation summaries, understanding documents, focus links, and period reviews. SendPulse scenarios, schedules, voice transcription, and bot AI instructions are a separate configuration layer: reconstruct them with the [SendPulse setup kit](sendpulse-setup.md). No private account export or subscriber dataset is bundled.

## Choose the transport deliberately

| Mode | Configuration | What happens |
| --- | --- | --- |
| Full SendPulse installation | `CABINET_TRANSPORT=sendpulse` | Telegram identity is bound to a contact of your configured SendPulse bot; mapped state changes are pushed to that contact |
| Application without bot delivery | `CABINET_TRANSPORT=local` (default) | Telegram login and application database remain required; state is stored locally to your deployment, with no SendPulse delivery |

This guide's main path is **SendPulse**. Do not leave the default `local` mode and assume a successful save reached a bot. A local transport is not an offline app: it still uses hosted authentication/database services and, when enabled, OpenAI/email.

## 1. Prepare accounts and tools

- A Node.js 22.9.0 or newer runtime and npm for dependency installation, checks, and the static build.
- A Netlify account with support for the required Functions and Background Functions; check the limits of your plan.
- An empty Neon PostgreSQL database you control. Keep production and test/preview databases separate.
- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`) for schema installation and backup.
- A Telegram bot token and username from BotFather. In SendPulse mode connect this exact bot to your own SendPulse account, with API Request functionality available.
- An OpenAI API project/key only if you intend to use AI features. A ChatGPT subscription is not an API credential.
- SMTP credentials and an authorized sender only if you intend to send reports by email.

Clone the repository and inspect the revision you intend to deploy. Run commands from the application repository root:

```sh
npm ci
npm test
npm run build
```

The Netlify build uses the repository's build script and publishes its generated `dist` directory. Do not publish the repository root: migrations, operator scripts, environment files, and server source are not website assets. Keep the configured Functions directory `netlify/functions` separate from `dist`.

## 2. Configure the environment

Run `npm run setup` to create a local, ignored `.env` from [`.env.example`](../.env.example). The setup helper generates independent random application secrets and does not overwrite an existing file. Fill the remaining settings using your own accounts. For deployment, enter equivalent values in Netlify's environment settings with Functions access and the intended deploy context. A local `.env` is not automatically a deployed secret store. Never commit it or upload it as a static file.

If configuring secrets manually, generate independent random values for `JWT_SECRET`, `LK_SERVICE_SECRET`, and `SENDPULSE_DIARY_SECRET` using a password manager or secure secret generator. `JWT_SECRET` must be at least 32 characters; use strong random secrets rather than meaningful phrases. Share only the relevant ingestion secret with the matching server-side SendPulse API Request block.

### Required application and transport settings

| Variable | Type / purpose | Required |
| --- | --- | --- |
| `CABINET_TRANSPORT` | `local` or `sendpulse` | Set explicitly for your chosen mode |
| `DATABASE_URL` or `NETLIFY_DATABASE_URL` | Neon PostgreSQL connection URL; `DATABASE_URL` takes precedence | Yes |
| `TELEGRAM_BOT_TOKEN` | Secret bot token | Yes, including local transport |
| `TELEGRAM_BOT_USERNAME` | Bot username without `@` | Yes |
| `JWT_SECRET` | Random session-signing secret, at least 32 characters | Yes |
| `TELEGRAM_AUTH_MAX_AGE_SECONDS` | Positive integer; signed Telegram login freshness, default 900 seconds | Optional |
| `BOT_TIMEZONE` | IANA timezone for bot scheduling and default date handling; default `UTC` | Set explicitly and align SendPulse schedules |
| `SENDPULSE_CLIENT_ID` | SendPulse OAuth client identifier | SendPulse mode |
| `SENDPULSE_CLIENT_SECRET` | SendPulse OAuth client secret | SendPulse mode |
| `SENDPULSE_BOT_ID` | ID of the connected Telegram bot inside SendPulse | SendPulse mode |
| `SENDPULSE_DIARY_SECRET` | Shared secret for `/api/diary` | If receiving diary events |
| `LK_SERVICE_SECRET` | Service secret for trusted ingestion and privileged CLI authentication | If using those service routes |
| `LK_SERVICE_RATE_LIMIT` | Positive integer fallback service request limit, default 120 | Optional |
| `LK_SERVICE_RATE_WINDOW_MINUTES` | Positive integer rate window, default 10 minutes | Optional |

Several routes declare their own limits: CLI authentication uses 60, analysis-session ingestion 120, CRM and link-signal ingestion 240 per configured window. Those endpoint limits override the global fallback. These limits use the audit table; missing or unavailable audit storage is not a reliable rate-limiting boundary. Apply all migrations and monitor errors.

`LK_SERVICE_SECRET` permits privileged server operations, including `/api/auth-cli`, which issues a session for an **existing** user selected by `user_id` or `sp_contact_id`. It is not a public login method or a registration API. Do not put this secret into the browser or issue CLI sessions for users without authorization.

### Optional operator CLI settings

The CLI is an administrative client for your own deployment, not a second server or a public login flow. Inspect its help before invoking a command; some commands write records or trigger paid AI work. A smoke run against a real account is not an offline test.

| Variable | Meaning |
| --- | --- |
| `LK_BASE_URL` | Your application origin; default `http://localhost:8888` |
| `LK_CLI_SP_CONTACT_ID` | Your authorized existing test contact, as an alternative to a user UUID |
| `LK_CLI_USER_ID` | Your authorized existing application user UUID |
| `LK_CLI_OUTPUT` | CLI output format; default `text` |
| `LK_CLI_TIMEOUT_MS` | Request timeout in milliseconds; default 30,000 |

The CLI uses `LK_SERVICE_SECRET`. Unlike the configuration/migration npm commands, `npm run cli` does not automatically load `.env`; use an explicitly prepared environment or `node --env-file=.env cli/index.mjs --help` to read help with that file. Keep identifiers and any issued sessions private.

### AI settings

| Variable or family | Meaning |
| --- | --- |
| `OPENAI_API_KEY` | Server-only OpenAI API key |
| `OPENAI_MODEL` | Explicit model available to your API project; the source has a fallback but does not guarantee your access to it |
| `OPENAI_MAX_OUTPUT_TOKENS` | Optional positive output-token limit; unset leaves the request without this explicit limit |
| `OPENAI_TIMEOUT_MS` | Request timeout in milliseconds; default and upper cap 600,000 |
| `OPENAI_REASONING_EFFORT` | `minimal`, `low`, `medium`, `high`, or `xhigh`; default `high`; applied only by supported model routing in the source |
| `OPENAI_DIARY_MODEL`, `OPENAI_DIARY_MAX_OUTPUT_TOKENS`, `OPENAI_DIARY_TIMEOUT_MS` | Diary summary overrides; absent values fall back to the base settings |
| `OPENAI_POSTER_MODEL`, `OPENAI_POSTER_MAX_OUTPUT_TOKENS`, `OPENAI_POSTER_TIMEOUT_MS` | Poster-prompt generation overrides |
| `OPENAI_RAZBOR_MODEL`, `OPENAI_RAZBOR_MAX_OUTPUT_TOKENS`, `OPENAI_RAZBOR_TIMEOUT_MS` | Understanding-document generation overrides |
| `OPENAI_LINKS_MODEL`, `OPENAI_LINKS_MAX_OUTPUT_TOKENS`, `OPENAI_LINKS_TIMEOUT_MS` | Link-signal analysis overrides |
| `OPENAI_RETRO_MODEL`, `OPENAI_RETRO_MAX_OUTPUT_TOKENS`, `OPENAI_RETRO_TIMEOUT_MS` | Period review overrides |
| `TRUNCATE_HEAD_CHARS` | Consultation input head allowance, default and maximum 12,000 characters |
| `TRUNCATE_TAIL_CHARS` | Consultation input tail allowance, default and maximum 8,000 characters |
| `DIARY_INPUT_MAX_CHARS` | Diary summary input budget, default 30,000 characters |
| `POSTER_INPUT_MAX_CHARS` | Poster-prompt source budget, default 3,500 characters |

Use a model compatible with the Responses API, required structured-output formats, and requested reasoning setting. Test one small fictional input before increasing workload. Changing an environment variable does not configure a SendPulse AI block. Poster generation returns **text prompts**, not image files. Long consultation input is reduced to its head and tail; a resulting summary does not establish full-transcript coverage.

### Email settings

| Variable | Meaning |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT` | SMTP host and numeric port; default port 587; port 465 enables implicit TLS |
| `SMTP_USER`, `SMTP_PASS` | SMTP credentials |
| `MAIL_FROM` | Authorized sender address |
| `MAIL_REPLY_TO` | Optional reply address; defaults to sender |
| `MAIL_BCC` | Optional extra recipient; set only if you intentionally want every report email copied there |

The legacy `SENDPULSE_SMTP_HOST`, `SENDPULSE_SMTP_PORT`, `SENDPULSE_SMTP_USER`, and `SENDPULSE_SMTP_PASS` names are accepted as fallbacks. SMTP can use SendPulse or another provider. Leaving SMTP unconfigured does not enable mail: email attempts fail while stored reports remain available. Configure your provider's sender/domain verification before testing. Never silently set a third-party BCC.

Check local settings without printing their values:

```sh
npm run check:env
```

## 3. Initialize the database

Use a fresh database for your first deployment. Review the planned migration order, then explicitly apply it:

```sh
npm run migrate
npm run migrate -- --apply
```

The first command is a dry run: it lists all migration files without connecting to a database, so it does not establish which have already been applied. The applying command uses `psql`, a transaction, and migration checksums to skip matching recorded migrations. Run every pending numbered migration, including the service audit tables; an incomplete schema can make parts of the UI appear operational while other flows fail.

The schema stores user/contact bindings, personal state and versions, consultation results, diary entries and summaries, understanding documents, links, signal queues and suggestions, CRM events, progress events, retrospective reports, analysis sessions, successes, and service-request audit records. In SendPulse mode the OAuth token cache is also in the database. Treat a database backup as sensitive, even if the source repository is public.

Do not import another person's database dump to make your installation “work.” The first Telegram login creates your own user's mapping and initial state. State versions are limited snapshots, not full database backups.

## 4. Deploy and connect Telegram

1. Import your reviewed repository into your Netlify account. Use the committed `netlify.toml`: build command `npm run build`, publish directory `dist`, Functions directory `netlify/functions`.
2. Add the environment from step 2 to the correct deploy context. Use a dedicated test database, bot, and credentials for previews. A preview sharing production credentials can write to production.
3. Deploy and inspect the build/Function logs for missing configuration or bundling errors without copying private request bodies into an issue.
4. Open your HTTPS origin. Check `GET /api/config`: its public bot username and transport must match your installation; no secret should appear. An unauthenticated `GET /api/me` should not return a user.
5. Use BotFather `/setdomain` for the application's domain and your configured Telegram bot. The [Telegram Login Widget documentation](https://core.telegram.org/widgets/login/) describes this binding.
6. In SendPulse mode finish the [registration flow](sendpulse-setup.md#1-connect-the-bot-and-prepare-registration). A subscriber must send `/start` and complete the application's Telegram login before inbound events can be assigned to them.
7. In local mode open the application and sign in through Telegram without a SendPulse contact parameter. The transport uses its own `local:<telegram_id>` contact key in the existing schema; do not configure a SendPulse flow to guess or use these internal keys.

A successfully loaded webpage does not prove authentication, database writes, bot delivery, background execution, or email delivery. Verify each separately below.

## 5. Understand background work

The browser starts a record, invokes its background function, then polls the status route. Netlify Background Functions return an initial `202` when accepted; this is **not** a completed report. The platform documents up to 15 minutes of execution: verify plan support and payload limits for your deployment. [Netlify Background Functions](https://docs.netlify.com/build/functions/background-functions/)

| Workflow | Start request | Background request | Status read |
| --- | --- | --- | --- |
| Consultation | `POST /api/summarize-start`, JSON `{"summary_type":"one_on_one"}` or `"topics"` | `POST /api/summarize-background?id=<id>`, multipart form | `GET /api/summarize-status?id=<id>` |
| Diary period | `POST /api/diaries-summary-start`, JSON `{"date_from":"YYYY-MM-DD","date_to":"YYYY-MM-DD"}` | `POST /api/diaries-summary-background?id=<id>` | `GET /api/diaries-summary-status?id=<id>` |
| Period review | `POST /api/retro-start`, JSON with `date_from` and `date_to` | `POST /api/retro-background?id=<id>` | `GET /api/retro-status?id=<id>` |

Use the authenticated application UI for these operations; they are not SendPulse webhook endpoints. Consultation multipart fields are `consultationId`, `summaryType`, required file `transcript`, optional file `notes`, and optional `email`. Leave the honeypot `company` empty. Files are UTF-8 text; `.vtt` receives subtitle cleanup. A `.pdf`, audio recording, or Word file is not decoded by this uploader. The application limit is 5 MiB per file; provider request limits can be lower.

Consultations are limited to five starts per user per 24 hours. Diary periods have a maximum of 90 days and require entries. A completed result remains in the database for UI retrieval. Read `status` (`processing`, `completed`, or `failed`) and `error_message`; do not equate acceptance with completion. Consultation background jobs are claimed once: a replay cannot acquire a second run, and a completed job is not regenerated by replaying the same request. The handler's `already_started` marker is not a substitute for the platform status check. For a stuck job, inspect its status and sanitized server logs before creating a new job, to avoid duplicate paid work.

Generating a consultation summary does not automatically apply all extracted fields. Preview with `POST /api/summarize-apply` using `consultation_id`, `selected_fields`, and `preview:true`, review it, then apply the intended selection through the UI. Understanding-document activation and link publishing are separate user actions. Processing a queued signal produces a suggestion; review it before accepting progress or creating a link.

Report-email endpoints use the authenticated session and a user-chosen recipient:

- `POST /api/summarize-email`: `consultation_id`, `email`, optional `summary_text`;
- `POST /api/diaries-summary-email`: `summary_id`, `email`, optional `summary_text` (without an ID the latest summary is selected);
- `POST /api/retro-email`: `retro_id`, `email`, optional `retro_text`.

The record must already be completed. Consultation auto-email is optional; its failure does not undo the completed summary. A `200` email response means SMTP accepted the send call, not that the recipient opened or even received the email.

## 6. Data boundaries and operating limits

Telegram authenticates identity. Netlify processes requests. Neon stores the application records. In SendPulse mode the provider receives mapped profile/context fields, and bot flows may send user text back to the application. When an AI action is invoked, its selected source material goes to the configured OpenAI project. The public AI helpers request `store:false`; this setting does not by itself establish every provider retention or logging policy. Sending email discloses the report to the chosen recipient and any explicitly configured BCC.

The application does not scan local computer history, Codex conversations, external drives, or other account data. It operates on submitted material and configured integration events. Nevertheless, application state and reports can contain highly personal information. Disclose the actual providers, destinations, retention arrangements, and optional email copy to your users before collecting such material. This repository does not supply your organization's legal policy or a complete self-service data-erasure flow.

Incoming service events are assertions from a trusted sender; they do not prove user understanding, a completed consultation, or the cause of a difficulty. AI outputs need review. Queues, suggestions, and counters must not be relabeled as established outcomes.

**Delivery limitations:** incoming events do not promise deduplication on retry. SendPulse variable synchronization is sequential; an error can leave some remote fields updated while the local state save reports failure. There is no distributed transaction across PostgreSQL and SendPulse. Inspect both sides before retrying a failed save. Changing transport on an existing deployment is not an automatic data migration: existing contact bindings and external variables need deliberate reconciliation.

## 7. Acceptance walkthrough

Use only the [fictional fixtures](examples/README.md) and accounts you control for the first run. Record actual results privately; do not mark a check passed because these instructions exist.

| Check | Expected evidence |
| --- | --- |
| Static build | `npm test` and `npm run build` pass; website assets come from `dist` |
| Environment/schema | Configuration checker passes; all migrations applied to the intended database |
| Sign-in | Fresh Telegram login succeeds; `/api/me` returns only your user; expired/invalid authentication is rejected |
| Isolation | A second test account cannot use the first account's SendPulse contact or read its records |
| State | Save a fictional task plus valid timezone and times; reload and read it back; in SendPulse mode also inspect the contact variable |
| Inbound flows | Complete all [SendPulse acceptance checks](sendpulse-setup.md#5-acceptance-walkthrough-with-fictional-data), including error branches and a real timed test message |
| Consultation | Upload [transcript.txt](examples/transcript.txt); observe `processing` then `completed`, or a clear failure; inspect the summary against the short source |
| Apply | Preview selected fields, apply one intended change, reload, and verify it; unselected fields should not be assumed changed |
| Diary and period review | Generate reports for the date range actually containing your test events; confirm status and displayed source counts |
| Email, if enabled | Send one fictional report to an address you control, verify actual receipt and the configured copy behavior |
| Recovery | Restore a test backup into a separate database and open the same fictional records there |

The sample event timestamps are fictional. Change them to dates within your test period when exercising period filters; diary dates use receipt time instead. Keep timed reminder delivery separate from variable-sync verification.

## 8. Back up, restore, and update

Before a schema or provider change, pause inbound test/production flows as appropriate and take a private database backup. Set `PRIVATE_BACKUP` to a protected path outside the checkout. The following are operator examples, not commands this repository runs automatically:

```sh
pg_dump --format=custom --no-owner --file "$PRIVATE_BACKUP" "$NETLIFY_DATABASE_URL"
pg_restore --list "$PRIVATE_BACKUP"
```

If using `DATABASE_URL`, use that connection variable instead. Store encrypted backups and their keys separately; apply an explicit retention policy. Database backups include user data and may contain OAuth tokens. Also preserve the deployed source revision, migration history, a private configuration inventory, and your own SendPulse scenario export or reconstruction notes. Never commit secrets or backup files to the public repository.

For a recovery drill, create an empty isolated database and set `RESTORE_DATABASE_URL` to it. Restore there, not over a running production database:

```sh
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$RESTORE_DATABASE_URL" "$PRIVATE_BACKUP"
```

Deploy the matching source revision with test credentials pointing to that database, then repeat sign-in/readback checks. Old sessions may need replacement; rotate cached/provider credentials if exposure is suspected. A Netlify code rollback does not undo database migrations or external SendPulse changes.

For an update: record the current revision → back up → review release changes and migration plan → test on an isolated database → install dependencies and run tests/build → apply pending migrations → deploy → repeat the affected acceptance checks. Do not edit an already recorded migration to force its checksum to pass. If a schema change is incompatible with the previous version, plan a database restore or an explicit forward fix before upgrading.

## 9. Troubleshooting

| Symptom | Check first |
| --- | --- |
| `bot domain invalid` | BotFather domain, exact public HTTPS host, and configured bot username |
| `no_contact` / unknown contact | `/start` completed, correct contact ID from the flow, correct `SENDPULSE_BOT_ID`, and first application login |
| Contact mismatch | Telegram account and SendPulse bot/contact ownership; do not bypass the check |
| Save rejected with `422` | `tz`, `t1`, `t2`, supported timezone choice, field lengths, and numeric ranges |
| Save succeeds but bot does not change | `CABINET_TRANSPORT`, remote variable name, and actual SendPulse flow usage |
| Wrong reminder time | User timezone, `BOT_TIMEZONE`, imported time values, current daylight-saving offset, and the real scheduler configuration |
| Webhook `401` | Correct secret family and header; `X-SP-Signature` is the diary shared secret |
| AI absent or failed | API key/project model access, timeout/token limits, input format, job status, sanitized Function logs |
| Email failed | SMTP credentials/port, authorized sender, provider delivery logs and recipient spelling |
| History empty after deployment | Correct database/context, completed user registration, and all migrations applied |

For a public bug report include source revision, affected endpoint, HTTP status, and a minimal fictional reproduction. Exclude tokens, cookies, connection URLs, contact identifiers, email addresses, transcripts, and full provider error responses.
