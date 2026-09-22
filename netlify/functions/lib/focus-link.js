import { query } from './db.js';
import {
  getFirstAvailableSlot,
  LINK_ACTIVE_LIMIT,
  normalizeLinkPayload,
  serializeLinkForVariable,
} from './phase4.js';

const LINK_TEXT_PATTERN = /^СТИМУЛ:\s*([\s\S]*?)\s+РЕАКЦИЯ:\s*([\s\S]*?)\s+СТАРОЕ ПОНИМАНИЕ:\s*([\s\S]*?)\s+НОВОЕ ПОНИМАНИЕ:\s*([\s\S]*?)\s+НОВЫЕ ДЕЙСТВИЯ:\s*([\s\S]*)$/i;

function normalizeProgressValue(value) {
  const progress = Number(value);
  return Number.isFinite(progress) && progress >= 0 ? Math.floor(progress) : 0;
}

function getFocusLinkText(state) {
  return String(state?.gpt_situation ?? state?.link_main ?? '').trim();
}

export function parseSerializedLinkText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const match = raw.match(LINK_TEXT_PATTERN);
  if (!match) {
    const error = new Error(
      'Связка в фокусе должна быть в формате: СТИМУЛ / РЕАКЦИЯ / СТАРОЕ ПОНИМАНИЕ / НОВОЕ ПОНИМАНИЕ / НОВЫЕ ДЕЙСТВИЯ.'
    );
    error.status = 422;
    throw error;
  }

  const [, stimulus, reaction, oldBelief, newBelief, newActions] = match;
  const normalized = normalizeLinkPayload({
    stimulus,
    reaction,
    old_belief: oldBelief,
    new_belief: newBelief,
    new_actions: newActions,
    status: 'active',
  });

  if (!normalized.valid) {
    const error = new Error('Связка в фокусе заполнена не полностью.');
    error.status = 422;
    error.data = { errors: normalized.errors };
    throw error;
  }

  return normalized.data;
}

async function getUserLinks(userId) {
  return query(
    `SELECT id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
            source_consultation_id, created_at, updated_at
     FROM links_registry
     WHERE user_id = $1
     ORDER BY
       CASE WHEN status = 'active' THEN 0 ELSE 1 END,
       slot_no ASC NULLS LAST,
       updated_at DESC`,
    [userId]
  );
}

export async function ensureFocusLinkRegistryEntry({
  userId,
  currentState,
  nextState,
}) {
  const desiredText = getFocusLinkText(nextState);
  if (!desiredText) {
    return {
      stateChanges: {
        published_link_id: null,
        published_link_progress: 0,
      },
      focusLink: null,
    };
  }

  const desiredPayload = parseSerializedLinkText(desiredText);
  const allLinks = await getUserLinks(userId);
  const currentPublishedId = String(
    nextState?.published_link_id || currentState?.published_link_id || ''
  ).trim();
  const currentPublishedRow = currentPublishedId
    ? allLinks.find((item) => String(item.id) === currentPublishedId) || null
    : null;
  const exactMatchRow = currentPublishedRow
    || allLinks.find((item) => serializeLinkForVariable(item) === desiredText)
    || null;

  const targetRow = currentPublishedRow || exactMatchRow;
  const progressSource = Object.prototype.hasOwnProperty.call(nextState || {}, 'published_link_progress')
    ? nextState?.published_link_progress
    : currentState?.published_link_progress;
  const currentProgress = normalizeProgressValue(progressSource);

  if (targetRow) {
    const wasActive = targetRow.status === 'active';
    const activeLinks = allLinks.filter(
      (item) => item.status === 'active' && String(item.id) !== String(targetRow.id)
    );
    let slotNo = targetRow.slot_no;

    if (!wasActive && !slotNo) {
      if (activeLinks.length >= LINK_ACTIVE_LIMIT) {
        const error = new Error(`Максимум ${LINK_ACTIVE_LIMIT} рабочих связок`);
        error.status = 409;
        throw error;
      }
      slotNo = getFirstAvailableSlot(activeLinks);
    }

    const previousText = serializeLinkForVariable(targetRow);
    const textChanged = previousText !== desiredText;
    if (textChanged || !wasActive || slotNo !== targetRow.slot_no) {
      await query(
        `UPDATE links_registry
         SET status = 'active',
             slot_no = $3,
             stimulus = $4,
             reaction = $5,
             old_belief = $6,
             new_belief = $7,
             new_actions = $8,
             updated_at = now()
         WHERE id = $1
           AND user_id = $2`,
        [
          targetRow.id,
          userId,
          slotNo,
          desiredPayload.stimulus,
          desiredPayload.reaction,
          desiredPayload.old_belief,
          desiredPayload.new_belief,
          desiredPayload.new_actions,
        ]
      );
    }

    const shouldResetProgress =
      String(currentState?.published_link_id || '') !== String(targetRow.id)
      || textChanged
      || !wasActive;

    return {
      stateChanges: {
        published_link_id: targetRow.id,
        published_link_progress: shouldResetProgress ? 0 : currentProgress,
      },
      focusLink: {
        ...targetRow,
        status: 'active',
        slot_no: slotNo,
        ...desiredPayload,
      },
    };
  }

  const activeLinks = allLinks.filter((item) => item.status === 'active');
  if (activeLinks.length >= LINK_ACTIVE_LIMIT) {
    const error = new Error(`Максимум ${LINK_ACTIVE_LIMIT} рабочих связок`);
    error.status = 409;
    throw error;
  }

  const slotNo = getFirstAvailableSlot(activeLinks);
  const insertedRows = await query(
    `INSERT INTO links_registry (
       user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions, source_consultation_id
     ) VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, NULL)
     RETURNING id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
               source_consultation_id, created_at, updated_at`,
    [
      userId,
      slotNo,
      desiredPayload.stimulus,
      desiredPayload.reaction,
      desiredPayload.old_belief,
      desiredPayload.new_belief,
      desiredPayload.new_actions,
    ]
  );

  return {
    stateChanges: {
      published_link_id: insertedRows[0].id,
      published_link_progress: 0,
    },
    focusLink: insertedRows[0],
  };
}
