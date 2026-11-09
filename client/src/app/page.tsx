
type HealthResponse = {
  success: boolean;
  message: string;
  timestamp: string;
};

async function getServerHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(
      `${process.env.API_URL}/api/health`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("API request failed");
    }

    return (await response.json()) as HealthResponse;
  } catch (error) {
    console.error("Backend connection error:", error);
    return null;
  }
}

export default async function HomePage() {
  const health = await getServerHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <h1 className="text-4xl font-bold text-blue-700">
        NGC Science Club
      </h1>

      <p className="text-lg text-slate-600">
        Narsingdi Government College
      </p>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">
          Backend Connection
        </h2>

        {health?.success ? (
          <p className="text-green-700">
            {health.message}
          </p>
        ) : (
          <p className="text-red-600">
            Unable to connect to the backend.
          </p>
        )}
      </div>
    </main>
  );
}
