-- ============================================================
-- PULSE — 11_scheduler.sql
-- Owner: Member A (Slice 1)
-- Description:
--   Schedules restore_donor_eligibility() daily at midnight (00:00)
--   using pg_cron if the extension is available on the system.
--
-- Note:
--   pg_cron is not bundled by default with PostgreSQL on Windows.
--   If pg_cron is not available, this script safely catches the
--   exception, outputs a NOTICE, and allows execution to proceed
--   without error. The Node.js cron worker in Phase A2 provides the
--   primary scheduler fallback.
-- ============================================================

DO $$
BEGIN
    BEGIN
        -- Attempt to enable pg_cron extension
        CREATE EXTENSION IF NOT EXISTS pg_cron;

        -- Unschedule existing job if already present to ensure idempotency
        PERFORM cron.unschedule('restore_donor_eligibility_daily')
        WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'restore_donor_eligibility_daily'
        );

        -- Schedule restore_donor_eligibility() to run at midnight every day
        PERFORM cron.schedule(
            'restore_donor_eligibility_daily',
            '0 0 * * *',
            'SELECT restore_donor_eligibility()'
        );

        RAISE NOTICE 'pg_cron: restore_donor_eligibility() scheduled daily at midnight.';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron extension not available (SQLSTATE %: %). The backend Node.js scheduler will handle eligibility restoration.', SQLSTATE, SQLERRM;
    END;
END $$;
