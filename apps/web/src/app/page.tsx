import { ApiHealthCard, getApiHealthState } from "@/features/health";

// The health state must reflect the API at request time, not at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const apiState = await getApiHealthState();

  return (
    <main className="grid min-h-screen place-items-center p-8">
      <ApiHealthCard state={apiState} />
    </main>
  );
}
