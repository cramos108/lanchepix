import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

export default function PrivacidadePage() {
  return (
    <article className="flex flex-col gap-4 text-base leading-relaxed">
      <h2 className="text-2xl font-black">Política de Privacidade</h2>
      <p className="font-bold text-muted">
        {APP_NAME} guarda só o necessário para o PDV funcionar, em conformidade
        com a LGPD (Lei nº 13.709/2018).
      </p>
      <p>
        No aparelho (IndexedDB) ficam catálogo, vendas, chave Pix, WhatsApp da
        banca e, quando você cadastra, telefone e nome do cliente para fiado e
        fidelidade. Com internet, esses dados podem sincronizar com o banco do
        vendedor (Supabase) sob o identificador da conta.
      </p>
      <p>
        Não vendemos dados. Não processamos o Pix — o pagamento acontece no
        banco do cliente. Você pode excluir catálogo, histórico e conta nas
        Configurações.
      </p>
      <p>
        Dúvidas: use o WhatsApp de contato cadastrado na banca ou o canal do
        anúncio. Esta política descreve o app público e o workspace em
        app.pixdaconfianca.com.
      </p>
      <a href="/" className="mt-2 font-extrabold text-[#FACC15] underline">
        Voltar
      </a>
    </article>
  );
}
