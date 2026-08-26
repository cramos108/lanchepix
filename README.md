# LanchePix

PWA em **Next.js (App Router)** + **Tailwind CSS** para microempreendedores no Brasil que vendem lanches e recebem no **Pix**.

O app é **offline-first**: tudo é gravado no celular com **Dexie.js (IndexedDB)** e sincroniza com o **Supabase** quando há internet. Interface 100% em português (pt-BR), valores em R$, contraste alto para usar na rua.

## O que tem

1. **Cardápio** — nome, preço (R$), categoria e estoque.
2. **QR Pix estático** — a chave Pix vira um BR Code (EMV) com CRC-16, mostrado com `qrcode.react`. Dá para gerar etiqueta por produto e imprimir.
3. **Venda no fiado** — um toque registra o pedido. A fila **Pendentes** marca **Pago** e só então baixa o estoque.
4. **Cartão fidelidade** — busca por celular, 10 carimbos visuais, prêmio automático ao completar, resgate zera o cartão.
5. **WhatsApp** — links `wa.me` com mensagens prontas de cobrança e de carimbo.
6. **PWA** — `manifest.json` + service worker. Instale na tela inicial (Android Chrome / iOS Safari → Compartilhar → Adicionar à Tela de Início).

## Requisitos

- Node.js 20+
- Conta [Supabase](https://supabase.com) (já apontada no `.env.local`)

## Subir na máquina

```bash
cd lanchepix
npm install
```

Crie `.env.local` (já existe neste projeto):

```
NEXT_PUBLIC_SUPABASE_URL=https://kvkjidfwkugjhxddpiam.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_d-x2PsKaG5h7mmlzG1RmlQ_hE4ljc8R
```

> Se a URL vier com `/rest/v1/`, o cliente JS remove esse sufixo sozinho. O `@supabase/supabase-js` precisa da URL do **projeto**, não do endpoint REST.

Rode o schema no SQL Editor do Supabase:

1. Abra [SQL Editor](https://supabase.com/dashboard/project/kvkjidfwkugjhxddpiam/sql).
2. Cole o conteúdo de `supabase/schema.sql`.
3. Execute.

Depois:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Primeiro uso

1. **Configurações** — nome da barraca, chave Pix, nome/cidade que aparecem no QR.
2. **Produtos** — cadastre os lanches (ou “Cardápio de exemplo”).
3. **Vender** — **Pix** gera o QR e baixa estoque; **Fiado** entra na fila.
4. **Pendentes** — **Pago** baixa estoque; **Cobrar no WhatsApp** abre a conversa.
5. **Cartão** — busque o celular, dê carimbos, resgate o prêmio.

## Como o Pix é gerado

O payload segue o Manual do BR Code / Pix (estático, Point of Initiation = 11):

- GUI `br.gov.bcb.pix`
- Moeda `986` (BRL)
- País `BR`
- CRC-16/CCITT-FALSE no campo `63`

QR de produto inclui o valor (`54`). QR “valor livre” deixa o cliente digitar no banco.

## Offline e sync

| Onde | O quê |
| --- | --- |
| Dexie / IndexedDB | fonte da verdade no aparelho |
| Supabase Postgres | backup / segundo aparelho do mesmo `vendor_id` |
| Service worker | casca do app (rotas e ícones) |

Cada aparelho ganha um `vendor_id` na primeira abertura. A política RLS do SQL está **aberta para `anon`** (a chave publishable já é pública no front). Para vários vendedores em produção, troque por autenticação (`auth.uid()`).

## Build de produção

```bash
npm run build
npm start
```

PWA (HTTPS): na Vercel, aponte o projeto para a pasta `lanchepix`. O service worker só registra em produção.

## Estrutura

```
src/app/                 rotas (Vender, Produtos, Pendentes, Pix, Fidelidade, Config)
src/components/          casca, QR, cartão de carimbos, UI
src/lib/pix.ts           payload EMV
src/lib/db.ts            Dexie
src/lib/repo.ts          regras (fiado, estoque, carimbo)
src/lib/sync.ts          push/pull Supabase
src/lib/whatsapp.ts      textos wa.me
supabase/schema.sql      tabelas + RLS
public/sw.js             service worker
public/manifest.json     ícones e display standalone
```

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Dexie.js + dexie-react-hooks
- @supabase/supabase-js
- qrcode.react
- lucide-react
