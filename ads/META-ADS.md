# Pix da Confiança — campanha Meta (Facebook / Instagram)

**Conceito:** O fiado não some mais.  
**Objetivo:** o lancheiro abrir o app e usar no mesmo dia.  
**Não vender:** PWA, “sistema”, “gestão”, “IA”.  
**Vender:** dinheiro que saiu da barraca e não voltou.

---

## O jeito certo de converter (não é “baixe o app”)

Esse público vive no WhatsApp, no 4G ruim, com o celular na mão oleosa. Mandar pra App Store ou pra uma página longa mata o clique.

**Use Click-to-WhatsApp como destino principal.** No Brasil esse formato converte várias vezes mais que landing pra serviço local. O anúncio abre o Zap. Você manda o link. A pessoa entra.

Fluxo:

1. Anúncio (Feed 4:5 + Reels 9:16)
2. Clique → WhatsApp já aberto, com texto pronto
3. Você (ou um atalho salvo) responde em até 5 min com o link do app
4. A pessoa cai em `/campanha` e toca **Usar agora**

Teste B (opcional, barato de alcance):  
“Comenta **FIADO**” → o algoritmo empurra o anúncio e você manda o link no Direct.

Não use o botão **Baixar**. Use **Enviar mensagem**.

Coloque o número do WhatsApp Business em `.env.local`:

```
NEXT_PUBLIC_ADS_WHATSAPP=11999999999
```

---

## Peças (prontas em `ads/out/`)

| Arquivo | Onde rodar | Função |
|---|---|---|
| `feed-pain.png` | Feed FB/IG 4:5 | Dor. Caderninho. Hook. **Comece por esse.** |
| `feed-tap.png` | Feed 4:5 | Mecânica. 1 toque pra cobrar. |
| `feed-close.png` | Feed 4:5 | Promessa + CTA de comentário/Zap |
| `reels-hook.png` | Stories / Reels 9:16 | Cliente andando embora. Pix ficou com você. |

Use só as imagens PNG (marca **Pix da Confiança**). Não suba vídeo antigo.

Suba **pain + tap + reels** juntos. Meta escolhe. Você corta o perdedor no dia 3.

---

## Textos — anúncio 1 (principal)

**Destino:** WhatsApp  
**CTA do gerenciador:** Enviar mensagem

**Texto principal** (o que aparece acima da arte):

```
Levou no fiado e sumiu?

Anota em 1 toque, cobra no Zap já escrito, e só baixa o estoque quando o Pix cair.

Manda um oi. Te passo o acesso na hora.
```

Primeira linha tem 24 caracteres — cabe inteira no celular.

**Título:** O fiado não some mais.  
**Descrição:** Grátis. Abre no celular.  
**Saudação do WhatsApp (automática):**

```
Oi! Vi o Pix da Confiança. Quero anotar fiado e cobrar no Zap.
```

**Sua primeira resposta (cole e manda):**

```
Fala! 👋 Aqui é o Pix da Confiança.

Abre esse link no celular (é grátis, sem baixar loja):
https://SEU-DOMINIO/campanha

1) Cadastra a chave Pix
2) Põe os lanches
3) Quando alguém levar fiado, é um toque — e o Zap já sai escrito

Qualquer trava, me chama aqui.
```

---

## Textos — anúncio 2 (Reels)

Mesma arte `reels-hook.png`. Texto mais curto, porque Reels corta:

```
Cliente foi embora. O Pix ficou com você?

Anota o fiado. Cobra no Zap. Confirma quando cair.
```

**Título:** O Pix ficou com você?  
**CTA:** Enviar mensagem

---

## Textos — anúncio 3 (comentário, alcance)

Arte: `feed-close.png`

```
Comenta FIADO que eu te mando o link.

Anota quem levou. Cobra no Zap. Só baixa o estoque quando o Pix cair.
```

**Título:** Comenta FIADO  
Responda todo comentário em 15 min. Se não responder, o anúncio esfria.

---

## Público (Brasil)

Comece largo. Esse lancheiro não se cadastra como “food tech”.

- País: Brasil
- Idioma: português
- Idade: 22–55
- Dispositivo: Android (maioria da base)
- Interesses pra testar (um por conjunto):
  - MEI / empreendedorismo
  - Vendas
  - iFood / Rappi (cuidado pra não pegar só consumidor)
  - WhatsApp Business
- Comportamento: donos de pequeno negócio, se o Gerenciador mostrar
- Local: comece no seu estado / região metropolitana, depois escale Nordeste + interior SP/MG (alta densidade de barraca)

**Advantage+** com as 3 artes. 1 conjunto de anúncio por destino (Zap). Não misture Zap e site no mesmo anúncio.

Orçamento de teste: **R$ 40 a R$ 80 / dia**, 5–7 dias.  
KPI que importa: **conversa iniciada → link clicado → primeiro produto cadastrado**. Não se apaixone por CTR.

---

## O que NÃO fazer

- Não fale “aplicativo de gestão”
- Não mostre dashboard
- Não peça e-mail
- Não mande pra App Store (isso aqui é PWA)
- Não use inglês na arte
- Não prometa “aumentar vendas em 10x”

---

## Depois que a pessoa entra

O app já faz o trabalho. Sua única meta no Zap é: **ela cadastrar a chave Pix e o primeiro lanche**. Fiado e cobrança ela descobre no uso, no mesmo expediente.
