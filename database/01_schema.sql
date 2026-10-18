-- ============================================================
-- PULSE — core schema (PostgreSQL 16+)
-- Shared by all three members. Run order:
--   01_schema.sql, 02_seed.sql, then 1x (A), 2x (B), 3x (C)
-- All TABLES live here. Functions, triggers and views live in
-- each member's own numbered files.
-- Changes to this file need a PR approved by all three members;
-- otherwise add an ALTER TABLE in your own numbered file.
-- ============================================================

-- ---------- Reusable domains ----------
CREATE DOMAIN blood_type_t AS VARCHAR(3)
    CHECK (VALUE IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

CREATE DOMAIN abo_group_t AS VARCHAR(2)
    CHECK (VALUE IN ('A','B','AB','O'));

CREATE DOMAIN organ_type_t AS VARCHAR(30)
    CHECK (VALUE IN ('Kidney','Liver','Cornea','Heart','Lung','Pancreas'));

-- ---------- Hospitals and staff ----------
CREATE TABLE hospitals (
    hospital_id  SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    city         VARCHAR(50)  NOT NULL,
    phone        VARCHAR(15),
    license_no   VARCHAR(30) UNIQUE,
    latitude     NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude    NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    verified     BOOLEAN NOT NULL DEFAULT FALSE      -- admin approves hospitals
);

CREATE TABLE hospital_staff (
    staff_id       SERIAL PRIMARY KEY,
    hospital_id    INTEGER NOT NULL REFERENCES hospitals(hospital_id),
    name           VARCHAR(100) NOT NULL,
    role           VARCHAR(30),
    phone          VARCHAR(15),
    email          VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(200) NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Donors ----------
CREATE TABLE donors (
    donor_id            SERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    phone               VARCHAR(15)  NOT NULL,
    email               VARCHAR(100) NOT NULL UNIQUE,        -- also the login id
    blood_type          blood_type_t NOT NULL,
    dob                 DATE,
    gender              CHAR(1) CHECK (gender IN ('M','F','O')),
    city                VARCHAR(50),
    latitude            NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude           NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    last_donation_date  DATE,
    eligible_status     CHAR(1) NOT NULL DEFAULT 'Y' CHECK (eligible_status IN ('Y','N')),
    registered_on       DATE NOT NULL DEFAULT CURRENT_DATE,
    password_hash       VARCHAR(200),                        -- NULL = cannot log in (seed/manual donors)
    notify_email        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_sms          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Admins ----------
CREATE TABLE admins (
    admin_id       SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(200) NOT NULL,
    created_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Blood / organ requests ----------
CREATE TABLE requests (
    request_id         SERIAL PRIMARY KEY,
    hospital_id        INTEGER NOT NULL REFERENCES hospitals(hospital_id),
    staff_id           INTEGER REFERENCES hospital_staff(staff_id),
    request_type       VARCHAR(10) NOT NULL CHECK (request_type IN ('BLOOD','ORGAN')),
    blood_type_needed  blood_type_t,
    organ_type_needed  organ_type_t,
    units_needed       INTEGER NOT NULL DEFAULT 1 CHECK (units_needed > 0),
    urgency            VARCHAR(10) NOT NULL CHECK (urgency IN ('CRITICAL','MODERATE','LOW')),
    radius_km          INTEGER NOT NULL DEFAULT 50 CHECK (radius_km BETWEEN 1 AND 500),
    patient_name       VARCHAR(100),
    requested_on       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status             VARCHAR(15) NOT NULL DEFAULT 'OPEN'
                       CHECK (status IN ('OPEN','MATCHED','FULFILLED','CANCELLED')),
    CONSTRAINT chk_request_target CHECK (
        (request_type = 'BLOOD' AND blood_type_needed IS NOT NULL) OR
        (request_type = 'ORGAN' AND organ_type_needed IS NOT NULL)
    )
);

-- ---------- Donor matches for blood requests ----------
CREATE TABLE match_log (
    match_id          SERIAL PRIMARY KEY,
    request_id        INTEGER NOT NULL REFERENCES requests(request_id),
    donor_id          INTEGER NOT NULL REFERENCES donors(donor_id),
    matched_on        TIMESTAMPTZ NOT NULL DEFAULT now(),
    distance_km       NUMERIC(7,1),                          -- NULL when coordinates unknown
    contacted_status  VARCHAR(15) NOT NULL DEFAULT 'PENDING'
                      CHECK (contacted_status IN ('PENDING','CONTACTED','ACCEPTED','DECLINED')),
    responded_on      TIMESTAMPTZ,
    UNIQUE (request_id, donor_id)
);

CREATE TABLE donations (
    donation_id    SERIAL PRIMARY KEY,
    donor_id       INTEGER NOT NULL REFERENCES donors(donor_id),
    request_id     INTEGER REFERENCES requests(request_id),
    hospital_id    INTEGER NOT NULL REFERENCES hospitals(hospital_id),
    donation_type  VARCHAR(10) NOT NULL CHECK (donation_type IN ('BLOOD','ORGAN')),
    units          INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
    donated_on     DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ---------- Notification queue (written by DB, sent by Node worker) ----------
CREATE TABLE notifications (
    notification_id  SERIAL PRIMARY KEY,
    donor_id         INTEGER NOT NULL REFERENCES donors(donor_id),
    request_id       INTEGER REFERENCES requests(request_id),
    type             VARCHAR(20) NOT NULL CHECK (type IN ('MATCH','ELIGIBLE_AGAIN')),
    channel          VARCHAR(5)  NOT NULL CHECK (channel IN ('EMAIL','SMS')),
    subject          VARCHAR(200),
    message          TEXT NOT NULL,
    status           VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','SENT','FAILED')),
    attempts         INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at          TIMESTAMPTZ
);

-- ---------- Organ module ----------
CREATE TABLE organ_registry (                -- donor pledges
    organ_id       SERIAL PRIMARY KEY,
    donor_id       INTEGER NOT NULL REFERENCES donors(donor_id),
    organ_type     organ_type_t NOT NULL,
    registered_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    status         VARCHAR(10) NOT NULL DEFAULT 'AVAILABLE'
                   CHECK (status IN ('AVAILABLE','MATCHED','DONATED','WITHDRAWN'))
);

CREATE TABLE organ_waitlist (                -- patients waiting for an organ
    waitlist_id    SERIAL PRIMARY KEY,
    hospital_id    INTEGER NOT NULL REFERENCES hospitals(hospital_id),
    staff_id       INTEGER REFERENCES hospital_staff(staff_id),
    patient_name   VARCHAR(100) NOT NULL,
    organ_type     organ_type_t NOT NULL,
    blood_group    abo_group_t NOT NULL,
    urgency_score  INTEGER NOT NULL CHECK (urgency_score BETWEEN 1 AND 10),
    listed_on      DATE NOT NULL DEFAULT CURRENT_DATE,
    status         VARCHAR(12) NOT NULL DEFAULT 'WAITING'
                   CHECK (status IN ('WAITING','MATCHED','TRANSPLANTED','REMOVED'))
);

CREATE TABLE organ_match_log (               -- ranked proposals
    organ_match_id  SERIAL PRIMARY KEY,
    organ_id        INTEGER NOT NULL REFERENCES organ_registry(organ_id),
    waitlist_id     INTEGER NOT NULL REFERENCES organ_waitlist(waitlist_id),
    priority_score  NUMERIC(5,1) NOT NULL,
    distance_km     NUMERIC(7,1),
    rank_no         INTEGER NOT NULL,
    matched_on      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          VARCHAR(10) NOT NULL DEFAULT 'PROPOSED'
                    CHECK (status IN ('PROPOSED','ACCEPTED','REJECTED'))
);

CREATE TABLE abo_compatibility (             -- who can give an organ to whom
    donor_abo      abo_group_t NOT NULL,
    recipient_abo  abo_group_t NOT NULL,
    PRIMARY KEY (donor_abo, recipient_abo)
);

INSERT INTO abo_compatibility (donor_abo, recipient_abo) VALUES
    ('O','O'),('O','A'),('O','B'),('O','AB'),
    ('A','A'),('A','AB'),
    ('B','B'),('B','AB'),
    ('AB','AB');

-- ---------- Audit log ----------
CREATE TABLE audit_log (
    log_id      BIGSERIAL PRIMARY KEY,
    actor_role  VARCHAR(10) NOT NULL CHECK (actor_role IN ('DONOR','STAFF','ADMIN','SYSTEM')),
    actor_id    INTEGER,
    action      VARCHAR(60) NOT NULL,
    entity      VARCHAR(40),
    entity_id   INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX idx_donors_blood      ON donors (blood_type);
CREATE INDEX idx_requests_status   ON requests (status, urgency);
CREATE INDEX idx_match_donor       ON match_log (donor_id);
CREATE INDEX idx_notif_queue       ON notifications (status, created_at);
CREATE INDEX idx_waitlist_organ    ON organ_waitlist (organ_type, status);
CREATE INDEX idx_audit_created     ON audit_log (created_at DESC);
