-- Seen notification ids for the user (JSON map), written when the
-- updates dialog is closed so it does not auto-open on every login.
ALTER TABLE user ADD COLUMN notifications TEXT;
