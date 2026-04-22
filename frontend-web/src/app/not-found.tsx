import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 gap-4">
      <h1 className="text-6xl font-bold text-dark-600">404</h1>
      <h2 className="text-xl font-semibold text-dark-200">Page Not Found</h2>
      <p className="text-sm text-dark-400">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn-gradient px-4 py-2 text-white rounded-xl text-sm relative z-10">
        <span className="relative z-10">Go Home</span>
      </Link>
    </div>
  );
}
