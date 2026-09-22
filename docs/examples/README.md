[English](README.md) · [Русский](README.ru.md) · [Installation](../operator-install.md) · [SendPulse setup](../sendpulse-setup.md)

# Fictional installation fixtures

All texts, identifiers, and dates here were written for testing. No real person, consultation, contact, or private dataset is represented. The raw source language is English; the same fixtures serve both language versions of the documentation.

| File | Use |
| --- | --- |
| [diary.json](diary.json) | `POST /api/diary`; creates a fictional success diary |
| [razbor-session.json](razbor-session.json) | `POST /api/razbor-session-ingest`; stores a fictional completed-session text |
| [crm-activity.json](crm-activity.json) | `POST /api/crm-activity-ingest`; records a fictional task event and queues its text as a signal |
| [link-signal.json](link-signal.json) | `POST /api/link-signals-ingest`; queues a separate fictional signal |
| [transcript.txt](transcript.txt) | Small UTF-8 consultation-summary upload |

Before sending a JSON fixture to your own test deployment, replace `sp_contact_id` with a contact belonging to a test account you control that has already completed application login. Use the correct header from the setup kit. These fixtures contain no credentials and are not ready-to-send production requests. For period reports, replace the fictional event dates with dates in your test range; diary dates are assigned at receipt time. No request is executed by opening this folder.
