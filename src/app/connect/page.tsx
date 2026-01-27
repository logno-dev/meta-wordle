import ConnectForm from "./ConnectForm";

type ConnectPageProps = {
  searchParams?: { token?: string | string[] };
};

export default function ConnectPage({ searchParams }: ConnectPageProps) {
  const token = Array.isArray(searchParams?.token)
    ? searchParams?.token[0]
    : searchParams?.token;

  return (
    <div className="relative min-h-screen px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-xl flex-col gap-8">
        <a
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
        >
          Wordle Board
        </a>
        <ConnectForm token={token} />
      </main>
    </div>
  );
}
