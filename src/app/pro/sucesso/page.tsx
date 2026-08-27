"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { activatePro } from "@/lib/repo";

export default function ProSucessoPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void activatePro().then(() => setReady(true));
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <Sparkles className="h-12 w-12 text-sun" />
      <h2 className="text-3xl font-black leading-tight">
        {ready ? `${APP_NAME} Pro ativo` : "Ativando Pro…"}
      </h2>
      <p className="text-base font-bold text-muted">
        Cartões e Pix Confiança ilimitados neste aparelho. Obrigado por assinar.
      </p>
      <Link href="/" className="w-full">
        <Button className="w-full">Voltar para vender</Button>
      </Link>
    </div>
  );
}
