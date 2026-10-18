-- ============================================================
-- PULSE — demo seed data (DEV ONLY — public demo passwords)
-- Run on a fresh database after 01_schema.sql.
-- All seeded logins use the password:  Pulse@123
-- The admin account is created by:  npm run seed:admin  (server)
-- ============================================================

-- crypt() with the 'bf' salt makes bcrypt hashes the Node bcrypt library accepts.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Hospitals (IDs 1-4 on a fresh database) ----------
INSERT INTO hospitals (name, city, phone, license_no, latitude, longitude, verified) VALUES
 ('City Care Hospital',     'Pune',   '9800000001', 'LIC001', 18.520400, 73.856700, TRUE),
 ('Sunrise Medical Center', 'Mumbai', '9800000002', 'LIC002', 19.076000, 72.877700, TRUE),
 ('Lifeline Hospital',      'Pune',   '9800000003', 'LIC003', 18.553000, 73.807000, TRUE),
 ('New Hope Clinic',        'Nashik', '9800000004', 'LIC004', 19.997500, 73.789800, FALSE);  -- unverified on purpose

-- ---------- Staff (IDs 1-3) ----------
INSERT INTO hospital_staff (hospital_id, name, role, phone, email, password_hash) VALUES
 (1, 'Anita Kulkarni', 'Coordinator', '9811000001', 'staff.citycare@example.com', crypt('Pulse@123', gen_salt('bf', 10))),
 (2, 'Farhan Qureshi', 'Nurse',       '9811000002', 'staff.sunrise@example.com',  crypt('Pulse@123', gen_salt('bf', 10))),
 (4, 'Rohit Jadhav',   'Coordinator', '9811000004', 'staff.newhope@example.com',  crypt('Pulse@123', gen_salt('bf', 10)));

-- ---------- Donors (IDs 1-10) ----------
-- Only donors 1, 2 and 6 can log in (password_hash set).
INSERT INTO donors
 (name, phone, email, blood_type, dob, gender, city, latitude, longitude,
  last_donation_date, eligible_status, password_hash, notify_email, notify_sms)
VALUES
 ('Aarav Shah',     '9811111111', 'aarav@example.com',  'O+',  '1998-04-12', 'M', 'Pune',   18.520400, 73.856700, NULL,                    'Y', crypt('Pulse@123', gen_salt('bf', 10)), TRUE, FALSE),
 ('Priya Nair',     '9822222222', 'priya@example.com',  'O+',  '1999-09-03', 'F', 'Pune',   18.567900, 73.914300, CURRENT_DATE - 120,      'Y', crypt('Pulse@123', gen_salt('bf', 10)), TRUE, TRUE),
 ('Rohan Mehta',    '9833333333', 'rohan@example.com',  'A+',  '1997-01-25', 'M', 'Mumbai', 19.076000, 72.877700, NULL,                    'Y', NULL, TRUE, FALSE),
 ('Sneha Iyer',     '9844444444', 'sneha@example.com',  'B-',  '2000-06-18', 'F', 'Pune',   18.452900, 73.855200, NULL,                    'Y', NULL, TRUE, FALSE),
 ('Vikram Singh',   '9855555555', 'vikram@example.com', 'O+',  '1995-11-30', 'M', 'Mumbai', 19.113600, 72.869700, NULL,                    'Y', NULL, TRUE, FALSE),
 ('Neha Kulkarni',  '9866666666', 'neha@example.com',   'O+',  '1996-03-07', 'F', 'Pune',   18.501800, 73.863600, CURRENT_DATE - 30,       'N', crypt('Pulse@123', gen_salt('bf', 10)), TRUE, FALSE),
 ('Karan Patel',    '9877777777', 'karan@example.com',  'AB+', '1994-08-14', 'M', 'Nashik', 19.997500, 73.789800, NULL,                    'Y', NULL, TRUE, FALSE),
 ('Isha Deshmukh',  '9888888888', 'isha@example.com',   'O+',  '2001-12-02', 'F', 'Satara', 17.680500, 74.018300, NULL,                    'Y', NULL, TRUE, FALSE),
 ('Rahul Joshi',    '9899999999', 'rahul@example.com',  'O+',  '1993-05-21', 'M', 'Pune',   NULL,      NULL,      NULL,                    'Y', NULL, TRUE, FALSE),  -- no coordinates: tests same-city fallback
 ('Meera Rao',      '9800000010', 'meera@example.com',  'O-',  '1992-10-09', 'F', 'Pune',   18.530000, 73.845000, NULL,                    'Y', NULL, TRUE, FALSE);

-- ---------- Organ pledges ----------
INSERT INTO organ_registry (donor_id, organ_type) VALUES
 (1, 'Kidney'),    -- Aarav, O+  -> ABO group O
 (3, 'Liver'),     -- Rohan, A+  -> ABO group A
 (4, 'Cornea');    -- Sneha, B-  -> ABO group B

-- ---------- Organ waiting list ----------
INSERT INTO organ_waitlist (hospital_id, staff_id, patient_name, organ_type, blood_group, urgency_score, listed_on) VALUES
 (1, 1, 'Ramesh Patil',  'Kidney', 'O',  9, CURRENT_DATE - 200),
 (2, 2, 'Sunita Rao',    'Kidney', 'A',  7, CURRENT_DATE - 30),
 (1, 1, 'Imran Sheikh',  'Kidney', 'B',  5, CURRENT_DATE - 300),
 (3, NULL, 'Kavita Menon', 'Liver', 'A', 8, CURRENT_DATE - 90),
 (2, 2, 'Deepak Nair',   'Liver',  'AB', 6, CURRENT_DATE - 150),
 (1, 1, 'Arjun Verma',   'Cornea', 'B',  4, CURRENT_DATE - 60);
