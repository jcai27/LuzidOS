import WelcomeBanner from "./WelcomeBanner";

export default async function MockSapLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 relative">
      <WelcomeBanner />

      <h1 className="text-xl font-semibold mb-1">Sign in</h1>
      <p className="text-sm text-slate-500 mb-8">Enter your credentials to continue.</p>

      <form method="POST" action="/api/mock-sap/login" className="max-w-sm flex flex-col gap-4">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-xs text-red-600">Invalid username or password.</p>}
        <button
          type="submit"
          className="bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-800"
        >
          Log on
        </button>
      </form>
    </div>
  );
}
