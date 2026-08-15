-- 022: consórcio como tipo de bem
--
-- Consórcio não é compra parcelada: até a contemplação você não tem o bem,
-- tem um direito. Por isso o valor no patrimônio é o quanto já foi pago —
-- que é o que voltaria em caso de desistência — e só passa a valer a carta
-- de crédito depois de contemplado.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS credit_letter_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS awarded_date DATE;

-- O tipo 'consorcio' passa a ser aceito na coluna type, junto de
-- lote | terreno | casa | apartamento | sitio | veiculo | outro
