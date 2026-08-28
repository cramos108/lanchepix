"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { activateEquipe, activatePro } from "@/lib/repo";

function SucessoBody() {
  const params = useSearchParams();
  const plan = params.get("plan");
  const negocio = plan === "negocio" || plan === "equipe";
  const planName = negocio ? "NEGÓCIO" : "PRO";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (negocio ? activateEquipe() : activatePro()).then(() => setReady(true));
  }, [negocio]);

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <Sparkles className="h-12 w-12 text-sun" />
      <h2 className="text-3xl font-black leading-tight">
        {ready ? `${APP_NAME} ${planName} ativo` : `Ativando ${planName}…`}
      </h2>
      <p className="text-base font-bold text-muted">
        Pagamento confirmado. Recursos do plano {planName} liberados neste
        aparelho. Obrigado por assinar.
      </p>
      <Link href="/" className="w-full">
        <Button className="w-full">Voltar para vender</Button>
      </Link>
    </div>
  );
}

export default function ProSucessoPage() {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-center font-bold text-muted">Ativando plano…</p>
      }
    >
      <SucessoBody />
    </Suspense>
  );
}
