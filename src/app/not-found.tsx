export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#6366f1] mb-4">404</h1>
        <p className="text-gray-400 text-lg mb-6">Page not found</p>
        <a href="/" className="px-6 py-3 bg-[#6366f1] hover:bg-[#818cf8] rounded-xl text-white font-medium transition-colors inline-block">
          Go Home
        </a>
      </div>
    </div>
  );
}
