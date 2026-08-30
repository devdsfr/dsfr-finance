# Configurar a IA do agente financeiro

O backend aceita dois formatos de API: **Anthropic** e **OpenAI-compatível**.
Como quase todo provedor gratuito usa o formato da OpenAI, trocar de provedor
é só mudar três variáveis de ambiente — sem tocar em código.

| Variável | Para que serve |
|---|---|
| `AI_API_KEY` | Sua chave |
| `AI_MODEL` | Nome do modelo |
| `AI_BASE_URL` | Vazio = Anthropic. Preenchido = provedor OpenAI-compatível |

---

## Sobre o DeepSeek

O DeepSeek **não tem free tier permanente** — o que existe são créditos de
cadastro que expiram em 30 a 90 dias. Depois disso é pago (embora barato).

Se você quer o DeepSeek de graça, o caminho é acessá-lo por um intermediário
que oferece cota gratuita: **OpenRouter** ou **NVIDIA NIM**.

---

## Opção 1 — Groq (recomendado para começar)

Gratuito de verdade, sem cartão, e absurdamente rápido — o hardware deles roda
Llama 3.3 70B a centenas de tokens por segundo. Para respostas curtas como as
do agente, isso significa resposta quase instantânea.

**Limites:** 30 requisições/minuto e 1.000/dia no Llama 3.3 70B. Muito acima do
uso de um app de finanças pessoais.

1. Crie conta em **console.groq.com**
2. Vá em *API Keys* → *Create API Key*
3. No Render, configure:

```
AI_API_KEY=gsk_sua_chave_aqui
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile
```

## Opção 2 — OpenRouter (se quiser o DeepSeek)

Dá acesso a 20+ modelos gratuitos por um endpoint só, incluindo variantes do
DeepSeek, com troca automática de provedor quando um está congestionado.

**Limites:** 20 requisições/minuto e 50/dia enquanto você não tiver comprado
créditos. Sobe para 1.000/dia depois de qualquer compra de US$ 10.

1. Crie conta em **openrouter.ai**
2. *Keys* → *Create Key*
3. No Render:

```
AI_API_KEY=sk-or-v1-sua_chave_aqui
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=deepseek/deepseek-chat-v3-0324:free
```

> O sufixo `:free` é o que garante o modelo sem custo. Confira a lista atual em
> openrouter.ai/models?q=free, porque os modelos gratuitos mudam com o tempo.

## Opção 3 — Google Gemini

Free tier generoso e boa qualidade. Endpoint compatível com OpenAI:

```
AI_API_KEY=sua_chave_do_ai_studio
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.0-flash
```

Chave em **aistudio.google.com/apikey**.

## Opção 4 — Anthropic (pago, melhor qualidade)

Deixe `AI_BASE_URL` **vazio**:

```
AI_API_KEY=sk-ant-sua_chave
AI_MODEL=claude-haiku-4-5-20251001
```

---

## Qual escolher

Para o agente financeiro, o trabalho do modelo é **traduzir números em frase** —
a conta em si é feita em Go. Isso significa que um modelo gratuito dá conta bem.

- **Groq**: mais rápido, limite mais alto, sem cartão. Melhor custo-benefício.
- **OpenRouter**: se você quer especificamente DeepSeek, ou variedade de modelos.
- **Gemini**: bom meio-termo de qualidade e limite.
- **Anthropic**: quando quiser a melhor redação e não se importar em pagar.

Trocar depois é só mudar as variáveis e reiniciar o serviço.

---

## Testar

Depois de configurar e o Render reiniciar, abra a **Visão Geral** e pergunte:

> vale a pena comprar uma moto de 18 mil em 24x?

Se responder com seus números, está funcionando. Se aparecer
"O agente não respondeu", olhe os logs do backend — o erro vem com o código
HTTP e a mensagem do provedor, o que diz na hora se é chave inválida,
limite estourado ou nome de modelo errado.

| Erro no log | Causa |
|---|---|
| `ia 401` | Chave inválida |
| `ia 404` | Nome do modelo errado para esse provedor |
| `ia 429` | Limite de requisições atingido |
| `IA não configurada` | `AI_API_KEY` vazia |
