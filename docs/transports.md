# Replacing the transport

[English](transports.md) · [Русский](transports.ru.md)

Application handlers call `netlify/functions/lib/transport.js`. Its factory selects an adapter with `CABINET_TRANSPORT`. SendPulse lives in `lib/transports/sendpulse.js`; the no-delivery implementation lives in `local.js`. The former `lib/sendpulse.js` is retained only for compatibility and always calls SendPulse; application handlers do not import it. New code should use `transport.js`.

| Member | Result and responsibility |
| --- | --- |
| `kind` | Stable transport name: `local` or `sendpulse` |
| `resolveContactForTelegram({ telegramUserId, requestedContactId })` | A verified contact with `id`, or `null`. Never trust a browser-supplied contact ID alone. SendPulse matches Telegram ID, contact ID and configured bot ID against the provider response. |
| `getContact(id)` | A contact or `null`; provider errors must not expose personal payloads. |
| `getContactVariables(id)` | A field map accepted by the existing state conversion layer. A new provider must adapt its fields to that same contract. |
| `setVariable(id, name, value)` | Update one field or explicitly report failure/no delivery. |
| `syncVariables(id, values)` | Update a field map and return `{ transport, delivered, reason? }`. For SendPulse, `delivered:true` means successful field-update API responses, not a read Telegram message. |

In `local` mode, the external contact uses the internal key `local:<telegram_id>`, external variables are an empty map, and delivery returns `delivered:false`, `reason:delivery_disabled`. The application owns state in its database. Telegram login, a server and a database are still required.

To add an adapter, implement the methods, add a factory branch and an allowed environment value, then add corresponding tests. Keep credentials server-side. Test two different accounts, provider downtime, partial send failure, repeated login and saving without delivery. User records belong to the application; the current database still uses compatibility names such as `sendpulse_contact_id`, and the variable conversion preserves the earlier field map. This does not automatically migrate accounts across providers.

Switching transport on a populated database does not automatically replace existing bindings. Login with a different binding returns `contact_binding_changed`; the operator must plan migration, keep a backup and verify record ownership separately. A direct Telegram bot is not included.

The SendPulse adapter bounds network waits, refreshes a token after 401 and retries 429 a limited number of times. Multiple variable updates are not atomic: some can succeed before a failure. A durable outbox, general retry mechanism and inbound event deduplication are not implemented. Do not blindly retry inbound webhook writes. [Flow setup and limits](sendpulse-setup.md).

[Home](../README.md)
