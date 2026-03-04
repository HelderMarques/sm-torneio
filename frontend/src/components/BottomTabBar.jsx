import { Link, useLocation } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import { useAuth } from '../hooks/useAuth';

export default function BottomTabBar() {
  const location = useLocation();
  const { slug } = useTournament();
  const { user } = useAuth();

  const base = `/t/${slug}`;

  const isActive = (path) => {
    if (path === base) {
      return location.pathname === base;
    }
    return location.pathname.startsWith(path);
  };

  const adminTarget = user ? `/admin/t/${slug}` : '/admin/login';

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-neutral-200/80 bg-white/95 backdrop-blur md:hidden z-30">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between">
          {/* Home */}
          <Link
            to={base}
            className={`flex flex-col items-center flex-1 py-2 text-xs ${
              isActive(base) ? 'text-neutral-900 font-medium' : 'text-neutral-500'
            }`}
          >
            <svg
              className="w-5 h-5 mb-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 11L12 3l9 8" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            <span>Início</span>
          </Link>

          {/* Calendário */}
          <Link
            to={`${base}/calendario`}
            className={`flex flex-col items-center flex-1 py-2 text-xs ${
              isActive(`${base}/calendario`) ? 'text-neutral-900 font-medium' : 'text-neutral-500'
            }`}
          >
            <svg
              className="w-5 h-5 mb-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
            <span>Calendário</span>
          </Link>

          {/* Simulador */}
          <Link
            to={`${base}/simular`}
            className={`flex flex-col items-center flex-1 py-2 text-xs ${
              isActive(`${base}/simular`) ? 'text-neutral-900 font-medium' : 'text-neutral-500'
            }`}
          >
            <svg
              className="w-5 h-5 mb-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19h16" />
              <path d="M9 8l3-3 3 3" />
              <path d="M12 5v11" />
            </svg>
            <span>Simulador</span>
          </Link>

          {/* Admin */}
          <Link
            to={adminTarget}
            className={`flex flex-col items-center flex-1 py-2 text-xs ${
              location.pathname.startsWith('/admin') ? 'text-[#9B2D3E] font-semibold' : 'text-neutral-500'
            }`}
          >
            <svg
              className="w-5 h-5 mb-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
            </svg>
            <span>Admin</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

