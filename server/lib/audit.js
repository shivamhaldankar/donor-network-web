'use strict';
// lib/audit.js
// Writes a row to audit_log for actions that don't have a database trigger.
//
// Which actions use DB triggers vs this function?
//   DB triggers (automatic, in 20_audit_notifications.sql):
//     - REQUEST_CREATED / REQUEST_STATUS_CHANGED  (on requests table)
//     - DONATION_LOGGED                           (on donations table)
//     - HOSPITAL_VERIFIED / HOSPITAL_UNVERIFIED   (on hospitals table)
//     - ORGAN_MATCH_CONFIRMED                     (on organ_match_log table)
//
//   This function (called explicitly from route handlers):
//     - USER_DEACTIVATED / USER_ACTIVATED         (PATCH /admin/users/:role/:id/active)
//     - ELIGIBILITY_RESTORE_JOB                   (POST /admin/jobs/restore-eligibility)
//
// Signature matches contract §4 exactly:
//   audit({ actorRole, actorId, action, entity, entityId }) → Promise<void>

const pool = require('../config/db');

/**
 * Write one row to audit_log.
 *
 * @param {object} opts
 * @param {'DONOR'|'STAFF'|'ADMIN'|'SYSTEM'} opts.actorRole - Who performed the action.
 * @param {number|null}  opts.actorId   - The actor's primary key (null for SYSTEM).
 * @param {string}       opts.action    - Short action name e.g. 'USER_DEACTIVATED'.
 * @param {string|null}  opts.entity    - Table name e.g. 'donors' (optional).
 * @param {number|null}  opts.entityId  - The affected row's PK (optional).
 * @returns {Promise<void>}
 */
const audit = async ({ actorRole, actorId = null, action, entity = null, entityId = null }) => {
  await pool.query(
    `INSERT INTO audit_log (actor_role, actor_id, action, entity, entity_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorRole, actorId, action, entity, entityId]
  );
};

module.exports = { audit };
