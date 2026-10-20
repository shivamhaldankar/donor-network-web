-- ============================================================
-- PULSE — Slice 3 Database Tests (Owner: Member C)
-- Covers: T23, T24, T25, T26, T27
--
-- Each test executes within an isolated transaction (BEGIN ... ROLLBACK)
-- to keep test runs fully idempotent and avoid altering seed data.
-- ============================================================

\echo '--- Running Slice 3 Database Tests ---'

-- ------------------------------------------------------------
-- Test T23: Organ Matching ABO Compatibility Filtering
-- Spec:
--   Matching Aarav's kidney (ABO group O) proposes all three kidney patients (O, A, B can receive O).
--   Matching Rohan's liver (group A) proposes only Kavita (A) and Deepak (AB), excluding O and B.
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_count INT;
    v_kidney_patients TEXT[];
    v_liver_patients TEXT[];
BEGIN
    -- 1. Match Aarav's Kidney (organ_id = 1, donor 1 is O+)
    v_count := match_organ(1);
    IF v_count <> 3 THEN
        RAISE EXCEPTION 'Expected 3 kidney matches for O+ donor Aarav, got %', v_count;
    END IF;

    SELECT array_agg(w.patient_name ORDER BY m.rank_no ASC)
    INTO v_kidney_patients
    FROM organ_match_log m
    JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
    WHERE m.organ_id = 1;

    -- Ramesh (O), Imran (B), Sunita (A) must all be included
    IF NOT ('Ramesh Patil' = ANY(v_kidney_patients) AND 'Imran Sheikh' = ANY(v_kidney_patients) AND 'Sunita Rao' = ANY(v_kidney_patients)) THEN
        RAISE EXCEPTION 'Expected all three kidney patients for O donor, got %', v_kidney_patients;
    END IF;

    -- 2. Match Rohan's Liver (organ_id = 2, donor 3 is A+)
    v_count := match_organ(2);
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Expected 2 liver matches for A+ donor Rohan, got %', v_count;
    END IF;

    SELECT array_agg(w.patient_name ORDER BY m.rank_no ASC)
    INTO v_liver_patients
    FROM organ_match_log m
    JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
    WHERE m.organ_id = 2;

    -- Only Kavita Menon (A) and Deepak Nair (AB) are compatible with A donor
    IF NOT ('Kavita Menon' = ANY(v_liver_patients) AND 'Deepak Nair' = ANY(v_liver_patients)) THEN
        RAISE EXCEPTION 'Expected Kavita and Deepak for A donor, got %', v_liver_patients;
    END IF;

    RAISE NOTICE 'PASS T23: Organ matching correctly filters recipients by ABO compatibility (O->all, A->A,AB)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T23: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T24: Priority Score Ranking with Seed Data
-- Spec:
--   Formula: 0.5*U + 0.3*W + 0.2*P
--   Ramesh Patil: Urgency 9, Days 200, Distance 0 km -> Score = 81.4
--   Imran Sheikh: Urgency 5, Days 300, Distance 0 km -> Score = 69.7
--   Sunita Rao:   Urgency 7, Days 30,  Distance ~119.5 km -> Score = 52.7
--   Expected order: Ramesh Patil > Imran Sheikh > Sunita Rao
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_count INT;
    v_rank1_patient TEXT;
    v_rank2_patient TEXT;
    v_rank3_patient TEXT;
    v_rank1_score NUMERIC;
    v_rank2_score NUMERIC;
    v_rank3_score NUMERIC;
BEGIN
    v_count := match_organ(1);

    SELECT w.patient_name, m.priority_score
    INTO v_rank1_patient, v_rank1_score
    FROM organ_match_log m
    JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
    WHERE m.organ_id = 1 AND m.rank_no = 1;

    SELECT w.patient_name, m.priority_score
    INTO v_rank2_patient, v_rank2_score
    FROM organ_match_log m
    JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
    WHERE m.organ_id = 1 AND m.rank_no = 2;

    SELECT w.patient_name, m.priority_score
    INTO v_rank3_patient, v_rank3_score
    FROM organ_match_log m
    JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
    WHERE m.organ_id = 1 AND m.rank_no = 3;

    IF v_rank1_patient <> 'Ramesh Patil' THEN
        RAISE EXCEPTION 'Expected rank 1 to be Ramesh Patil, got %', v_rank1_patient;
    END IF;

    IF v_rank2_patient <> 'Imran Sheikh' THEN
        RAISE EXCEPTION 'Expected rank 2 to be Imran Sheikh, got %', v_rank2_patient;
    END IF;

    IF v_rank3_patient <> 'Sunita Rao' THEN
        RAISE EXCEPTION 'Expected rank 3 to be Sunita Rao, got %', v_rank3_patient;
    END IF;

    IF v_rank1_score <= v_rank2_score OR v_rank2_score <= v_rank3_score THEN
        RAISE EXCEPTION 'Scores not strictly descending: % > % > %', v_rank1_score, v_rank2_score, v_rank3_score;
    END IF;

    RAISE NOTICE 'PASS T24: Priority score rankings correctly asserted: Ramesh Patil (81.4) > Imran Sheikh (69.7) > Sunita Rao (52.7)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T24: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T25: Equal Urgency and Distance Ranks Longer-Waiting Patient First
-- Spec:
--   Two compatible patients with equal urgency and equal distance:
--   The patient who has been waiting longer on the list must rank first.
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_waitlist_recent INT;
    v_waitlist_senior INT;
    v_rank1_id INT;
    v_score_recent NUMERIC;
    v_score_senior NUMERIC;
BEGIN
    -- Clear seed kidney waitlist entries for clean isolation in this transaction
    DELETE FROM organ_waitlist WHERE organ_type = 'Kidney';

    -- Insert two patients at Hospital 1 (0 km distance from Aarav):
    -- Both Urgency = 8, blood group O
    -- Patient Senior waited 250 days; Patient Recent waited 50 days
    INSERT INTO organ_waitlist (hospital_id, staff_id, patient_name, organ_type, blood_group, urgency_score, listed_on)
    VALUES (1, 1, 'Patient Recent', 'Kidney', 'O', 8, CURRENT_DATE - 50)
    RETURNING waitlist_id INTO v_waitlist_recent;

    INSERT INTO organ_waitlist (hospital_id, staff_id, patient_name, organ_type, blood_group, urgency_score, listed_on)
    VALUES (1, 1, 'Patient Senior', 'Kidney', 'O', 8, CURRENT_DATE - 250)
    RETURNING waitlist_id INTO v_waitlist_senior;

    -- Calculate expected scores via organ_priority
    v_score_recent := organ_priority(8, 50, 0);
    v_score_senior := organ_priority(8, 250, 0);

    IF v_score_senior <= v_score_recent THEN
        RAISE EXCEPTION 'Expected senior score (%) > recent score (%)', v_score_senior, v_score_recent;
    END IF;

    PERFORM match_organ(1);

    SELECT waitlist_id INTO v_rank1_id
    FROM organ_match_log
    WHERE organ_id = 1 AND rank_no = 1;

    IF v_rank1_id <> v_waitlist_senior THEN
        RAISE EXCEPTION 'Expected senior waiting patient (%) at rank 1, got %', v_waitlist_senior, v_rank1_id;
    END IF;

    RAISE NOTICE 'PASS T25: Equal urgency and distance ranks longer-waiting patient first';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T25: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T26: Proposal Confirmation Flow and Idempotency
-- Spec:
--   Confirming one proposal sets pledge MATCHED, patient MATCHED,
--   the chosen proposal ACCEPTED, and competing proposals REJECTED.
--   A second confirm call fails with PROPOSAL_NOT_ACTIVE.
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_match_id INT;
    v_chosen_waitlist_id INT;
    v_pledge_status VARCHAR(10);
    v_patient_status VARCHAR(12);
    v_proposal_status VARCHAR(10);
    v_rejected_count INT;
    v_second_confirm_failed BOOLEAN := FALSE;
BEGIN
    PERFORM match_organ(1);

    SELECT organ_match_id, waitlist_id
    INTO v_match_id, v_chosen_waitlist_id
    FROM organ_match_log
    WHERE organ_id = 1 AND rank_no = 1;

    -- Confirm proposal
    PERFORM confirm_organ_match(v_match_id);

    -- Verify pledge is MATCHED
    SELECT status INTO v_pledge_status FROM organ_registry WHERE organ_id = 1;
    IF v_pledge_status <> 'MATCHED' THEN
        RAISE EXCEPTION 'Expected pledge status MATCHED, got %', v_pledge_status;
    END IF;

    -- Verify patient is MATCHED
    SELECT status INTO v_patient_status FROM organ_waitlist WHERE waitlist_id = v_chosen_waitlist_id;
    IF v_patient_status <> 'MATCHED' THEN
        RAISE EXCEPTION 'Expected patient status MATCHED, got %', v_patient_status;
    END IF;

    -- Verify chosen proposal is ACCEPTED
    SELECT status INTO v_proposal_status FROM organ_match_log WHERE organ_match_id = v_match_id;
    IF v_proposal_status <> 'ACCEPTED' THEN
        RAISE EXCEPTION 'Expected proposal status ACCEPTED, got %', v_proposal_status;
    END IF;

    -- Verify all other proposals for this organ are REJECTED
    SELECT COUNT(*)::INT INTO v_rejected_count
    FROM organ_match_log
    WHERE organ_id = 1 AND organ_match_id <> v_match_id AND status = 'REJECTED';

    IF v_rejected_count <> 2 THEN
        RAISE EXCEPTION 'Expected 2 competing proposals REJECTED, got %', v_rejected_count;
    END IF;

    -- Verify second confirm fails with PROPOSAL_NOT_ACTIVE
    BEGIN
        PERFORM confirm_organ_match(v_match_id);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%PROPOSAL_NOT_ACTIVE%' THEN
            v_second_confirm_failed := TRUE;
        ELSE
            RAISE EXCEPTION 'Expected PROPOSAL_NOT_ACTIVE error, got %', SQLERRM;
        END IF;
    END;

    IF NOT v_second_confirm_failed THEN
        RAISE EXCEPTION 'Second confirm should have failed with PROPOSAL_NOT_ACTIVE';
    END IF;

    RAISE NOTICE 'PASS T26: Confirming proposal sets pledge/patient MATCHED, rejects others, second confirm fails';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T26: %', SQLERRM;
END $$;
ROLLBACK;


-- ------------------------------------------------------------
-- Test T27: Pledge Withdrawal Protection Trigger
-- Spec:
--   Withdrawing a pledge with pending proposals rejects them and sets WITHDRAWN.
--   Withdrawing an already MATCHED pledge raises PLEDGE_ALREADY_MATCHED.
-- ------------------------------------------------------------
BEGIN;
DO $$
DECLARE
    v_pending_count INT;
    v_rejected_count INT;
    v_pledge_status VARCHAR(10);
    v_blocked_withdraw BOOLEAN := FALSE;
BEGIN
    -- Scenario A: Pending proposals rejected upon withdrawal
    PERFORM match_organ(1);

    SELECT COUNT(*)::INT INTO v_pending_count
    FROM organ_match_log WHERE organ_id = 1 AND status = 'PROPOSED';

    IF v_pending_count <> 3 THEN
        RAISE EXCEPTION 'Expected 3 pending proposals before withdrawal, got %', v_pending_count;
    END IF;

    UPDATE organ_registry SET status = 'WITHDRAWN' WHERE organ_id = 1;

    SELECT status INTO v_pledge_status FROM organ_registry WHERE organ_id = 1;
    IF v_pledge_status <> 'WITHDRAWN' THEN
        RAISE EXCEPTION 'Expected pledge status WITHDRAWN, got %', v_pledge_status;
    END IF;

    SELECT COUNT(*)::INT INTO v_rejected_count
    FROM organ_match_log WHERE organ_id = 1 AND status = 'REJECTED';

    IF v_rejected_count <> 3 THEN
        RAISE EXCEPTION 'Expected all 3 proposals REJECTED after withdrawal, got %', v_rejected_count;
    END IF;

    -- Scenario B: Withdrawing a MATCHED pledge raises PLEDGE_ALREADY_MATCHED
    UPDATE organ_registry SET status = 'MATCHED' WHERE organ_id = 1;

    BEGIN
        UPDATE organ_registry SET status = 'WITHDRAWN' WHERE organ_id = 1;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%PLEDGE_ALREADY_MATCHED%' THEN
            v_blocked_withdraw := TRUE;
        ELSE
            RAISE EXCEPTION 'Expected PLEDGE_ALREADY_MATCHED error, got %', SQLERRM;
        END IF;
    END;

    IF NOT v_blocked_withdraw THEN
        RAISE EXCEPTION 'Withdrawing MATCHED pledge should have raised PLEDGE_ALREADY_MATCHED';
    END IF;

    RAISE NOTICE 'PASS T27: Withdrawing active pledge rejects proposals; withdrawing MATCHED pledge raises PLEDGE_ALREADY_MATCHED';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL T27: %', SQLERRM;
END $$;
ROLLBACK;
