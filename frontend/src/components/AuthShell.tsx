/** Centered card layout for the logged-out pages (login, signup, accept invite). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight text-slate-900">
          Due<span className="text-indigo-600">Proof</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">Recurring compliance tasks, done on time, with proof.</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
