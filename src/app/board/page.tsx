export default function BoardPage() {
  return (
    <div className="relative min-h-screen px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
          >
            Wordle Board
          </a>
          <h1 className="font-display text-4xl text-[#241c15]">
            The endless board is warming up.
          </h1>
          <p className="max-w-2xl text-sm text-[#5a4d43]">
            This is the future home of the shared grid. Next up: placement rules,
            word validation, and live board state.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-xl shadow-black/5">
            <h2 className="font-display text-2xl text-[#241c15]">Your letters</h2>
            <p className="mt-2 text-sm text-[#5a4d43]">
              Inventory will show here once Wordle submissions arrive.
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={`tile-${index}`}
                  className="flex h-12 items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] text-xs font-semibold text-[#6b4b3d]"
                >
                  +
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-black/10 bg-[#1f1b16] p-6 text-white shadow-xl shadow-black/10">
            <h2 className="font-display text-2xl">Board activity</h2>
            <p className="mt-2 text-sm text-[#e8d6c6]">
              Soon you will see the latest placements and open lanes.
            </p>
            <div className="mt-4 rounded-2xl bg-white/10 p-4 text-xs uppercase tracking-[0.2em] text-[#f9e2cf]">
              Coming soon
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
