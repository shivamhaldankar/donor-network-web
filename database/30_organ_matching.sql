-- ============================================================
-- PULSE — 30_organ_matching.sql
-- Owner: Member C (Slice 3: Organ Matching & Dashboards)
-- Description:
--   Implementation of multi-criteria organ priority scoring,
--   ABO compatibility lookup, candidate ranking, match confirmation,
--   withdrawal protection trigger, and ranked waitlist view.
--
-- Objects created:
--   1. Function: organ_priority(p_urgency INT, p_days_waiting INT, p_distance_km NUMERIC)
--   2. Function: match_organ(p_organ_id INT)
--   3. Function: confirm_organ_match(p_organ_match_id INT)
--   4. Trigger:  trg_pledge_withdrawn (organ_registry -> reject proposals / block if matched)
--   5. View:     vw_waitlist_ranked
-- ============================================================

-- ------------------------------------------------------------
-- Helper: ensure haversine_km exists if 10_blood_matching.sql
-- was not yet executed in a standalone test run
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION haversine_km(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    r CONSTANT DOUBLE PRECISION := 6371.0; -- Mean Earth radius in km
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    a := (sin(dlat / 2.0) ^ 2) + cos(radians(lat1)) * cos(radians(lat2)) * (sin(dlon / 2.0) ^ 2);

    IF a > 1.0 THEN
        a := 1.0;
    ELSIF a < 0.0 THEN
        a := 0.0;
    END IF;

    RETURN 2.0 * r * asin(sqrt(a));
END;
$$;

-- ------------------------------------------------------------
-- 1. Organ Priority Scoring Function
-- Formula: 0.5·U + 0.3·W + 0.2·P
--   U (Urgency)   = urgency_score × 10                      (range: 10 - 100)
--   W (Waiting)   = LEAST(days_waiting, 365) / 365 × 100    (range: 0 - 100)
--   P (Proximity) = GREATEST(0, 100 - distance_km / 5)      (range: 0 - 100; 0 if NULL or >=500km)
-- Weights are constants encapsulated inside this single function.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION organ_priority(
    p_urgency INT,
    p_days_waiting INT,
    p_distance_km NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    -- Weight constants (academic clinical model)
    w_urgency   CONSTANT NUMERIC := 0.5;
    w_waiting   CONSTANT NUMERIC := 0.3;
    w_proximity CONSTANT NUMERIC := 0.2;

    u_norm NUMERIC;
    w_norm NUMERIC;
    p_norm NUMERIC;
    v_total NUMERIC;
BEGIN
    -- U: urgency score scaled to 10-100
    u_norm := COALESCE(p_urgency, 0) * 10.0;

    -- W: waiting time capped at 365 days, scaled to 0-100
    w_norm := (LEAST(GREATEST(COALESCE(p_days_waiting, 0), 0), 365)::NUMERIC / 365.0) * 100.0;

    -- P: distance penalty (100 at 0km, 0 at 500km, 0 when coordinates are missing)
    IF p_distance_km IS NULL THEN
        p_norm := 0.0;
    ELSE
        p_norm := GREATEST(0.0, 100.0 - (p_distance_km / 5.0));
    END IF;

    -- Combined priority score
    v_total := (w_urgency * u_norm) + (w_waiting * w_norm) + (w_proximity * p_norm);

    -- Return rounded to 1 decimal place matching NUMERIC(5,1)
    RETURN ROUND(v_total, 1);
END;
$$;

-- ------------------------------------------------------------
-- 2. Match Organ Pledge to Compatible Waiting-List Patients
-- Spec:
--   - Pledge must be AVAILABLE in organ_registry.
--   - Looks up candidate patients: WAITING status, same organ_type,
--     ABO-compatible (donor blood type minus +/- compared to patient blood_group).
--   - Computes distance between donor coordinates and hospital coordinates.
--   - Deletes old PROPOSED rows for this organ.
--   - Inserts top 5 ranked proposals with rank_no 1..5.
--   - Returns number of candidates proposed.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_organ(p_organ_id INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_organ RECORD;
    v_donor_abo VARCHAR(2);
    v_count INT := 0;
BEGIN
    -- Step 1: Validate organ pledge exists and is AVAILABLE
    SELECT r.organ_id, r.organ_type, r.status, d.donor_id, d.blood_type, d.latitude, d.longitude
    INTO v_organ
    FROM organ_registry r
    JOIN donors d ON d.donor_id = r.donor_id
    WHERE r.organ_id = p_organ_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORGAN_NOT_FOUND: Organ pledge % does not exist', p_organ_id
            USING ERRCODE = 'P0001';
    END IF;

    IF v_organ.status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'ORGAN_NOT_AVAILABLE: Organ pledge % is currently %', p_organ_id, v_organ.status
            USING ERRCODE = 'P0001';
    END IF;

    -- Step 2: Extract donor ABO group (strip Rh +/- factor)
    v_donor_abo := RTRIM(v_organ.blood_type::text, '+-');

    -- Step 3: Delete previously proposed matches for this organ pledge
    DELETE FROM organ_match_log
    WHERE organ_id = p_organ_id
      AND status = 'PROPOSED';

    -- Step 4: Find compatible patients, compute priority score, and insert top 5
    WITH ranked_candidates AS (
        SELECT
            w.waitlist_id,
            w.urgency_score,
            (CURRENT_DATE - w.listed_on)::INT AS days_waiting,
            ROUND(
                haversine_km(
                    v_organ.latitude::DOUBLE PRECISION,
                    v_organ.longitude::DOUBLE PRECISION,
                    h.latitude::DOUBLE PRECISION,
                    h.longitude::DOUBLE PRECISION
                )::NUMERIC,
                1
            ) AS distance_km,
            organ_priority(
                w.urgency_score,
                (CURRENT_DATE - w.listed_on)::INT,
                ROUND(
                    haversine_km(
                        v_organ.latitude::DOUBLE PRECISION,
                        v_organ.longitude::DOUBLE PRECISION,
                        h.latitude::DOUBLE PRECISION,
                        h.longitude::DOUBLE PRECISION
                    )::NUMERIC,
                    1
                )
            ) AS priority_score
        FROM organ_waitlist w
        JOIN hospitals h ON h.hospital_id = w.hospital_id
        JOIN abo_compatibility c ON c.donor_abo = v_donor_abo AND c.recipient_abo = w.blood_group
        WHERE w.organ_type = v_organ.organ_type
          AND w.status = 'WAITING'
        ORDER BY priority_score DESC, (CURRENT_DATE - w.listed_on) DESC, w.waitlist_id ASC
        LIMIT 5
    ),
    inserted AS (
        INSERT INTO organ_match_log (
            organ_id,
            waitlist_id,
            priority_score,
            distance_km,
            rank_no,
            status,
            matched_on
        )
        SELECT
            p_organ_id,
            rc.waitlist_id,
            rc.priority_score,
            rc.distance_km,
            ROW_NUMBER() OVER (ORDER BY rc.priority_score DESC, rc.days_waiting DESC, rc.waitlist_id ASC)::INT AS rank_no,
            'PROPOSED',
            NOW()
        FROM ranked_candidates rc
        RETURNING organ_match_id
    )
    SELECT COUNT(*)::INT INTO v_count FROM inserted;

    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- 3. Confirm Organ Proposal
-- Spec:
--   - Proposal must be PROPOSED (else PROPOSAL_NOT_ACTIVE).
--   - Patient must be WAITING (else PATIENT_NOT_WAITING).
--   - Sets proposal ACCEPTED, pledge MATCHED, patient MATCHED.
--   - Rejects the organ's other pending proposals.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_organ_match(p_organ_match_id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_proposal RECORD;
BEGIN
    -- Fetch proposal, organ pledge status, and waitlist patient status
    SELECT m.organ_match_id, m.organ_id, m.waitlist_id, m.status AS proposal_status,
           w.status AS patient_status, r.status AS pledge_status
    INTO v_proposal
    FROM organ_match_log m
    JOIN organ_waitlist w ON w.waitlist_id = m.waitlist_id
    JOIN organ_registry r ON r.organ_id = m.organ_id
    WHERE m.organ_match_id = p_organ_match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROPOSAL_NOT_FOUND: Proposal % does not exist', p_organ_match_id
            USING ERRCODE = 'P0001';
    END IF;

    -- Proposal must be currently active (PROPOSED)
    IF v_proposal.proposal_status <> 'PROPOSED' THEN
        RAISE EXCEPTION 'PROPOSAL_NOT_ACTIVE: Proposal % is currently %', p_organ_match_id, v_proposal.proposal_status
            USING ERRCODE = 'P0001';
    END IF;

    -- Patient must still be waiting
    IF v_proposal.patient_status <> 'WAITING' THEN
        RAISE EXCEPTION 'PATIENT_NOT_WAITING: Patient % is currently %', v_proposal.waitlist_id, v_proposal.patient_status
            USING ERRCODE = 'P0001';
    END IF;

    -- 1. Accept chosen proposal
    UPDATE organ_match_log
    SET status = 'ACCEPTED'
    WHERE organ_match_id = p_organ_match_id;

    -- 2. Mark organ pledge MATCHED
    UPDATE organ_registry
    SET status = 'MATCHED'
    WHERE organ_id = v_proposal.organ_id;

    -- 3. Mark recipient patient MATCHED
    UPDATE organ_waitlist
    SET status = 'MATCHED'
    WHERE waitlist_id = v_proposal.waitlist_id;

    -- 4. Mark all other competing proposals for this organ REJECTED
    UPDATE organ_match_log
    SET status = 'REJECTED'
    WHERE organ_id = v_proposal.organ_id
      AND organ_match_id <> p_organ_match_id
      AND status = 'PROPOSED';
END;
$$;

-- ------------------------------------------------------------
-- 4. Pledge Withdrawn Protection Trigger
-- Spec:
--   - BEFORE UPDATE on organ_registry when status becomes WITHDRAWN:
--   - If OLD.status was MATCHED, raises PLEDGE_ALREADY_MATCHED.
--   - Otherwise rejects pending PROPOSED proposals for that pledge.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_pledge_withdrawn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'WITHDRAWN' AND OLD.status <> 'WITHDRAWN' THEN
        IF OLD.status = 'MATCHED' THEN
            RAISE EXCEPTION 'PLEDGE_ALREADY_MATCHED: Cannot withdraw an already matched organ pledge'
                USING ERRCODE = 'P0001';
        END IF;

        -- Reject any active pending proposals
        UPDATE organ_match_log
        SET status = 'REJECTED'
        WHERE organ_id = OLD.organ_id
          AND status = 'PROPOSED';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pledge_withdrawn ON organ_registry;
CREATE TRIGGER trg_pledge_withdrawn
    BEFORE UPDATE ON organ_registry
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_pledge_withdrawn();

-- ------------------------------------------------------------
-- 5. Ranked Waitlist View
-- Spec:
--   waitlist_id, hospital_id, hospital_name, patient_name, organ_type,
--   blood_group, urgency_score, listed_on, days_waiting, status
--   Ordered by urgency desc then waiting desc.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_waitlist_ranked AS
SELECT
    w.waitlist_id,
    w.hospital_id,
    h.name AS hospital_name,
    w.patient_name,
    w.organ_type,
    w.blood_group,
    w.urgency_score,
    w.listed_on,
    (CURRENT_DATE - w.listed_on)::INT AS days_waiting,
    w.status
FROM organ_waitlist w
JOIN hospitals h ON h.hospital_id = w.hospital_id
ORDER BY w.urgency_score DESC, (CURRENT_DATE - w.listed_on) DESC, w.waitlist_id ASC;
