-- 018: suporte à importação de extratos (OFX)
-- external_id guarda o FITID do OFX, que é o identificador único da transação no banco.
-- Serve para detectar reimportação do mesmo lançamento.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(160);

-- Índice único parcial: só vale quando há external_id e conta.
-- Impede que o mesmo FITID entre duas vezes na mesma conta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external
  ON transactions (workspace_id, account_id, external_id)
  WHERE external_id IS NOT NULL AND account_id IS NOT NULL;

-- Busca por descrição para a sugestão de categoria
CREATE INDEX IF NOT EXISTS idx_transactions_desc_cat
  ON transactions (workspace_id, category_id)
  WHERE category_id IS NOT NULL;
