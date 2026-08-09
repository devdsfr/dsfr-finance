# Agente Financeiro no WhatsApp — DSFR Finance

Um consultor de finanças pessoais no WhatsApp, com acesso ao perfil do usuário: sobra do mês, reserva, dívidas, parcelamentos e alocação de investimentos.

> **Uso principal — opinião antes de gastar**
> **Você:** vale a pena comprar um notebook de 4 mil parcelado em 10x?
> **Bot:** Apertado. Você já tem R$ 1.180/mês em parcelas até março. Somando R$ 400, comprometeria 34% da sua sobra média (R$ 4.600). Sua reserva cobre 3,2 meses — abaixo dos 6 que você definiu como meta.

> **Uso secundário — lançamento informal**
> **Você:** comprei um picolé de 8 reais
> **Bot:** ✅ Picolé · R$ 8,00 · Alimentação · hoje _(DESFAZER para cancelar)_

## Por que o lançamento é secundário

Compras no crédito e no débito chegam pelo Open Finance ou pela importação de OFX. O que escapa é o **dinheiro vivo**: picolé, lanche, feira, gorjeta. É justamente o gasto que ninguém registra e que some do controle. O bot cobre esse buraco — e, como você já está na conversa, registrar vira uma frase.

> **Dependência a observar:** a premissa de que "crédito e débito o Open Finance captura" depende de contratar um agregador (Pluggy, Belvo etc.), que hoje custa na casa de milhares por mês. Até isso existir, quem cumpre esse papel é o **importador de OFX** que acabamos de construir. O agente funciona igual nos dois cenários — ele lê o banco de dados, não importa como o dado entrou.

---

## 1. O limite regulatório (definir antes de codar)

A **Resolução CVM 19/2021** trata consultoria de valores mobiliários como atividade fiduciária: orientação e recomendação **individualizada** sobre investimentos só pode ser prestada por quem tem autorização da CVM — e isso vale explicitamente para robôs. A CVM detalhou interpretações no Ofício Circular SIN 2/2026.

A fronteira:

| Permitido (orçamento pessoal) | Regulado (exige CVM) |
|---|---|
| "Cabe no seu mês, sobra R$ 740" | "Compre IVVB11" |
| "Essa parcela ocupa 34% da sua sobra" | "Venda seu CDB, o CDI vai cair" |
| "Sua reserva cobre 3 meses" | "Rebalanceie para 60% renda variável" |
| "Seu dinheiro está travado em ativos de longo prazo" | "Troque o fundo X pelo Y" |

**Decisão tomada:** o agente opina sobre **orçamento, dívidas e parcelamentos**. Pode citar a carteira como *contexto* ("boa parte do seu dinheiro está travada"), mas nunca recomenda comprar, vender ou rebalancear ativo.

Isso não é só juridicamente mais seguro — é o conselho que você realmente quer no momento da compra. "Posso pagar isso?" é uma pergunta de fluxo de caixa, não de mercado.

### Guardrails obrigatórios

1. **Prompt de sistema** define o limite e lista explicitamente o que recusar
2. **Recusa educada com desvio útil**: pedido de recomendação de ativo vira "não recomendo ativos específicos, mas posso te mostrar como está sua alocação hoje"
3. **Aviso no primeiro uso**: o agente ajuda com orçamento e não substitui assessoria de investimentos
4. **Log de todas as respostas**, para auditar se o guardrail está segurando

---

## 2. Arquitetura — agente com ferramentas

A mudança de "parser de comandos" para "conselheiro" muda o desenho. Em vez de casar a frase com um comando fixo, o modelo recebe a pergunta e **decide quais dados buscar**.

```
WhatsApp → webhook → valida assinatura → identifica usuário
                                              │
                                    monta o resumo financeiro
                                              │
                                    modelo + ferramentas
                                    ├─ registrar_lancamento
                                    ├─ consultar_orcamento
                                    ├─ consultar_dividas
                                    ├─ simular_compra
                                    └─ consultar_alocacao
                                              │
                                       resposta curta
```

### O resumo financeiro

Cada pergunta leva um bloco compacto de **números agregados** — sem descrição de lançamento, sem nome de estabelecimento:

```json
{
  "sobra_media_mensal": 4600.00,
  "sobra_mes_atual": 1240.00,
  "reserva_emergencia": 14800.00,
  "meses_de_reserva": 3.2,
  "meta_meses_reserva": 6,
  "parcelas_em_aberto": { "mensal": 1180.00, "ate": "2027-03" },
  "dividas_total": 8400.00,
  "faturas_abertas": 2310.00,
  "alocacao": { "renda_fixa": 0.62, "renda_variavel": 0.31, "caixa": 0.07 },
  "score_termometro": 68
}
```

Isso resolve três coisas de uma vez: **privacidade** (seus hábitos de consumo não vão para o provedor do modelo), **custo** (payload pequeno) e **qualidade** (o modelo recebe exatamente o que sustenta a conclusão).

O termômetro financeiro que já existe entra aqui de graça — o agente já sabe se você está bem ou apertado.

### Simulação de compra — a ferramenta central

`simular_compra(valor, parcelas)` roda no **Go, não no modelo**. Cálculo financeiro não pode depender de o modelo acertar aritmética. A função devolve números prontos:

```
comprometimento_da_sobra: 0.34
sobra_apos_compra: 740.00
meses_de_reserva_apos: 3.2
conflita_com_meta: true
parcelas_simultaneas_no_pico: 4
```

O modelo recebe isso e apenas **traduz em frase**. A conta é auditável e sempre correta; o modelo cuida da linguagem.

### Postura da resposta

Direto e numérico. Conclusão primeiro, número que a sustenta em seguida, no máximo duas frases. WhatsApp não comporta parágrafo.

---

## 3. Custo

Conversas iniciadas pelo usuário são **gratuitas e ilimitadas** desde nov/2024 — você sempre inicia, então a Meta não cobra nada.

O modelo agora roda em toda mensagem (o híbrido regex/IA da versão anterior perde sentido num agente conversacional). Com resumo agregado o payload é pequeno; um modelo econômico mantém isso na casa de centavos por mês em uso pessoal. Vale um teto mensal de chamadas por segurança.

Lembretes proativos continuam sendo a única coisa cobrada pela Meta (template *utility*), e seguem opcionais — o e-mail via Resend já cobre isso de graça.

---

## 4. Pré-requisitos na Meta

| Item | Atenção |
|---|---|
| Conta Meta Business + WABA | Gratuito, precisa ser sua |
| Número dedicado | **Não pode ser número já ativo no WhatsApp comum** |
| Verificação de negócio | Costuma exigir documento de empresa |

**O gargalo:** para uso pessoal, número dedicado e verificação travam. O **número de teste** do painel de desenvolvedor é gratuito, dispensa verificação e atende até 5 destinatários — suficiente enquanto o usuário é você. A migração para número próprio só se tornar produto.

**Vale validar isso antes de qualquer código.** É meia hora no painel e define se o caminho está aberto.

---

## 5. Banco de dados (migration 019)

```sql
CREATE TABLE whatsapp_links (
  id           UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id      UUID NOT NULL,
  phone        VARCHAR(20) NOT NULL UNIQUE,   -- E.164
  verified     BOOLEAN DEFAULT FALSE,
  pairing_code VARCHAR(6),
  code_expires TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whatsapp_messages (
  id             UUID PRIMARY KEY,
  message_id     VARCHAR(80) NOT NULL UNIQUE,  -- idempotência
  phone          VARCHAR(20) NOT NULL,
  direction      VARCHAR(3),                   -- 'in' | 'out'
  body           TEXT,
  intent         VARCHAR(30),
  tools_used     TEXT,
  transaction_id UUID,                         -- para o DESFAZER
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source VARCHAR(20);
-- 'manual' | 'ofx' | 'whatsapp'
```

O campo `source` passa a ter valor analítico: mostra **quanto do seu gasto é dinheiro vivo**, que hoje é justamente o ponto cego.

---

## 6. Segurança

O webhook é uma porta pública para dados financeiros. Não-negociáveis:

- **Assinatura HMAC** (`X-Hub-Signature-256`) validada antes de qualquer processamento
- **Allowlist**: número não vinculado recebe silêncio, não uma resposta que confirme o serviço
- **Idempotência** por `message_id` — a Meta reenvia webhooks, e sem isso um picolé vira três
- **Rate limit por telefone**
- **A mensagem é dado, nunca instrução**: o texto alimenta o agente, que só executa ferramentas de um conjunto fechado. Nenhuma ferramenta apaga dados em massa nem move dinheiro.

### Pareamento

Código de 6 dígitos gerado no app (validade 10 min) → você manda `vincular 123456` → telefone fica ligado ao workspace. Um telefone, um workspace.

---

## 7. Fases

**Fase 1 — fundação**
Migration 019, webhook com assinatura, idempotência, pareamento e tela no app. Entrega: o bot te reconhece.

**Fase 2 — lançamento informal**
Registro de gastos em dinheiro, categorização reaproveitando o `merchantKey` do importador de OFX, e DESFAZER. Entrega: o picolé funciona.

**Fase 3 — o conselheiro** *(o coração do produto)*
Resumo financeiro agregado, ferramentas de consulta, `simular_compra` em Go, guardrails da CVM. Entrega: "vale a pena comprar isso?" com resposta fundamentada.

**Fase 4 — proativo** *(opcional)*
Template aprovado e cron. Ex.: alerta quando um parcelamento novo empurra o comprometimento acima do limite. Custo por mensagem — avaliar contra o e-mail que já funciona.

Ordem proposta: 1 → 2 → 3. A fase 2 valida o encanamento com baixo risco antes de a fase 3 entrar no que dá valor de verdade.

---

## 8. Configuração (env)

```
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
AI_API_KEY=
AI_MONTHLY_CALL_LIMIT=      # teto de segurança
```

---

## 9. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Número dedicado / verificação de negócio | Alta | Número de teste da Meta |
| Agente escorregar para recomendação de ativo | Alta | Prompt restritivo + recusa padrão + log auditável |
| Modelo errar conta financeira | Alta | Cálculo em Go; modelo só verbaliza |
| Dados financeiros para provedor do modelo | Média | Só agregados, sem descrição de lançamento |
| Webhook exposto | Média | HMAC + allowlist + rate limit |
| Lançamento duplicado | Média | Idempotência por `message_id` |
| Conselho ruim gerar decisão ruim | Média | Números sempre visíveis, para você conferir o raciocínio |

---

## 10. Observação sobre o produto

O agente é a peça que amarra o resto do sistema. Termômetro, estratégia de dívidas, previsão e patrimônio hoje moram em telas que exigem o usuário abrir o app e interpretar gráficos. O WhatsApp inverte isso: o dado vai até a pessoa **no momento da decisão**, que é quando ele vale alguma coisa.

Isso também é a diferença mais clara frente ao concorrente que você analisou — ele organiza o passado; um agente no momento da compra atua sobre o futuro.
