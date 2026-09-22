[English](sendpulse-setup.md) · [Русский](sendpulse-setup.ru.md) · [Installation](operator-install.md) · [Repository](../README.md)

# SendPulse setup kit for Личный кабинет

This kit describes the public application's integration contract and a minimal bot you can reconstruct in your own account. It is **not an exported SendPulse bot**. No original account's flow graph, schedules, AI-agent instructions, voice transcription setup, tags, or subscriber data are included. The steps below need acceptance testing on your deployment; they are not a claim of live verification.

Use the [operator installation guide](operator-install.md) first. Set `CABINET_TRANSPORT=sendpulse`; the default `local` mode stores application state but does not deliver variable updates to SendPulse. Use your own Telegram bot, SendPulse account, and test subscribers.

## 1. Connect the bot and prepare registration

1. Create a bot through Telegram's BotFather and connect that same bot to SendPulse. Store its token only in Netlify's function environment as `TELEGRAM_BOT_TOKEN`; set `TELEGRAM_BOT_USERNAME` without `@`.
2. Obtain your SendPulse API client ID/secret and the ID of this connected bot. Set `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET`, and `SENDPULSE_BOT_ID` on the application. The bot ID is a SendPulse identifier, not the Telegram username or token.
3. Set the HTTPS application's domain with BotFather `/setdomain`. This is required for the [Telegram Login Widget](https://core.telegram.org/widgets/login/). If you choose a Telegram Web App button, configure it for the same application and retain the contact query parameter.
4. In SendPulse's `/start` or welcome flow, initialize the variables below and send an **Open Личный кабинет** URL button:

   ```text
   https://YOUR_PUBLIC_ORIGIN/?sp_contact_id=CONTACT_ID_INSERTED_BY_SENDPULSE
   ```

   Replace the origin with your deployment. Insert the subscriber's **system contact ID** with the builder's variable picker, not their Telegram ID, phone number, or a hardcoded contact. SendPulse documents `contact_id` as the [subscriber identifier](https://sendpulse.com/knowledge-base/chatbot/variable-types); inspect the expanded test URL before releasing the flow. `CONTACT_ID_INSERTED_BY_SENDPULSE` is explanatory text, not a SendPulse template expression.
5. Have the test subscriber send `/start`, open this button, and complete Telegram login. The signed Telegram identity must match the contact resolved for your configured SendPulse bot. A contact ID in a URL is not authorization.
6. On the first successful login the application creates the user mapping and imports mapped contact variables. Only then send diary or analysis events: an audience contact alone does not create an application user.
7. In Личный кабинет set timezone, morning time, and evening time, then save. All three are required for later state changes. Read back the corresponding contact variables in SendPulse.

**Account boundary:** the application's browser uses the `lk_session` cookie after Telegram login. The service and diary secrets belong only in server-side API Request headers. Never put them in a button URL, message, subscriber variable, frontend script, or browser request.

## 2. Create the contact variables

Names below are exact, including `№ дня`, suffixes, and leading zeroes. Mapped fields are imported at first login and refreshed whenever the application requests `GET /api/state-get`; this read merges the provider values into database state without creating a version. Application saves push changed fields back to SendPulse. An already displayed page is not a live subscription: reload/refresh state to see bot-side changes.

Use String variables for text and `HH:MM` values. Numeric fields accept integer values in the application; its SendPulse API adapter serializes outgoing values as strings, so verify your chosen SendPulse numeric variable type accepts them. Start with fictional text and no client material.

| Internal field | SendPulse variable | Type / limit | Meaning and direction |
| --- | --- | --- | --- |
| `cycle_day` | `№ дня` | Integer 1–10 | Cycle day; pushed only when explicitly edited, so an unrelated save does not reset a bot-maintained counter |
| `t1` | `time_vopros_utro` | String `HH:MM` | Morning time; application converts local time to `BOT_TIMEZONE` on outgoing sync |
| `t2` | `time_vopros_vecher` | String `HH:MM` | Evening time; same conversion |
| `name` | `name` | String, at most 20 characters, no emoji | Display name |
| `aff1` … `aff10` | `affirm_cont_1` … `affirm_cont_10` | String, 1,000 characters each | Ten personal practice statements |
| `q1` … `q10` | `video_cont_1` … `video_cont_10` | String, 1,000 characters each | Ten quotation/content slots; the historical `video_` name does not require video |
| `razbor_false_01` … `razbor_false_10` | Same names | String, 1,000 characters each | Stored previous-understanding text |
| `razbor_new_01` … `razbor_new_10` | Same names | String, 1,000 characters each | Stored new-understanding text |
| `q_morning` | `vopros_utro` | String, 1,000 characters | Morning question |
| `q_evening` | `vopros_vecher` | String, 1,000 characters | Evening question |
| `morning_algo` | `utro` | String, 1,000 characters | Morning procedure text |
| `evening_algo` | `vecher` | String, 1,000 characters | Evening procedure text |
| `gpt_standard` | `standard` | String, 1,000 characters | User's reference/standard text |
| `gpt_format` | `format` | String, 1,000 characters | Requested response format |
| `gpt_zapros` | `zapros` | String, 1,000 characters | Current request |
| `gpt_motiv` | `motiv` | String, 1,000 characters | Motivation context |
| `gpt_situation` | `situation` | String, 1,000 characters | Current focus text; mirrors `link_main` inside the application |
| `gpt_grabli` | `grabli` | String, 1,000 characters | Repeating difficulties as entered by the user |
| `gpt_talants` | `talants` | String, 1,000 characters | Strengths context |
| `gpt_quotes` | `quotes` | String, 1,000 characters | Selected quotation context |
| `gpt_affirmation` | `affirmation` | String, 1,000 characters | Selected practice statement context |
| `gpt_mycontext` | `mycontext` | String, 1,000 characters | Additional user context |
| `affirm` | `affirm` | String, 1,000 characters | Current daily statement |
| `video` | `video` | String, 1,000 characters | Current daily content |
| `msg_count` | `msg_count` | Integer 0–9,999 | Message counter value; this repository does not define the bot's increment/reset rules |
| `sprint_task` | `sprint_task` | String, 1,000 characters | Current task text |

Database-only fields are `tz` (supported IANA timezone), `quote_pack` (`base` or `pro`), `link_main` and `link_add` (up to 1,000 characters each), `published_link_id` (UUID), and `published_link_progress` (integer 0–999,999). Do not create those as synchronization targets. `link_main` reaches SendPulse through the mirrored `situation` variable. Changing the focus text resets the application's focus progress. Initial generic content is stored in the application database; first login does not automatically push it to SendPulse. Remote changes require an explicit save or apply action.

The `razbor_*` groups each hold at most 10,000 characters split into ten slots. Appending beyond that capacity retains the latest tail; these fields are not a lossless history archive. Analysis sessions have their own database history.

**Time handling:** configure the SendPulse schedule in `BOT_TIMEZONE`. Outgoing conversion uses the current date for daylight-saving offsets; the first import has no saved user timezone, so its `HH:MM` strings need review. Subsequent state reads convert bot times back to the saved user timezone. Check imported times in the application, save them with the correct user timezone, and retest reminders across a daylight-saving transition. Saving time variables does not create a scheduler or a recurring SendPulse flow.

## 3. Configure incoming API requests

SendPulse's [API Request element](https://sendpulse.com/knowledge-base/chatbot/send-receive-data) supports a URL, headers, body, and response mapping. Availability depends on your account plan. Select `POST`, JSON, and the endpoint on **your** application. Use one of the two authentication families below; they are intentionally different.

| Endpoint | Header | Required body | Application effect |
| --- | --- | --- | --- |
| `/api/diary` | `X-SP-Signature: <SENDPULSE_DIARY_SECRET>` | `sp_contact_id`, `diary_text` | Saves diary entry; queues a link signal; success also creates a success record |
| `/api/razbor-session-ingest` | `X-LK-Service-Secret: <LK_SERVICE_SECRET>` | `sp_contact_id`, `summary_text` | Saves a completed analysis-session record |
| `/api/crm-activity-ingest` | Same service header | `sp_contact_id`, `source_ref_id` | Saves a CRM event; `text` additionally queues a link signal |
| `/api/link-signals-ingest` | Same service header | `sp_contact_id`, `source_ref_id`, `text` | Queues a signal for later analysis/review |

All four accept `Authorization: Bearer <corresponding secret>` as an alternative. `X-SP-Signature` carries a **shared secret**, not a body HMAC signature. Also send `Content-Type: application/json`. The last two endpoints alternatively accept an authenticated browser session; bot requests should use the service header and explicit contact ID.

### Diary event

Copy [diary.json](examples/diary.json), replace its fictional contact with your sandbox subscriber's contact, and bind `diary_text` to the actual captured text. `source` defaults to `sendpulse_voice`; supported values are:

- `sendpulse_voice`: ordinary diary/transcribed message;
- `sendpulse_success`: success; also saved in the success table;
- `sendpulse_new`: newly noticed experience;
- `sendpulse_idea`: idea.

Example response shape: `{"ok":true,"id":"<entry UUID>","user_id":"<user UUID>","local_date":"<YYYY-MM-DD>","created_at":"<timestamp>"}`. The entry's date is calculated at receipt using the user's timezone. An event timestamp in your bot does not override it. If a focus text exists, success/new/idea also increment its current progress counter; an ordinary diary does not. This counter is a product event count, not independent evidence of a psychological outcome.

### Completed analysis session

Copy [razbor-session.json](examples/razbor-session.json). `summary_text` is trimmed and capped at 12,000 characters. Optional fields: `status` (default `completed`), `source` (default `sendpulse_ai_agent`), `occurred_at` (ISO timestamp; omitted means receipt time). Send `completed` only after your scenario has produced its finished summary. This endpoint stores the supplied text; it does not launch an AI conversation, populate `razbor_*` slots, or prove a consultation outcome. Response: `{"ok":true,"item":{...}}`.

### CRM event

Copy [crm-activity.json](examples/crm-activity.json). `event_type` is `evening_plus`, `task_done`, or `other` (default). `source_ref_id` is a nonempty reference generated by your flow. `value_text` is optional text; `value_number` is an optional finite number; `payload` is an optional JSON object; `occurred_at` is an optional valid ISO timestamp. `text`, when nonempty, creates a queued `crm_evening` signal. Response: `{"ok":true,"item":{...},"signal":...}`.

### Standalone signal

Copy [link-signal.json](examples/link-signal.json). `source_type` is `diary_entry`, `crm_evening`, `crm_reaction`, or `manual` (default); `source_created_at` is an optional valid ISO timestamp. Response: `{"ok":true,"item":{...}}`. Do not additionally call this endpoint for a diary already sent to `/api/diary`: that path queues its own signal.

### Responses, retries, and visibility

Treat `200` with `ok:true` as stored. `400` means invalid body; `401` means wrong secret; `403 contact_binding_failed` at login means identity/contact binding failed; `409 contact_binding_changed` means an existing account would be rebound; `404` on ingestion commonly means the subscriber has not completed application login; `429` is a service rate limit; `500` requires checking deployment configuration/logs. Show a retry message instead of telling the subscriber an unsuccessful request was saved.

These ingestion routes do **not** promise idempotent delivery: `source_ref_id` is a source reference, not a universal deduplication key. A timeout may occur after a write. Avoid blind automatic resends; first inspect the application for the test event, then decide whether to resend. There is no bot-flow reconciliation dashboard in this release.

## 4. Reconstruct the minimum flows manually

Build and test these as separate flows. The following is a **new minimal configuration recipe**, not a recovered copy of a private bot.

| Flow | Builder sequence | Boundary |
| --- | --- | --- |
| Registration | `/start` → explain storage/external providers → initialize variables if missing → contact-aware application URL button → ask user to finish login | Do not overwrite established variables every time `/start` runs |
| Text diary | Menu/button → capture text → `/api/diary` API Request → success/error branch | Voice needs an additional speech-to-text integration you configure; raw audio URLs are not transcripts |
| Success / new / idea | Menu/button → capture text → same diary API with the matching `source` → success/error branch | Do not also submit the same text as a second diary or signal |
| Morning / evening | Your scheduled trigger → read the chosen question/procedure variables → message → optional captured response sent to diary API | Scheduler, holiday/quiet-hours rules, cycle increment, and rescheduling after edits must be implemented in SendPulse |
| AI analysis completion | Your approved AI scenario → explicit finished summary → `/api/razbor-session-ingest` → confirmation | Prompt, model, stopping rule, context assembly, and human handoff are operator-supplied; OpenAI app settings do not configure SendPulse's AI block |
| External task event (optional) | Trusted completion trigger → `/api/crm-activity-ingest` | A `task_done` record reflects the sender's assertion, not automatic proof |

For each API Request insert the system contact ID and captured text via the builder's variable picker. Test quotes, newlines, emoji, and a long response to confirm JSON escaping. Use the builder's JSON editor/mapping rather than string-concatenating user messages. Save the returned entry/session ID in a dedicated operator-created variable if you need it for troubleshooting; that variable is not part of the application's state map.

AI prompt variables are **data**, not executable instructions automatically consumed by this repository's bot. Decide which fields your own SendPulse AI scenario reads and document that decision. Do not invent a ten-day program from the presence of ten slots. No 22:00 “Evening Ten” rule, original training content, or original private coaching scenario is installed by this kit.

## 5. Acceptance walkthrough with fictional data

1. Use a fresh deployment/database and two test Telegram accounts you control. Connect the first through `/start`; confirm `/api/me` becomes authorized only after Telegram login.
2. Try the first contact's URL under the second account. It must fail identity binding. Then register the second account with its own contact link and verify the first account's entries are not visible.
3. Set timezone and reminder times in Личный кабинет. Save `sprint_task` as “Fictional test: one practice exercise.” Check the corresponding SendPulse variable and the application's reloaded state.
4. Submit the diary fixture with the first real test contact substituted. Verify exactly one diary and, for its `sendpulse_success` source, one success record. Check `local_date` against the user's timezone.
5. Submit the analysis-session fixture; verify it appears in analysis history. Submit the CRM and standalone signal fixtures with separate source references. Queued signals are not reviewed findings until explicitly processed and reviewed in the application.
6. Run the text diary flow end to end from Telegram. Test an invalid secret and an unregistered contact in a test flow; neither should produce a success message or a stored diary.
7. Schedule one test reminder a few minutes ahead. Confirm receipt time on the real device, then change the time in the application and verify your flow actually uses the updated variable. A successful variable write alone does not prove scheduled delivery.
8. Record your deployment version, date, tested features, provider settings, and failures in a **private** acceptance log. Until these checks pass, describe the deployment as configured, not verified.

All [example payloads](examples/README.md) are fictional. Their contact placeholders deliberately do not refer to a working account.
