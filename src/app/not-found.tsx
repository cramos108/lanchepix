import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sun">404</p>
      <h1 className="text-3xl font-black">Página não encontrada</h1>
      <Link
        href="/"
        className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-sun px-6 text-base font-extrabold uppercase text-sunink"
      >
        Voltar para vender
      </Link>
    </div>
  );
}
