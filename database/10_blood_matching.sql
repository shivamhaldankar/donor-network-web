-- ============================================================
-- PULSE — 10_blood_matching.sql
-- Owner: Member A (Slice 1)
-- Description:
--   Core database logic for blood donor matching, eligibility
--   checks, views, and automated eligibility restoration.
--
-- Objects created:
--   1. Function: haversine_km(lat1, lon1, lat2, lon2)
--   2. Views:    vw_eligible_donors, vw_donor_eligibility, vw_critical_open_requests
--   3. Function: find_matching_donors(p_request_id INT)
--   4. Trigger:  trg_critical_request (requests -> find_matching_donors)
--   5. Trigger:  trg_check_donor_eligibility (donations -> enforces 90-day cooldown)
--   6. Trigger:  trg_after_donation (donations -> updates last_donation_date, marks ineligible, fulfills request)
--   7. Function: restore_donor_eligibility()
-- ============================================================

-- ------------------------------------------------------------
-- 1. Great-circle distance calculation (Haversine formula)
-- ------------------------------------------------------------
-- Calculates the spherical distance in kilometres between two
-- coordinates (lat1, lon1) and (lat2, lon2) using the mean Earth
-- radius R = 6371.0 km.
-- If any input parameter is NULL, returns NULL.
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
    c DOUBLE PRECISION;
    r CONSTANT DOUBLE PRECISION := 6371.0; -- Mean Earth radius in km
BEGIN
    -- If coordinates are missing for either party, distance cannot be calculated
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    -- Convert difference in degrees to radians
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    -- Haversine formula: a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
    a := (sin(dlat / 2.0) ^ 2) + cos(radians(lat1)) * cos(radians(lat2)) * (sin(dlon / 2.0) ^ 2);

    -- Clamp 'a' between 0 and 1 to prevent rounding precision domain errors in sqrt/asin
    IF a > 1.0 THEN
        a := 1.0;
    ELSIF a < 0.0 THEN
        a := 0.0;
    END IF;

    -- Angular distance in radians: c = 2 · asin(√a)
    c := 2.0 * asin(sqrt(a));

    RETURN r * c;
END;
$$;


-- ------------------------------------------------------------
-- 2. Views
-- ------------------------------------------------------------

-- vw_eligible_donors:
-- Active donors meeting the 90-day cooldown rule:
--   is_active = TRUE AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90)
CREATE OR REPLACE VIEW vw_eligible_donors AS
SELECT
    donor_id,
    name,
    blood_type,
    city,
    latitude,
    longitude,
    last_donation_date
FROM donors
WHERE is_active = TRUE
  AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90);


-- vw_donor_eligibility:
-- Per-donor countdown information for the profile screen.
-- days_remaining is never below 0.
CREATE OR REPLACE VIEW vw_donor_eligibility AS
SELECT
    donor_id,
    last_donation_date,
    COALESCE(last_donation_date + 90, CURRENT_DATE)::DATE AS next_eligible_date,
    CASE
        WHEN last_donation_date IS NULL THEN 0
        ELSE GREATEST(0, (last_donation_date + 90) - CURRENT_DATE)::INT
    END AS days_remaining,
    (is_active = TRUE AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90))::BOOLEAN AS is_eligible
FROM donors;


-- vw_critical_open_requests:
-- Requests with urgency = 'CRITICAL' and status IN ('OPEN', 'MATCHED')
-- Includes hospital name and number of days open.
CREATE OR REPLACE VIEW vw_critical_open_requests AS
SELECT
    r.request_id,
    r.hospital_id,
    h.name AS hospital,
    r.blood_type_needed,
    r.organ_type_needed,
    r.patient_name,
    r.requested_on,
    (CURRENT_DATE - r.requested_on::DATE)::INT AS days_open
FROM requests r
JOIN hospitals h ON r.hospital_id = h.hospital_id
WHERE r.urgency = 'CRITICAL'
  AND r.status IN ('OPEN', 'MATCHED');


-- ------------------------------------------------------------
-- 3. find_matching_donors(p_request_id INT) RETURNS INT
-- ------------------------------------------------------------
-- Rules:
-- 1. Donor must be eligible (is_active and last_donation_date IS NULL or <= CURRENT_DATE - 90).
-- 2. Donor blood_type must match blood_type_needed.
-- 3. If both donor and hospital have coordinates, require distance <= radius_km.
--    Otherwise, fall back to same city (case-insensitive).
-- 4. Order by distance_km ASC (NULLs last), then oldest last_donation_date (NULLs first), then donor_id ASC.
-- 5. Insert up to 10 rows into match_log with distance_km rounded to 1 decimal.
-- 6. Set requests.status = 'MATCHED' only if at least one donor matched.
-- 7. Return the number of matched donors.
CREATE OR REPLACE FUNCTION find_matching_donors(p_request_id INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_hospital_id INT;
    v_blood_type blood_type_t;
    v_radius_km INT;
    v_request_type VARCHAR(10);
    v_hosp_lat NUMERIC(9,6);
    v_hosp_lon NUMERIC(9,6);
    v_hosp_city VARCHAR(50);
    v_match_count INT := 0;
BEGIN
    -- Retrieve request details
    SELECT hospital_id, blood_type_needed, radius_km, request_type
    INTO v_hospital_id, v_blood_type, v_radius_km, v_request_type
    FROM requests
    WHERE request_id = p_request_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Matching applies only to BLOOD requests with a specified blood type
    IF v_request_type <> 'BLOOD' OR v_blood_type IS NULL THEN
        RETURN 0;
    END IF;

    -- Retrieve hospital location details
    SELECT latitude, longitude, city
    INTO v_hosp_lat, v_hosp_lon, v_hosp_city
    FROM hospitals
    WHERE hospital_id = v_hospital_id;

    -- Match eligible donors and insert top 10 candidates into match_log
    WITH candidate_donors AS (
        SELECT
            d.donor_id,
            CASE
                WHEN v_hosp_lat IS NOT NULL AND v_hosp_lon IS NOT NULL
                 AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
                THEN ROUND(haversine_km(v_hosp_lat::double precision, v_hosp_lon::double precision,
                                       d.latitude::double precision, d.longitude::double precision)::numeric, 1)
                ELSE NULL
            END AS calc_distance_km,
            d.last_donation_date
        FROM donors d
        WHERE d.is_active = TRUE
          -- Cooldown rule: never donated OR donated 90+ days ago
          AND (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90)
          -- Exact blood type match
          AND d.blood_type = v_blood_type
          -- Proximity or same-city fallback
          AND (
              (
                  v_hosp_lat IS NOT NULL AND v_hosp_lon IS NOT NULL
                  AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
                  AND haversine_km(v_hosp_lat::double precision, v_hosp_lon::double precision,
                                  d.latitude::double precision, d.longitude::double precision) <= v_radius_km
              )
              OR
              (
                  (v_hosp_lat IS NULL OR v_hosp_lon IS NULL OR d.latitude IS NULL OR d.longitude IS NULL)
                  AND LOWER(TRIM(d.city)) = LOWER(TRIM(v_hosp_city))
              )
          )
        ORDER BY
            -- Nearest first (NULLs last for missing coordinates)
            calc_distance_km ASC NULLS LAST,
            -- Oldest donation date first (NULLs first = never donated donors prioritized)
            d.last_donation_date ASC NULLS FIRST,
            d.donor_id ASC
        LIMIT 10
    )
    INSERT INTO match_log (request_id, donor_id, distance_km, contacted_status)
    SELECT p_request_id, c.donor_id, c.calc_distance_km, 'PENDING'
    FROM candidate_donors c
    ON CONFLICT (request_id, donor_id) DO NOTHING;

    -- Count total matches recorded for this request
    SELECT COUNT(*)::INT
    INTO v_match_count
    FROM match_log
    WHERE request_id = p_request_id;

    -- Update request status to MATCHED only if at least one donor was matched
    IF v_match_count > 0 THEN
        UPDATE requests
        SET status = 'MATCHED'
        WHERE request_id = p_request_id;
    END IF;

    RETURN v_match_count;
END;
$$;


-- ------------------------------------------------------------
-- 4. Trigger: trg_critical_request
-- ------------------------------------------------------------
-- AFTER INSERT on requests: urgency CRITICAL and type BLOOD -> find_matching_donors
CREATE OR REPLACE FUNCTION fn_trg_critical_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.urgency = 'CRITICAL' AND NEW.request_type = 'BLOOD' THEN
        PERFORM find_matching_donors(NEW.request_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_critical_request ON requests;
CREATE TRIGGER trg_critical_request
AFTER INSERT ON requests
FOR EACH ROW
EXECUTE FUNCTION fn_trg_critical_request();


-- ------------------------------------------------------------
-- 5. Trigger: trg_check_donor_eligibility
-- ------------------------------------------------------------
-- BEFORE INSERT on donations for BLOOD:
-- If the donor is not eligible, raise exception DONOR_NOT_ELIGIBLE: ... with the next eligible date.
CREATE OR REPLACE FUNCTION fn_trg_check_donor_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_active BOOLEAN;
    v_last_donation DATE;
    v_next_eligible DATE;
BEGIN
    IF NEW.donation_type = 'BLOOD' THEN
        SELECT is_active, last_donation_date
        INTO v_is_active, v_last_donation
        FROM donors
        WHERE donor_id = NEW.donor_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'DONOR_NOT_FOUND: Donor ID % does not exist', NEW.donor_id
                USING ERRCODE = 'P0001';
        END IF;

        IF v_is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'DONOR_INACTIVE: Donor account is deactivated'
                USING ERRCODE = 'P0001';
        END IF;

        -- Enforce 90-day cooldown between blood donations
        IF v_last_donation IS NOT NULL AND v_last_donation > CURRENT_DATE - 90 THEN
            v_next_eligible := (v_last_donation + 90)::DATE;
            RAISE EXCEPTION 'DONOR_NOT_ELIGIBLE: Donor is not eligible to donate blood until %', v_next_eligible
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_donor_eligibility ON donations;
CREATE TRIGGER trg_check_donor_eligibility
BEFORE INSERT ON donations
FOR EACH ROW
EXECUTE FUNCTION fn_trg_check_donor_eligibility();


-- ------------------------------------------------------------
-- 6. Trigger: trg_after_donation
-- ------------------------------------------------------------
-- AFTER INSERT on donations for BLOOD:
-- Set donor last_donation_date, eligible_status = 'N'.
-- If request_id is set, mark that request FULFILLED.
CREATE OR REPLACE FUNCTION fn_trg_after_donation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.donation_type = 'BLOOD' THEN
        -- Mark donor ineligible and update their last donation date
        UPDATE donors
        SET last_donation_date = COALESCE(NEW.donated_on, CURRENT_DATE),
            eligible_status = 'N'
        WHERE donor_id = NEW.donor_id;

        -- If linked to a request, mark the request fulfilled
        IF NEW.request_id IS NOT NULL THEN
            UPDATE requests
            SET status = 'FULFILLED'
            WHERE request_id = NEW.request_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_donation ON donations;
CREATE TRIGGER trg_after_donation
AFTER INSERT ON donations
FOR EACH ROW
EXECUTE FUNCTION fn_trg_after_donation();


-- ------------------------------------------------------------
-- 7. Function: restore_donor_eligibility() RETURNS INT
-- ------------------------------------------------------------
-- Restores eligible_status = 'Y' for donors now meeting the 90-day rule.
-- For each restored donor, queues an ELIGIBLE_AGAIN row in notifications
-- for each enabled channel (EMAIL if notify_email, SMS if notify_sms and phone present).
-- Returns the total count of donors restored.
CREATE OR REPLACE FUNCTION restore_donor_eligibility()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_restored_count INT := 0;
    r RECORD;
BEGIN
    -- Query donors currently marked ineligible ('N') who now satisfy the 90-day rule
    FOR r IN
        SELECT donor_id, name, phone, notify_email, notify_sms
        FROM donors
        WHERE eligible_status = 'N'
          AND is_active = TRUE
          AND (last_donation_date IS NULL OR last_donation_date <= CURRENT_DATE - 90)
        FOR UPDATE
    LOOP
        -- Reset status cache to 'Y'
        UPDATE donors
        SET eligible_status = 'Y'
        WHERE donor_id = r.donor_id;

        -- Queue EMAIL notification if enabled
        IF r.notify_email = TRUE THEN
            INSERT INTO notifications (donor_id, request_id, type, channel, subject, message, status)
            VALUES (
                r.donor_id,
                NULL,
                'ELIGIBLE_AGAIN',
                'EMAIL',
                'You are eligible to donate blood again',
                'Dear ' || r.name || ', 90 days have passed since your last donation. You are now eligible to donate blood again. Visit Pulse to see if someone near you needs your blood type.',
                'PENDING'
            );
        END IF;

        -- Queue SMS notification if enabled and phone number exists
        IF r.notify_sms = TRUE AND r.phone IS NOT NULL AND length(trim(r.phone)) > 0 THEN
            INSERT INTO notifications (donor_id, request_id, type, channel, subject, message, status)
            VALUES (
                r.donor_id,
                NULL,
                'ELIGIBLE_AGAIN',
                'SMS',
                NULL,
                'Pulse: You are now eligible to donate blood again. Thank you for your continued support!',
                'PENDING'
            );
        END IF;

        v_restored_count := v_restored_count + 1;
    END LOOP;

    RETURN v_restored_count;
END;
$$;
