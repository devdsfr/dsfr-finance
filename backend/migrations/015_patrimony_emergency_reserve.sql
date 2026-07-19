-- Emergency reserve declared per wallet in each monthly patrimony snapshot.
-- Feeds the "reserva de emergência" pillar of the financial thermometer.
ALTER TABLE patrimony_snapshots
  ADD COLUMN IF NOT EXISTS emergency_reserve DECIMAL(15,2) NOT NULL DEFAULT 0;
