-- 019: agente financeiro no WhatsApp

-- Vínculo telefone → workspace. Um telefone atende um workspace só.
CREATE TABLE IF NOT EXISTS whatsapp_links (
  id           UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id      UUID NOT NULL,
  phone        VARCHAR(20) NOT NULL UNIQUE,   -- E.164 sem '+': 5511999999999
  verified     BOOLEAN DEFAULT FALSE,
  pairing_code VARCHAR(6),
  code_expires TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_ws ON whatsapp_links (workspace_id);

-- Log de mensagens. message_id UNIQUE garante idempotência:
-- a Meta reenvia webhooks, e sem isso um picolé viraria três.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id             UUID PRIMARY KEY,
  message_id     VARCHAR(120) NOT NULL UNIQUE,
  workspace_id   UUID,
  phone          VARCHAR(20) NOT NULL,
  direction      VARCHAR(3) NOT NULL DEFAULT 'in',   -- 'in' | 'out'
  body           TEXT,
  intent         VARCHAR(30),
  tools_used     TEXT,
  transaction_id UUID,                                -- alvo do DESFAZER
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_phone ON whatsapp_messages (phone, created_at DESC);

-- Origem do lançamento: revela quanto do gasto é dinheiro vivo.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source VARCHAR(20);
