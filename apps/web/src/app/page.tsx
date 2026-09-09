import { normalizeHealthState } from "../lib/health";

type HealthResponse = {
  status: string;
};

async function fetchApiHealth(): Promise<HealthResponse | null> {
  const baseUrl = process.env.API_INTERNAL_BASE_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await fetchApiHealth();
  const apiState = normalizeHealthState(Boolean(health?.status === "ok"));

  return (
    <main className="grid min-h-screen place-items-center p-8">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-900/5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Montelingo Workspace
        </p>
        <h1 className="mb-4 mt-2 text-3xl font-bold">Web Skeleton</h1>
        <p>Frontend identity is online.</p>
        <p>
          API live state: <strong>{apiState}</strong>
        </p>
      </section>
    </main>
  );
}
