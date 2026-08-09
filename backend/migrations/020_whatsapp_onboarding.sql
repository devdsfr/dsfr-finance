-- 020: entrada pelo WhatsApp (link mágico)
-- Quem manda mensagem sem ter conta recebe um link assinado que já carrega
-- o telefone. Depois de logar ou se cadastrar, o vínculo é fechado.

CREATE TABLE IF NOT EXISTS whatsapp_onboarding_tokens (
  token       VARCHAR(64) PRIMARY KEY,     -- aleatório, é o segredo do link
  phone       VARCHAR(20) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,                 -- uso único
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_onboarding_phone
  ON whatsapp_onboarding_tokens (phone, created_at DESC);

-- Marca quando o usuário aceitou receber e ter dados tratados via WhatsApp.
ALTER TABLE whatsapp_links
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
