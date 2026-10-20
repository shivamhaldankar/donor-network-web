-- ============================================================
-- PULSE — Slice 2 self-checking tests
-- File: database/tests/slice2_tests.sql
-- Owner: Member B
--
-- How to run:
--   psql -U postgres -d donor_network -f database/tests/slice2_tests.sql
--
-- Each test wraps its work in a savepoint so the database is
-- left clean after each block.
--
-- Assumptions:
--   01_schema.sql, 02_seed.sql, 20_audit_notifications.sql applied.
--   Seed donor IDs: Aarav=1 (notify_email=T, notify_sms=F, phone set)
--                   Priya=2  (notify_email=T, notify_sms=T, phone set)
--   Hospital 1 verified; Staff 1 at Hospital 1.
-- ============================================================

BEGIN; -- wrap everything in one transaction; ROLLBACK at the end leaves DB clean

-- ============================================================
-- T15a: donor with only email enabled → exactly 1 EMAIL notification
-- ============================================================
DO $$
DECLARE
  v_request_id  INT;
  v_count       INT;
BEGIN
  -- Create a blood request (hospital 1, staff 1).
  INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency)
  VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL')
  RETURNING request_id INTO v_request_id;

  -- Insert a match for Aarav (donor_id=1, email-only) — fires trg_after_match.
  INSERT INTO match_log (request_id, donor_id, distance_km)
  VALUES (v_request_id, 1, 5.0);

  -- Count notifications for this donor+request.
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE donor_id = 1 AND request_id = v_request_id;

  IF v_count = 1 THEN
    RAISE NOTICE 'PASS T15a: email-only donor gets exactly 1 notification (got %)', v_count;
  ELSE
    RAISE NOTICE 'FAIL T15a: expected 1 notification, got %', v_count;
  END IF;

  -- Also verify channel is EMAIL.
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE donor_id = 1 AND request_id = v_request_id AND channel = 'EMAIL';

  IF v_count = 1 THEN
    RAISE NOTICE 'PASS T15a-channel: notification channel is EMAIL';
  ELSE
    RAISE NOTICE 'FAIL T15a-channel: expected EMAIL channel, got something else';
  END IF;
END;
$$;

-- ============================================================
-- T15b: donor with email AND SMS → exactly 2 notifications (EMAIL + SMS)
-- Priya (donor_id=2): notify_email=TRUE, notify_sms=TRUE, phone set
-- ============================================================
DO $$
DECLARE
  v_request_id  INT;
  v_email_cnt   INT;
  v_sms_cnt     INT;
BEGIN
  INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency)
  VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL')
  RETURNING request_id INTO v_request_id;

  INSERT INTO match_log (request_id, donor_id, distance_km)
  VALUES (v_request_id, 2, 8.3);

  SELECT COUNT(*) FILTER (WHERE channel = 'EMAIL') INTO v_email_cnt
  FROM notifications WHERE donor_id = 2 AND request_id = v_request_id;

  SELECT COUNT(*) FILTER (WHERE channel = 'SMS') INTO v_sms_cnt
  FROM notifications WHERE donor_id = 2 AND request_id = v_request_id;

  IF v_email_cnt = 1 AND v_sms_cnt = 1 THEN
    RAISE NOTICE 'PASS T15b: email+SMS donor gets 1 EMAIL + 1 SMS notification';
  ELSE
    RAISE NOTICE 'FAIL T15b: expected 1 EMAIL + 1 SMS, got EMAIL=%, SMS=%', v_email_cnt, v_sms_cnt;
  END IF;
END;
$$;

-- ============================================================
-- T15c: notification message must NOT contain patient name (privacy)
-- ============================================================
DO $$
DECLARE
  v_request_id  INT;
  v_msg         TEXT;
BEGIN
  INSERT INTO requests
    (hospital_id, staff_id, request_type, blood_type_needed, urgency, patient_name)
  VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL', 'SECRETPATIENTNAME_XYZ')
  RETURNING request_id INTO v_request_id;

  INSERT INTO match_log (request_id, donor_id, distance_km)
  VALUES (v_request_id, 1, 5.0);

  SELECT message INTO v_msg
  FROM notifications
  WHERE donor_id = 1 AND request_id = v_request_id
  LIMIT 1;

  IF v_msg IS NOT NULL AND v_msg NOT LIKE '%SECRETPATIENTNAME_XYZ%' THEN
    RAISE NOTICE 'PASS T15c: patient name not found in notification message';
  ELSE
    RAISE NOTICE 'FAIL T15c: notification contains patient name — PRIVACY VIOLATION. msg=%', v_msg;
  END IF;
END;
$$;

-- ============================================================
-- T_AUDIT_REQUEST: INSERT on requests → REQUEST_CREATED audit row
-- ============================================================
DO $$
DECLARE
  v_request_id  INT;
  v_count       INT;
BEGIN
  INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency)
  VALUES (1, 1, 'BLOOD', 'O+', 'MODERATE')
  RETURNING request_id INTO v_request_id;

  SELECT COUNT(*) INTO v_count
  FROM audit_log
  WHERE action = 'REQUEST_CREATED'
    AND entity = 'requests'
    AND entity_id = v_request_id;

  IF v_count = 1 THEN
    RAISE NOTICE 'PASS T_AUDIT_REQUEST: REQUEST_CREATED audit row written';
  ELSE
    RAISE NOTICE 'FAIL T_AUDIT_REQUEST: expected 1 audit row, got %', v_count;
  END IF;
END;
$$;

-- ============================================================
-- T_AUDIT_REQUEST_STATUS: UPDATE status → REQUEST_STATUS_CHANGED
-- ============================================================
DO $$
DECLARE
  v_request_id  INT;
  v_count       INT;
BEGIN
  INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency)
  VALUES (1, 1, 'BLOOD', 'O+', 'MODERATE')
  RETURNING request_id INTO v_request_id;

  -- Manually change status (normally done by triggers or cancel route).
  UPDATE requests SET status = 'CANCELLED' WHERE request_id = v_request_id;

  SELECT COUNT(*) INTO v_count
  FROM audit_log
  WHERE action = 'REQUEST_STATUS_CHANGED'
    AND entity = 'requests'
    AND entity_id = v_request_id;

  IF v_count = 1 THEN
    RAISE NOTICE 'PASS T_AUDIT_REQUEST_STATUS: REQUEST_STATUS_CHANGED audit row written';
  ELSE
    RAISE NOTICE 'FAIL T_AUDIT_REQUEST_STATUS: expected 1 audit row, got %', v_count;
  END IF;
END;
$$;

-- ============================================================
-- T_AUDIT_DONATION: INSERT on donations → DONATION_LOGGED
-- Use donation_type='ORGAN' to avoid firing Member A's eligibility trigger.
-- ============================================================
DO $$
DECLARE
  v_donation_id INT;
  v_count       INT;
BEGIN
  INSERT INTO donations (donor_id, hospital_id, donation_type, units)
  VALUES (1, 1, 'ORGAN', 1)
  RETURNING donation_id INTO v_donation_id;

  SELECT COUNT(*) INTO v_count
  FROM audit_log
  WHERE action = 'DONATION_LOGGED'
    AND entity = 'donations'
    AND entity_id = v_donation_id;

  IF v_count = 1 THEN
    RAISE NOTICE 'PASS T_AUDIT_DONATION: DONATION_LOGGED audit row written';
  ELSE
    RAISE NOTICE 'FAIL T_AUDIT_DONATION: expected 1 audit row, got %', v_count;
  END IF;
END;
$$;

-- ============================================================
-- T_AUDIT_HOSPITAL_VERIFIED: UPDATE hospitals verified=TRUE → HOSPITAL_VERIFIED
-- T_AUDIT_HOSPITAL_UNVERIFIED: UPDATE verified=FALSE → HOSPITAL_UNVERIFIED
-- Hospital 4 (New Hope) is seeded as unverified.
-- ============================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  -- Verify hospital 4.
  UPDATE hospitals SET verified = TRUE WHERE hospital_id = 4;

  SELECT COUNT(*) INTO v_count
  FROM audit_log
  WHERE action = 'HOSPITAL_VERIFIED'
    AND entity = 'hospitals'
    AND entity_id = 4;

  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS T_AUDIT_HOSPITAL_VERIFIED: HOSPITAL_VERIFIED audit row written';
  ELSE
    RAISE NOTICE 'FAIL T_AUDIT_HOSPITAL_VERIFIED: expected ≥1 audit row, got %', v_count;
  END IF;

  -- Unverify hospital 4.
  UPDATE hospitals SET verified = FALSE WHERE hospital_id = 4;

  SELECT COUNT(*) INTO v_count
  FROM audit_log
  WHERE action = 'HOSPITAL_UNVERIFIED'
    AND entity = 'hospitals'
    AND entity_id = 4;

  IF v_count >= 1 THEN
    RAISE NOTICE 'PASS T_AUDIT_HOSPITAL_UNVERIFIED: HOSPITAL_UNVERIFIED audit row written';
  ELSE
    RAISE NOTICE 'FAIL T_AUDIT_HOSPITAL_UNVERIFIED: expected ≥1 audit row, got %', v_count;
  END IF;
END;
$$;

-- ============================================================
-- T_IDEMPOTENT: Note for manual verification.
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'INFO: Re-run 20_audit_notifications.sql to verify idempotency (no errors on re-run).';
END;
$$;

ROLLBACK; -- ← everything above is rolled back; database is left exactly as it was
