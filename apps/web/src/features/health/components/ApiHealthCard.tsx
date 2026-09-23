import type { ApiHealthState } from "../model/health";

type ApiHealthCardProps = {
  state: ApiHealthState;
};

export function ApiHealthCard({ state }: ApiHealthCardProps) {
  return (
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-900/5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Montelingo Workspace
      </p>
      <h1 className="mb-4 mt-2 text-3xl font-bold">Web Skeleton</h1>
      <p>Frontend identity is online.</p>
      <p>
        API live state: <strong>{state}</strong>
      </p>
    </section>
  );
}
