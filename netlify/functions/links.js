import { authenticateRequest, jsonResponse } from './lib/auth.js';
import { query } from './lib/db.js';
import { syncVariables } from './lib/transport.js';
import { getCurrentState, mergeCurrentState, upsertTodayVersion } from './lib/state.js';
import {
  getFirstAvailableSlot,
  LINK_ACTIVE_LIMIT,
  mapLinkRow,
  normalizeLinkPayload,
  serializeLinkForVariable,
} from './lib/phase4.js';
import { toSendPulse } from './lib/variables.js';

const LINK_CONTENT_FIELDS = ['stimulus', 'reaction', 'old_belief', 'new_belief', 'new_actions'];

async function getActiveLinks(userId) {
  return query(
    `SELECT id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
            source_consultation_id, created_at, updated_at
     FROM links_registry
     WHERE user_id = $1
       AND status = 'active'
     ORDER BY slot_no ASC NULLS LAST, updated_at DESC`,
    [userId]
  );
}

function hasLinkContentChanged(previousRow, nextRow) {
  return LINK_CONTENT_FIELDS.some(
    (field) => String(previousRow?.[field] || '') !== String(nextRow?.[field] || '')
  );
}

async function resetPublishedProgress(userId) {
  const currentState = await getCurrentState(userId);
  const currentProgress = Number(currentState?.published_link_progress || 0);
  if (!Number.isFinite(currentProgress) || currentProgress !== 0) {
    await mergeCurrentState(userId, { published_link_progress: 0 });
  }
}

export const handler = async (event) => {
  const user = await authenticateRequest(event);
  if (!user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  if (event.httpMethod === 'GET') {
    try {
      const rows = await query(
        `SELECT id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
                source_consultation_id, created_at, updated_at
         FROM links_registry
         WHERE user_id = $1
         ORDER BY
           CASE WHEN status = 'active' THEN 0 ELSE 1 END,
           slot_no ASC NULLS LAST,
           updated_at DESC`,
        [user.user_id]
      );

      const items = rows.map(mapLinkRow);
      return jsonResponse(200, {
        active_items: items.filter((item) => item.status === 'active'),
        inactive_items: items.filter((item) => item.status !== 'active'),
        active_count: items.filter((item) => item.status === 'active').length,
      });
    } catch (error) {
      console.error('links list error:', error);
      return jsonResponse(500, { error: 'Не удалось загрузить связки' });
    }
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const normalized = normalizeLinkPayload(body, { allowPartial: false });
    if (!normalized.valid) {
      return jsonResponse(422, { error: 'Validation failed', errors: normalized.errors });
    }

    const requestedStatus = normalized.data.status || 'active';

    try {
      const activeLinks = await getActiveLinks(user.user_id);
      let slotNo = normalized.data.slot_no ?? null;
      if (requestedStatus === 'active') {
        if (activeLinks.length >= LINK_ACTIVE_LIMIT) {
          return jsonResponse(409, { error: `Максимум ${LINK_ACTIVE_LIMIT} активных связок` });
        }
        if (slotNo === null) {
          slotNo = getFirstAvailableSlot(activeLinks);
        }
      } else {
        slotNo = null;
      }

      const rows = await query(
        `INSERT INTO links_registry (
           user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions, source_consultation_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
                   source_consultation_id, created_at, updated_at`,
        [
          user.user_id,
          requestedStatus,
          slotNo,
          normalized.data.stimulus,
          normalized.data.reaction,
          normalized.data.old_belief,
          normalized.data.new_belief,
          normalized.data.new_actions,
          normalized.data.source_consultation_id || null,
        ]
      );

      if (requestedStatus === 'active') {
        await resetPublishedProgress(user.user_id);
      }

      return jsonResponse(200, {
        ok: true,
        item: mapLinkRow(rows[0]),
      });
    } catch (error) {
      console.error('links create error:', error);
      if (String(error?.message || '').includes('uq_links_registry_active_slot')) {
        return jsonResponse(409, { error: 'Этот слот уже занят другой активной связкой' });
      }
      return jsonResponse(500, { error: 'Не удалось создать связку' });
    }
  }

  if (event.httpMethod === 'PATCH') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const id = String(body.id || '').trim();
    if (!id) {
      return jsonResponse(400, { error: 'id required' });
    }

    const normalized = normalizeLinkPayload(body, { allowPartial: true });
    if (!normalized.valid) {
      return jsonResponse(422, { error: 'Validation failed', errors: normalized.errors });
    }

    try {
      const currentState = await getCurrentState(user.user_id);
      const existingRows = await query(
        `SELECT id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
                source_consultation_id, created_at, updated_at
         FROM links_registry
         WHERE id = $1
           AND user_id = $2`,
        [id, user.user_id]
      );

      if (existingRows.length === 0) {
        return jsonResponse(404, { error: 'Связка не найдена' });
      }

      const existing = existingRows[0];
      const merged = { ...existing, ...normalized.data };
      const activeLinks = (await getActiveLinks(user.user_id)).filter((item) => item.id !== id);

      if (merged.status === 'active') {
        if (activeLinks.length >= LINK_ACTIVE_LIMIT) {
          return jsonResponse(409, { error: `Максимум ${LINK_ACTIVE_LIMIT} активных связок` });
        }
        if (merged.slot_no === null || merged.slot_no === undefined) {
          merged.slot_no = getFirstAvailableSlot(activeLinks);
        }
      } else {
        merged.slot_no = null;
      }

      const rows = await query(
        `UPDATE links_registry
         SET status = $3,
             slot_no = $4,
             stimulus = $5,
             reaction = $6,
             old_belief = $7,
             new_belief = $8,
             new_actions = $9,
             source_consultation_id = $10,
             updated_at = now()
         WHERE id = $1
           AND user_id = $2
         RETURNING id, user_id, status, slot_no, stimulus, reaction, old_belief, new_belief, new_actions,
                   source_consultation_id, created_at, updated_at`,
        [
          id,
          user.user_id,
          merged.status || 'active',
          merged.slot_no ?? null,
          merged.stimulus,
          merged.reaction,
          merged.old_belief,
          merged.new_belief,
          merged.new_actions,
          merged.source_consultation_id || null,
        ]
      );

      const updatedLink = rows[0];
      const publishedLinkId = String(currentState?.published_link_id || '').trim();
      const isPublishedLink = publishedLinkId === id;
      const contentChanged = hasLinkContentChanged(existing, updatedLink);
      const activatedLink = existing.status !== 'active' && updatedLink.status === 'active';

      if (isPublishedLink && contentChanged) {
        const linkText = serializeLinkForVariable(updatedLink);
        const stateChanges = {
          link_main: linkText,
          gpt_situation: linkText,
          published_link_id: updatedLink.status === 'active' ? id : null,
          published_link_progress: 0,
        };
        const spVars = toSendPulse(
          stateChanges,
          currentState?.tz || null,
          new Set(Object.keys(stateChanges))
        );
        await syncVariables(user.sendpulse_contact_id, spVars);
        const fullState = await mergeCurrentState(user.user_id, stateChanges);
        await upsertTodayVersion(user.user_id, fullState);
      } else if (isPublishedLink && updatedLink.status !== 'active') {
        await mergeCurrentState(user.user_id, {
          published_link_id: null,
          published_link_progress: 0,
        });
      } else if (activatedLink) {
        await resetPublishedProgress(user.user_id);
      }

      return jsonResponse(200, {
        ok: true,
        item: mapLinkRow(updatedLink),
      });
    } catch (error) {
      console.error('links update error:', error);
      if (String(error?.message || '').includes('uq_links_registry_active_slot')) {
        return jsonResponse(409, { error: 'Этот слот уже занят другой активной связкой' });
      }
      return jsonResponse(500, { error: 'Не удалось сохранить связку' });
    }
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
