-- ============================================================
-- PULSE — Owner B database objects
-- File: database/20_audit_notifications.sql
-- Run order: after 01_schema.sql, 02_seed.sql
--
-- Objects created here:
--   1. trg_after_match          — queues notifications when a donor is matched
--   2. trg_audit_requests       — audit log for request INSERT and status changes
--   3. trg_audit_donations      — audit log for donation inserts
--   4. trg_audit_hospitals      — audit log for hospital verified-flag changes
--   5. trg_audit_organ_match    — audit log when an organ match is confirmed
--
-- Design principle: business logic lives in the database so every client
-- (API server, pgAdmin, psql) gets the same behaviour automatically.
-- ============================================================

-- ============================================================
-- 1. trg_after_match
--    AFTER INSERT on match_log
--    Purpose: when find_matching_donors() (Member A) inserts a row into match_log,
--    this trigger queues one notifications row per channel the donor has enabled.
--    Privacy rule: the patient's name is NEVER included in the message.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_after_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_donor       donors%ROWTYPE;
  v_hospital    hospitals%ROWTYPE;
  v_blood_type  blood_type_t;
  v_distance    TEXT;
  v_subject     TEXT;
  v_message     TEXT;
BEGIN
  -- Fetch the matched donor's preferences and contact info.
  SELECT * INTO v_donor FROM donors WHERE donor_id = NEW.donor_id;

  -- Fetch the requesting hospital's name and city (from the request).
  SELECT h.* INTO v_hospital
  FROM hospitals h
  JOIN requests r ON r.hospital_id = h.hospital_id
  WHERE r.request_id = NEW.request_id;

  -- Fetch the blood type needed (from the request).
  SELECT blood_type_needed INTO v_blood_type
  FROM requests WHERE request_id = NEW.request_id;

  -- Build the distance string shown in the message.
  -- NULL distance_km means coordinates were unavailable — fall back to city name.
  IF NEW.distance_km IS NOT NULL THEN
    v_distance := 'approximately ' || NEW.distance_km || ' km from you';
  ELSE
    v_distance := 'in your city';
  END IF;

  -- Subject line — same for both channels.
  v_subject := 'Urgent: ' || v_blood_type || ' blood needed near you';

  -- Message body — no patient name (privacy rule in contract §3 and §6).
  v_message := v_hospital.name || ' in ' || v_hospital.city ||
               ' needs ' || v_blood_type || ' blood (' || v_distance || '). ' ||
               'Please sign in to Pulse to accept or decline this match.';

  -- Queue EMAIL notification if the donor has email notifications enabled.
  IF v_donor.notify_email THEN
    INSERT INTO notifications
      (donor_id, request_id, type, channel, subject, message)
    VALUES
      (NEW.donor_id, NEW.request_id, 'MATCH', 'EMAIL', v_subject, v_message);
  END IF;

  -- Queue SMS notification if the donor has SMS notifications enabled AND has a phone.
  -- We guard on phone IS NOT NULL because SMS to a blank number would fail in the worker.
  IF v_donor.notify_sms AND v_donor.phone IS NOT NULL THEN
    INSERT INTO notifications
      (donor_id, request_id, type, channel, subject, message)
    VALUES
      (NEW.donor_id, NEW.request_id, 'MATCH', 'SMS', v_subject, v_message);
  END IF;

  RETURN NEW; -- AFTER trigger; return value is ignored but must not be NULL for safety
END;
$$;

-- Drop and recreate the trigger so this file is safe to re-run.
DROP TRIGGER IF EXISTS trg_after_match ON match_log;

CREATE TRIGGER trg_after_match
  AFTER INSERT ON match_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_after_match();


-- ============================================================
-- 2. trg_audit_requests
--    AFTER INSERT OR UPDATE on requests
--    Purpose: write an audit row whenever a request is created
--    or its status field changes.
--    Actor = STAFF (staff_id comes from the requests row itself).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A new request was created by a staff member.
    INSERT INTO audit_log (actor_role, actor_id, action, entity, entity_id)
    VALUES ('STAFF', NEW.staff_id, 'REQUEST_CREATED', 'requests', NEW.request_id);

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- The status field changed (OPEN → MATCHED, MATCHED → FULFILLED, etc.).
    -- TG_OP = 'UPDATE' fires for any UPDATE, so we check the column explicitly.
    INSERT INTO audit_log (actor_role, actor_id, action, entity, entity_id)
    VALUES ('STAFF', NEW.staff_id, 'REQUEST_STATUS_CHANGED', 'requests', NEW.request_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_requests ON requests;

CREATE TRIGGER trg_audit_requests
  AFTER INSERT OR UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_requests();


-- ============================================================
-- 3. trg_audit_donations
--    AFTER INSERT on donations
--    Purpose: write DONATION_LOGGED to the audit trail automatically.
--    Actor = SYSTEM because the trigger fires inside the DB, not in a user's session.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_donations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_log (actor_role, actor_id, action, entity, entity_id)
  VALUES ('SYSTEM', NULL, 'DONATION_LOGGED', 'donations', NEW.donation_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_donations ON donations;

CREATE TRIGGER trg_audit_donations
  AFTER INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_donations();


-- ============================================================
-- 4. trg_audit_hospitals
--    AFTER UPDATE on hospitals
--    Purpose: write HOSPITAL_VERIFIED or HOSPITAL_UNVERIFIED when
--    an admin flips the verified flag.
--    Actor = SYSTEM (the PATCH /hospitals/:id/verify route does the UPDATE;
--    we log it here in the DB so even a direct psql update is audited).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_hospitals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only write an audit row when the verified column actually changed.
  IF OLD.verified IS DISTINCT FROM NEW.verified THEN
    INSERT INTO audit_log (actor_role, actor_id, action, entity, entity_id)
    VALUES (
      'SYSTEM',
      NULL,
      CASE WHEN NEW.verified THEN 'HOSPITAL_VERIFIED' ELSE 'HOSPITAL_UNVERIFIED' END,
      'hospitals',
      NEW.hospital_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_hospitals ON hospitals;

CREATE TRIGGER trg_audit_hospitals
  AFTER UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_hospitals();


-- ============================================================
-- 5. trg_audit_organ_match
--    AFTER UPDATE on organ_match_log
--    Purpose: write ORGAN_MATCH_CONFIRMED when a proposal is accepted.
--    Actor = SYSTEM (the confirm_organ_match() function does the UPDATE).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_organ_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fire only when the status column changes to 'ACCEPTED'.
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ACCEPTED' THEN
    INSERT INTO audit_log (actor_role, actor_id, action, entity, entity_id)
    VALUES ('SYSTEM', NULL, 'ORGAN_MATCH_CONFIRMED', 'organ_match_log', NEW.organ_match_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_organ_match ON organ_match_log;

CREATE TRIGGER trg_audit_organ_match
  AFTER UPDATE ON organ_match_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_organ_match();
