
-- Support multi-day activities and reservations.
-- End-date columns are nullable: NULL / equal-to-start means a single-day event
-- (fully backward compatible with existing rows).
ALTER TABLE activities ADD COLUMN IF NOT EXISTS event_end_date DATE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reservation_end_date DATE;

-- Unify the activity/reservation type list so the admin activity form and the
-- public reservation form share the exact same options. Adds 'pernikahan' and
-- 'aqiqah' to the existing set (legacy values kept for backward compatibility).
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN (
    'kajian', 'pengajian', 'shalat', 'acara', 'sosial', 'reservasi',
    'rapat', 'daurah', 'lainnya', 'tudung_sipulung', 'pernikahan', 'aqiqah'
  ));
