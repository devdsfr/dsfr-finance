# Como colocar o agente do WhatsApp no ar

Checklist do que falta para o primeiro teste funcionar.

## Entenda os dois números

| Papel | Quem é | Onde entra |
|---|---|---|
| **Número do bot** | Número de teste da Meta (gratuito) | Cadastrado na Cloud API. Recebe e responde. |
| **Seu número** | 62 992177851 | Remetente do teste. Fica normal no seu celular. |

⚠️ **Não cadastre seu número pessoal como número do bot.** Ao registrá-lo na Cloud API, ele é desconectado do app WhatsApp no celular — você perde o WhatsApp normal nele.

---

## 1. Criar o app na Meta

1. Acesse **developers.facebook.com** → *Meus Apps* → *Criar app*
2. Tipo: **Empresa** (Business)
3. No painel do app, adicione o produto **WhatsApp**
4. A Meta cria automaticamente uma conta de teste com um **número de teste gratuito**

Anote da tela *API Setup*:
- **Identificação do número de telefone** → é o `WHATSAPP_PHONE_ID`
- **Token de acesso temporário** → é o `WHATSAPP_TOKEN` (vale 24h; depois gere um permanente)

## 2. Autorizar seu número como destinatário

O número de teste só conversa com números previamente cadastrados (até 5).

Na mesma tela *API Setup*, em **Para** (destinatário), adicione **+55 62 99217-7851** e confirme o código que chegar no seu WhatsApp.

Sem esse passo o bot não consegue te responder.

## 3. Pegar o App Secret

*Configurações do app* → *Básico* → **Chave Secreta do App** → é o `WHATSAPP_APP_SECRET`.

É com ele que o backend confere a assinatura do webhook. Sem ele, toda requisição é rejeitada — de propósito.

## 4. Configurar as variáveis no Render

No serviço do backend, adicione:

```
WHATSAPP_VERIFY_TOKEN=escolha-uma-frase-qualquer-sua
WHATSAPP_APP_SECRET=<chave secreta do app>
WHATSAPP_TOKEN=<token de acesso>
WHATSAPP_PHONE_ID=<id do número>
AI_API_KEY=<sua chave da Anthropic>
APP_URL=https://<url-do-frontend>
```

O `WHATSAPP_VERIFY_TOKEN` você inventa — só precisa ser igual nos dois lados.

## 5. Fazer o deploy

O backend precisa estar no ar **antes** de cadastrar o webhook, porque a Meta chama a URL na hora de validar.

As migrations 019 e 020 rodam sozinhas na subida.

## 6. Cadastrar o webhook

No painel do app: *WhatsApp* → *Configuração* → **Webhook** → *Editar*

- **URL de callback:** `https://<url-do-backend>/api/v1/webhooks/whatsapp`
- **Token de verificação:** o mesmo `WHATSAPP_VERIFY_TOKEN`

Clique em *Verificar e salvar*. Se der erro, o backend não está no ar ou o token está diferente.

Depois, em **Campos do webhook**, assine `messages`. Sem isso a Meta não envia nada.

---

## 7. Testar

Do seu celular (62 992177851), mande qualquer mensagem para o **número de teste**:

| Você manda | Esperado |
|---|---|
| `oi` | Apresentação + link `/wa/<token>` |
| *(abre o link e entra na conta)* | "✅ Pronto, já te reconheço!" |
| `comprei um picolé de 8 reais` | "✅ Picolé · R$ 8,00 · …" |
| `desfazer` | "↩️ Desfeito." |
| `saldo` | Saldo, sobra do mês e reserva |
| `vale a pena comprar um notebook de 4 mil em 10x?` | Análise com os números |
| `devo comprar ações da Petrobras?` | Recusa educada (guardrail da CVM) |

---

## Se não funcionar

| Sintoma | Causa provável |
|---|---|
| Webhook não valida | Backend fora do ar, ou `WHATSAPP_VERIFY_TOKEN` diferente |
| Nada acontece ao mandar mensagem | Campo `messages` não assinado no webhook |
| Log diz "assinatura inválida" | `WHATSAPP_APP_SECRET` errado |
| Bot não responde, mas o log processa | Seu número não está na lista de destinatários (passo 2) |
| Bot responde só "não entendi" | `AI_API_KEY` ausente — o regex cobre frases simples, o resto precisa da IA |

Os logs do backend no Render mostram tudo com prefixo `whatsapp:`.

---

## Quando sair do número de teste

O número de teste serve para desenvolvimento e atende no máximo 5 destinatários. Para abrir a usuários reais é preciso:

1. Um **chip dedicado** (não pode estar ativo no WhatsApp comum)
2. **Verificação de negócio** na Meta — costuma exigir CNPJ
3. **LGPD**: texto de consentimento no cadastro e política de privacidade cobrindo o tratamento via WhatsApp

A coluna `consent_at` já registra o aceite; falta o texto.
