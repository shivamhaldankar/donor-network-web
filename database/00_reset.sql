-- LOCAL DEV ONLY. Wipes everything in the public schema.
-- Never run this against a shared or hosted database.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
