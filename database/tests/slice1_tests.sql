-- ============================================================
-- PULSE — Slice 1 Database Tests (Owner: Member A)
-- Covers: T3, T4, T13, T14, T19, T20
--
-- Each test executes within an isolated transaction (BEGIN ... ROLLBACK)
-- to keep test runs fully idempotent and avoid altering seed data.
-- ============================================================

\echo '--- Running Slice 1 Database Tests ---'

-- ------------------------------------------------------------
-- Test T3: Critical blood request automatically matches nearby donors
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_req_id INT;
    v_status VARCHAR(15);
    v_count INT;
    v_matched_donors INT[];
BEGIN
    -- Insert a CRITICAL O+ request at Hospital 1 (Pune)
    INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency, radius_km, patient_name)
    VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL', 50, 'Patient T3')
    RETURNING request_id, status INTO v_req_id, v_status;

    -- Verify request status was updated to MATCHED by trg_critical_request
    SELECT status INTO v_status FROM requests WHERE request_id = v_req_id;
    IF v_status <> 'MATCHED' THEN
        RAISE EXCEPTION 'Expected status MATCHED, got %', v_status;
    END IF;

    -- Verify match_log contains expected donor IDs ordered by distance
    SELECT COUNT(*)::INT, array_agg(donor_id ORDER BY distance_km ASC NULLS LAST, donor_id ASC)
    INTO v_count, v_matched_donors
    FROM match_log
    WHERE request_id = v_req_id;

    IF v_count <> 3 THEN
        RAISE EXCEPTION 'Expected 3 matches, got %', v_count;
    END IF;

    -- Aarav (1), Priya (2), Rahul (9)
    IF v_matched_donors <> ARRAY[1, 2, 9] THEN
        RAISE EXCEPTION 'Expected matched donors [1, 2, 9], got %', v_matched_donors;
    END IF;

    RAISE NOTICE 'PASS T3: Critical blood request matched nearby eligible donors and status became MATCHED';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T3: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T4: Blood donation updates donor eligibility, sets date,
-- fulfills linked request, and rejects ineligible donors
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_req_id INT;
    v_req_status VARCHAR(15);
    v_donor_status CHAR(1);
    v_last_donation DATE;
    v_rejected BOOLEAN := FALSE;
BEGIN
    -- Create an open blood request
    INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency, radius_km, patient_name)
    VALUES (1, 1, 'BLOOD', 'O+', 'MODERATE', 50, 'Patient T4')
    RETURNING request_id INTO v_req_id;

    -- Log donation by eligible donor Aarav (donor_id 1)
    INSERT INTO donations (donor_id, request_id, hospital_id, donation_type, units, donated_on)
    VALUES (1, v_req_id, 1, 'BLOOD', 1, CURRENT_DATE);

    -- Verify Aarav's updated eligibility status and date
    SELECT eligible_status, last_donation_date
    INTO v_donor_status, v_last_donation
    FROM donors
    WHERE donor_id = 1;

    IF v_donor_status <> 'N' OR v_last_donation <> CURRENT_DATE THEN
        RAISE EXCEPTION 'Aarav status or date incorrect: status=%, date=%', v_donor_status, v_last_donation;
    END IF;

    -- Verify linked request was marked FULFILLED
    SELECT status INTO v_req_status FROM requests WHERE request_id = v_req_id;
    IF v_req_status <> 'FULFILLED' THEN
        RAISE EXCEPTION 'Expected request status FULFILLED, got %', v_req_status;
    END IF;

    -- Attempt donation by ineligible donor Neha (donor 6, donated 30 days ago)
    BEGIN
        INSERT INTO donations (donor_id, request_id, hospital_id, donation_type, units, donated_on)
        VALUES (6, NULL, 1, 'BLOOD', 1, CURRENT_DATE);
    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN
            IF SQLERRM LIKE 'DONOR_NOT_ELIGIBLE%' THEN
                v_rejected := TRUE;
            ELSE
                RAISE EXCEPTION 'Unexpected error message: %', SQLERRM;
            END IF;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Donation for ineligible donor was not rejected';
    END IF;

    RAISE NOTICE 'PASS T4: Blood donation sets donor ineligible, fulfills request, and rejects ineligible donor';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T4: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T13: Distance-based ranking and radius exclusion
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_req_50 INT;
    v_req_200 INT;
    v_donors_50 INT[];
    v_donors_200 INT[];
BEGIN
    -- 1. Radius 50 km from Hospital 1 (Pune)
    INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency, radius_km, patient_name)
    VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL', 50, 'Patient T13 50km')
    RETURNING request_id INTO v_req_50;

    SELECT array_agg(donor_id ORDER BY distance_km ASC NULLS LAST, donor_id ASC)
    INTO v_donors_50
    FROM match_log
    WHERE request_id = v_req_50;

    -- Radius 50 must match Aarav (0 km), Priya (~8 km), Rahul (NULL km)
    -- Excludes Vikram (Mumbai, ~123 km), Isha (Satara, ~95 km), and Neha (ineligible)
    IF v_donors_50 <> ARRAY[1, 2, 9] THEN
        RAISE EXCEPTION 'Radius 50 expected [1, 2, 9], got %', v_donors_50;
    END IF;

    -- 2. Radius 200 km from Hospital 1 (Pune)
    INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency, radius_km, patient_name)
    VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL', 200, 'Patient T13 200km')
    RETURNING request_id INTO v_req_200;

    SELECT array_agg(donor_id ORDER BY distance_km ASC NULLS LAST, donor_id ASC)
    INTO v_donors_200
    FROM match_log
    WHERE request_id = v_req_200;

    -- Radius 200 includes Aarav (0 km), Priya (~8 km), Isha (~95 km), Vikram (~123 km), Rahul (NULL km)
    IF v_donors_200 <> ARRAY[1, 2, 8, 5, 9] THEN
        RAISE EXCEPTION 'Radius 200 expected [1, 2, 8, 5, 9], got %', v_donors_200;
    END IF;

    RAISE NOTICE 'PASS T13: Distance ordering and radius filtering verified (50km excludes distant donors, 200km includes them in order)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T13: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T14: Donor with no coordinates falls back to same-city matching
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_req_id INT;
    v_dist NUMERIC(7,1);
    v_matched BOOLEAN := FALSE;
BEGIN
    -- Hospital 1 is in Pune
    INSERT INTO requests (hospital_id, staff_id, request_type, blood_type_needed, urgency, radius_km, patient_name)
    VALUES (1, 1, 'BLOOD', 'O+', 'CRITICAL', 50, 'Patient T14')
    RETURNING request_id INTO v_req_id;

    -- Rahul Joshi (donor 9) has NULL coordinates and city = 'Pune'
    SELECT TRUE, distance_km
    INTO v_matched, v_dist
    FROM match_log
    WHERE request_id = v_req_id AND donor_id = 9;

    IF v_matched IS NOT TRUE THEN
        RAISE EXCEPTION 'Donor 9 with NULL coordinates was not matched by city fallback';
    END IF;

    IF v_dist IS NOT NULL THEN
        RAISE EXCEPTION 'Expected distance_km to be NULL, got %', v_dist;
    END IF;

    RAISE NOTICE 'PASS T14: Donor with no coordinates matched by same city with distance_km = NULL';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T14: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T19: Donor eligibility countdown view (vw_donor_eligibility)
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_rec RECORD;
BEGIN
    -- Neha Kulkarni (donor 6) donated 30 days ago in seed data
    SELECT * INTO v_rec FROM vw_donor_eligibility WHERE donor_id = 6;

    IF v_rec.days_remaining <> 60 THEN
        RAISE EXCEPTION 'Expected days_remaining 60, got %', v_rec.days_remaining;
    END IF;

    IF v_rec.is_eligible IS NOT FALSE THEN
        RAISE EXCEPTION 'Expected is_eligible FALSE, got %', v_rec.is_eligible;
    END IF;

    IF v_rec.next_eligible_date <> (CURRENT_DATE + 60) THEN
        RAISE EXCEPTION 'Expected next_eligible_date %, got %', (CURRENT_DATE + 60), v_rec.next_eligible_date;
    END IF;

    RAISE NOTICE 'PASS T19: vw_donor_eligibility correctly returns days_remaining = 60 and is_eligible = false';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T19: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T20: Scheduled / manual eligibility restoration
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_restored INT;
    v_status CHAR(1);
    v_notif_count INT;
BEGIN
    -- Set donor 6 to 91 days past last donation and ineligible
    UPDATE donors
    SET last_donation_date = CURRENT_DATE - 91,
        eligible_status = 'N'
    WHERE donor_id = 6;

    DELETE FROM notifications WHERE donor_id = 6;

    -- Run restoration function
    v_restored := restore_donor_eligibility();

    IF v_restored < 1 THEN
        RAISE EXCEPTION 'Expected at least 1 donor restored, got %', v_restored;
    END IF;

    -- Verify donor 6 is marked eligible again
    SELECT eligible_status INTO v_status FROM donors WHERE donor_id = 6;
    IF v_status <> 'Y' THEN
        RAISE EXCEPTION 'Expected eligible_status Y, got %', v_status;
    END IF;

    -- Verify ELIGIBLE_AGAIN notification was queued
    SELECT COUNT(*)::INT INTO v_notif_count
    FROM notifications
    WHERE donor_id = 6
      AND type = 'ELIGIBLE_AGAIN'
      AND status = 'PENDING';

    IF v_notif_count < 1 THEN
        RAISE EXCEPTION 'Expected ELIGIBLE_AGAIN notification, found %', v_notif_count;
    END IF;

    RAISE NOTICE 'PASS T20: restore_donor_eligibility marks donor eligible and queues ELIGIBLE_AGAIN notification';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T20: %', SQLERRM;
END $$;
ROLLBACK;

\echo '--- All Slice 1 tests completed ---'
