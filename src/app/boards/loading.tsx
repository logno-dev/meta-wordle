export default function Loading() {
  return (
    <div className="relative min-h-screen px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
        <div className="absolute top-1/3 left-[-10%] h-64 w-64 rounded-full bg-amber-100/80 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <div className="h-3 w-28 rounded-full bg-black/10" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="h-9 w-48 rounded-full bg-black/10" />
            <div className="h-9 w-12 rounded-full bg-black/10" />
          </div>
          <div className="h-4 w-72 rounded-full bg-black/5" />
        </header>
        <div className="grid gap-6">
          <div className="grid gap-4">
            {[0, 1].map((index) => (
              <div
                key={`boards-loading-${index}`}
                className="animate-pulse rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="h-7 w-40 rounded-full bg-black/10" />
                  <div className="flex items-center gap-2">
                    <div className="h-11 w-32 rounded-full bg-[#d76f4b]/30" />
                    <div className="h-11 w-11 rounded-full bg-black/10" />
                  </div>
                </div>
                <div className="mt-4 h-4 w-56 rounded-full bg-black/5" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10 lg:grid-cols-2">
            <div className="grid gap-3">
              <div className="h-3 w-24 rounded-full bg-black/10" />
              <div className="h-11 w-full rounded-2xl bg-black/10" />
              <div className="h-11 w-full rounded-2xl bg-black/10" />
              <div className="h-11 w-32 rounded-full bg-[#d76f4b]/30" />
            </div>
            <div className="grid gap-3">
              <div className="h-3 w-28 rounded-full bg-black/10" />
              <div className="h-11 w-full rounded-2xl bg-black/10" />
              <div className="h-11 w-32 rounded-full bg-black/10" />
            </div>
          </div>
          <div className="grid gap-4">
            {[0, 1].map((index) => (
              <div
                key={`public-loading-${index}`}
                className="animate-pulse rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="h-7 w-44 rounded-full bg-black/10" />
                    <div className="mt-2 h-3 w-32 rounded-full bg-black/5" />
                  </div>
                  <div className="h-11 w-32 rounded-full bg-black/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
