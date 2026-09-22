import { basename } from 'node:path';

function requireConsultationId(flags, commandName) {
  if (!flags.id) {
    throw new Error(`${commandName} requires --id <consultationId>`);
  }
}

function requireTranscript(flags) {
  if (!flags.transcript) {
    throw new Error('consultation summarize start requires --transcript <file>');
  }

  if (!flags.email) {
    throw new Error('consultation summarize start requires --email <address>');
  }
}

export function createConsultationCommands({
  requestJson,
  requestMultipart,
  readBinaryFile,
}) {
  return {
    summarizeStart: {
      command: 'consultation summarize start',
      mutating: true,
      async run({ flags }) {
        requireTranscript(flags);

        const summaryType = String(flags.summaryType || 'one_on_one');
        const start = await requestJson({
          path: '/api/summarize-start',
          method: 'POST',
          json: { summary_type: summaryType },
        });

        const transcriptBuffer = await readBinaryFile(String(flags.transcript));
        const formData = new FormData();
        formData.set('consultationId', start.id);
        formData.set('summaryType', summaryType);
        formData.set('email', String(flags.email));
        formData.set(
          'transcript',
          new Blob([transcriptBuffer], { type: 'text/plain' }),
          basename(String(flags.transcript))
        );

        if (flags.notes) {
          const notesBuffer = await readBinaryFile(String(flags.notes));
          formData.set(
            'notes',
            new Blob([notesBuffer], { type: 'text/plain' }),
            basename(String(flags.notes))
          );
        }

        await requestMultipart({
          path: `/api/summarize-background?id=${encodeURIComponent(start.id)}`,
          method: 'POST',
          formData,
        });

        return start;
      },
    },
    summarizeStatus: {
      command: 'consultation summarize status',
      mutating: false,
      async run({ flags }) {
        const query = flags.id ? `?id=${encodeURIComponent(String(flags.id))}` : '';
        return requestJson({ path: `/api/summarize-status${query}` });
      },
    },
    apply: {
      command: 'consultation apply',
      mutating: false,
      async run({ flags, assertWrite }) {
        requireConsultationId(flags, 'consultation apply');

        if (!flags.preview) {
          assertWrite('consultation apply');
        }

        const selectedFields = flags.fields
          ? String(flags.fields).split(',').map((item) => item.trim()).filter(Boolean)
          : null;

        return requestJson({
          path: '/api/summarize-apply',
          method: 'POST',
          json: {
            consultation_id: String(flags.id),
            preview: Boolean(flags.preview),
            selected_fields: selectedFields,
          },
        });
      },
    },
  };
}
