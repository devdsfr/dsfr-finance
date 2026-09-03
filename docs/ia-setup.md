# Configurar a IA do agente financeiro

Dados de limites e políticas conforme o comparativo do OpenRouter
(*Free LLM APIs Compared*, jun/2026).

---

## O critério que vem antes de velocidade e limite

Aqui trafega **dado financeiro**. Antes de olhar RPM ou preço, olhe se o
provedor **treina modelos com seus prompts**:

| Provedor | Treina com seus dados? |
|---|---|
| **Groq** | ❌ Não |
| **OpenRouter** | ❌ Não |
| **Cerebras** | ❌ Não |
| **Google AI Studio** | ⚠️ **Sim**, fora da UE/Reino Unido/EEE — inclui o Brasil |
| **Mistral (Experiment)** | ⚠️ **Sim** — o opt-in é obrigatório para usar a cota grátis |

Isso elimina Google AI Studio e Mistral para este caso de uso, mesmo tendo
cotas melhores. Um resumo do seu orçamento virando dado de treino é um preço
alto demais por uma cota maior.

**Recomendação: Groq como principal, OpenRouter como reserva.** Ambos com
política de não treinar, e juntos somam 1.050 requisições por dia.

---

## Passo 1 — Groq (principal)

Free tier permanente, sem cartão, e o mais rápido da lista: o hardware LPU roda
Llama 3.3 70B a cerca de 320 tokens por segundo. Para respostas curtas como as
do agente, é praticamente instantâneo.

**Limites:** 30 requisições/minuto, **1.000/dia**, contexto de 128K.

1. Crie conta em **console.groq.com** (login com Google ou GitHub)
2. *API Keys* → *Create API Key* → copie (só aparece uma vez)
3. No Render → seu backend → *Environment*:

```
AI_API_KEY=gsk_sua_chave_aqui
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
```

## Passo 2 — OpenRouter (reserva)

Se o Groq falhar ou estourar a cota, o backend cai automaticamente para o
segundo provedor. Como o OpenRouter roteia para 20+ modelos gratuitos com
failover interno, ele é uma boa segunda camada.

**Limites:** 20 requisições/minuto, **50/dia** (sobe para 1.000/dia depois de
qualquer recarga de US$ 10). Sem cartão para começar.

1. Crie conta em **openrouter.ai**
2. *Keys* → *Create Key*
3. Adicione no Render:

```
AI_FALLBACK_API_KEY=sk-or-v1-sua_chave_aqui
AI_FALLBACK_BASE_URL=https://openrouter.ai/api/v1
AI_FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

> O sufixo `:free` é o que garante custo zero. A lista de modelos gratuitos
> muda; confira em openrouter.ai/models?q=free.

### Se você quer o DeepSeek

O DeepSeek **não tem free tier permanente** — o que existe é um crédito de
teste de 10 milhões de tokens, que acaba. Para usá-lo continuamente sem pagar,
acesse via OpenRouter trocando o modelo:

```
AI_FALLBACK_MODEL=deepseek/deepseek-chat-v3-0324:free
```

O DeepSeek R1 se destaca em raciocínio de múltiplos passos e matemática. Vale
notar que no nosso caso isso rende pouco: **as contas são feitas em Go**, e o
modelo só redige. Um Llama 70B entrega a mesma qualidade final aqui.

---

## Como o failover funciona

O backend tenta o provedor principal. Se ele devolver erro — chave inválida,
cota estourada, instabilidade — registra no log e tenta o reserva. Só falha de
verdade quando os dois falham.

```
ia: provedor principal falhou: ia 429: rate limit exceeded
→ resposta veio do reserva, usuário não percebe
```

Configurar só o principal também funciona; o reserva é opcional.

---

## Outras opções

**Cerebras** — 30 RPM, ~1M tokens/dia, não treina com seus dados. Boa
alternativa ao Groq:

```
AI_BASE_URL=https://api.cerebras.ai/v1
AI_MODEL=llama-3.3-70b
```

**Anthropic** (pago, melhor redação) — deixe `AI_BASE_URL` **vazio**:

```
AI_API_KEY=sk-ant-sua_chave
AI_MODEL=claude-haiku-4-5-20251001
```

---

## Testar

Reinicie o serviço no Render, abra a **Visão Geral** e pergunte:

> vale a pena comprar uma moto de 18 mil em 24x?

Se responder com os seus números, está funcionando.

| Erro no log | Causa |
|---|---|
| `ia 401` | Chave inválida |
| `ia 404` | Nome do modelo errado para esse provedor |
| `ia 429` | Cota atingida — o reserva assume, se configurado |
| `IA não configurada` | `AI_API_KEY` vazia |

---

## Ressalvas honestas sobre free tier

Reproduzindo o que o próprio artigo do OpenRouter alerta:

- **Sem SLA.** Limites podem apertar sem aviso e há indisponibilidade sem
  compensação. Aceitável para uso pessoal, arriscado para produto com clientes.
- **Contexto reduzido.** Alguns provedores servem janela menor no endpoint
  gratuito que no pago.
- **Quantização menor.** Pesos em 8 ou 4 bits reduzem qualidade em tarefas
  complexas — pouco relevante aqui, já que o modelo só redige.
- **Bloqueio de IP.** VPN e faixas de datacenter costumam ser bloqueadas.
  O Render é datacenter; se aparecer bloqueio, o failover ajuda.

Se um dia o app tiver usuários de verdade, vale reavaliar: a recarga de US$ 10
no OpenRouter sobe o teto para 1.000/dia e habilita failover entre provedores.

---

Fonte: [Free LLM APIs Compared — OpenRouter, jun/2026](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/)
