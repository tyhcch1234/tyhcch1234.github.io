import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

const HOME_PATH = import.meta.env.BASE_URL;
const NOT_FOUND_PATH = `${HOME_PATH}404`;

export default function NotFound() {
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    // The managed server provides /404. Static Pages has no equivalent endpoint,
    // so keep its missing URL rather than redirecting to another missing page.
    if (HOME_PATH === '/' && window.location.pathname.replace(/\/$/, '') !== NOT_FOUND_PATH) {
      window.location.replace(NOT_FOUND_PATH);
    }
    return () => robots.remove();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f8f5] px-6 text-center">
      <section className="max-w-md">
        <AlertCircle className="mx-auto mb-6 h-12 w-12 text-[#16845c]" aria-hidden="true" />
        <p className="mb-3 text-sm tracking-widest text-[#16845c]">AI PICKS · 404</p>
        <h1 className="mb-4 text-3xl font-bold text-[#133a2a]">呢個頁面搵唔到</h1>
        <p className="mb-8 text-slate-600">網址可能已經改咗，或者頁面唔存在。返去工具目錄，繼續搵啱用嘅 AI。</p>
        <a href={HOME_PATH} className="inline-flex items-center gap-2 rounded-lg bg-[#16845c] px-6 py-3 font-semibold text-white hover:bg-[#133a2a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#16845c]">
          <ArrowLeft size={18} aria-hidden="true" />返回工具目錄
        </a>
      </section>
    </main>
  );
}
