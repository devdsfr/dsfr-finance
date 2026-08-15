-- 021: bens e propriedades (lotes, terrenos, imóveis, veículos)
-- Complementa a evolução de patrimônio, que hoje só cobre investimentos
-- financeiros em snapshots mensais.

CREATE TABLE IF NOT EXISTS assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(160) NOT NULL,
  type          VARCHAR(30) NOT NULL DEFAULT 'lote',
     -- lote | terreno | casa | apartamento | sitio | veiculo | outro
  wallet_name   VARCHAR(100) NOT NULL DEFAULT 'Principal',

  -- Valores: custo e avaliação atual, para acompanhar valorização
  purchase_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  market_value   DECIMAL(15,2) NOT NULL DEFAULT 0,
  purchase_date  DATE,

  -- Localização e dimensão
  city          VARCHAR(120),
  state         VARCHAR(2),
  address       TEXT,
  area          DECIMAL(15,2),
  area_unit     VARCHAR(10) DEFAULT 'm2',   -- m2 | hectare | alqueire

  -- Parcelamento
  is_financed      BOOLEAN NOT NULL DEFAULT FALSE,
  down_payment     DECIMAL(15,2) NOT NULL DEFAULT 0,
  installment_count INT NOT NULL DEFAULT 0,
  installment_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  first_due_date   DATE,
  seller           VARCHAR(160),
  /** Grupo dos lançamentos gerados, para achar as parcelas depois. */
  installment_group_id UUID,

  notes         TEXT NOT NULL DEFAULT '',
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_workspace ON assets (workspace_id, archived);

-- Histórico de reavaliação: permite ver a valorização do lote ao longo dos anos.
CREATE TABLE IF NOT EXISTS asset_valuations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  value      DECIMAL(15,2) NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_valuations ON asset_valuations (asset_id, date DESC);

-- Liga o lançamento ao bem que o originou, para o progresso do parcelamento
-- ser calculado a partir das parcelas realmente pagas.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS asset_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_asset
  ON transactions (asset_id) WHERE asset_id IS NOT NULL;
