export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
        <nav className="flex gap-2">
          <a href="/dashboard/products" className="px-3 py-2 rounded bg-gray-900 text-white">Products</a>
          <a href="/" className="px-3 py-2 rounded bg-gray-200">Home</a>
        </nav>
      </header>
      {children}
    </main>
  );
}
