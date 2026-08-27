import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Termos de uso",
};

export default function TermosPage() {
  return (
    <article className="flex flex-col gap-4 text-base leading-relaxed">
      <h2 className="text-2xl font-black">Termos de uso</h2>
      <p className="font-bold text-muted">
        {APP_NAME} é uma ferramenta administrativa de registro. Não é um serviço
        financeiro nem um gateway de pagamento.
      </p>
      <p>
        O aplicativo ajuda o vendedor a anotar lanches, vendas no fiado, estoque,
        cartão fidelidade e a gerar um QR Code Pix estático com a chave informada
        pelo próprio usuário. O pagamento Pix acontece no aplicativo do banco do
        cliente. {APP_NAME} não processa, intermedeia, recebe nem transfere
        valores.
      </p>
      <p>
        Telefone e nome do cliente, quando cadastrados, ficam neste aparelho
        (IndexedDB) e podem ser sincronizados com o banco do vendedor só para
        controle de fiado e fidelidade, nos termos da LGPD. O vendedor é o
        controlador desses dados e deve usá-los apenas para essa finalidade.
      </p>
      <p>
        Ao marcar o consentimento no cadastro de telefone, o vendedor declara que
        o cliente autorizou o uso do número para cobrança de fiado e cartão
        fidelidade.
      </p>
      <Link href="/" className="mt-2 text-sun underline font-extrabold">
        Voltar para vender
      </Link>
    </article>
  );
}
