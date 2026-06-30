-- Add menstrual cycle configuration to profiles
-- Used to auto-compute current phase on every render (never stored daily).
-- Subordinate to mood cycle: modulator, never focus.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cycle_start    DATE,
  ADD COLUMN IF NOT EXISTS cycle_length   INT,
  ADD COLUMN IF NOT EXISTS luteal_length  INT;

-- Sanity constraints
ALTER TABLE profiles
  ADD CONSTRAINT profiles_cycle_length_range
    CHECK (cycle_length IS NULL OR (cycle_length BETWEEN 21 AND 40));

ALTER TABLE profiles
  ADD CONSTRAINT profiles_luteal_length_range
    CHECK (luteal_length IS NULL OR (luteal_length BETWEEN 9 AND 17));

ALTER TABLE profiles
  ADD CONSTRAINT profiles_luteal_shorter_than_cycle
    CHECK (
      luteal_length IS NULL
      OR cycle_length IS NULL
      OR luteal_length < cycle_length
    );

COMMENT ON COLUMN profiles.cycle_start IS
  'Data da última menstruação informada no onboarding. A fase atual é calculada em runtime: (today - cycle_start) mod cycle_length.';

COMMENT ON COLUMN profiles.cycle_length IS
  'Duração total do ciclo em dias (21-40). Default sugerido: 28.';

COMMENT ON COLUMN profiles.luteal_length IS
  'Duração da fase lútea em dias (9-17). Default sugerido: 14.';
