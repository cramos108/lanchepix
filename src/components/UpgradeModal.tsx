"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import {
  PRO_PRICE_LABEL,
  openStripeCheckout,
  subscribeUpgradeModal,
} from "@/lib/plan";
import { activatePro } from "@/lib/repo";
import { toast } from "@/lib/toast";

export function UpgradeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeUpgradeModal(() => setOpen(true)), []);

  return (
    <Modal
      open={open}
      title="Parabéns pelo crescimento do seu negócio!"
      onClose={() => setOpen(false)}
    >
      <div className="flex flex-col gap-4">
        <p className="text-base font-bold text-muted">
          Você atingiu o limite da versão gratuita. Assine o {APP_NAME} Pro para
          cadastrar clientes ilimitados e liberar relatórios MEI.
        </p>
        <Button
          onClick={() => {
            openStripeCheckout();
          }}
        >
          <Sparkles className="h-5 w-5" />
          Assinar Pro — {PRO_PRICE_LABEL}
        </Button>
        <Button
          variant="line"
          onClick={async () => {
            await activatePro();
            setOpen(false);
            toast("Plano Pro ativado neste aparelho");
          }}
        >
          Já paguei — ativar Pro
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Agora não
        </Button>
      </div>
    </Modal>
  );
}
