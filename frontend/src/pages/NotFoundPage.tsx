import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-600">That page doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
        Go to the home page
      </Link>
    </section>
  )
}
