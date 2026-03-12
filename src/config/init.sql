ALTER TABLE comptabilite_data
ALTER COLUMN user_id TYPE uuid USING user_id::uuid;