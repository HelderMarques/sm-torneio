import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTournament } from '../hooks/useTournament';

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { tournament, slug } = useTournament();

  const base = `/t/${slug}`;
  const isActive = (path) =>
    location.pathname === path
      ? 'text-neutral-900 font-semibold'
      : 'text-neutral-600 hover:text-neutral-900';

  return (
    <nav className="bg-white border-b border-neutral-200/80">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to={base} className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-10 w-10 object-contain logo-img" onError={(e) => { e.target.style.display = 'none'; const fallback = e.target.nextElementSibling; if (fallback) fallback.classList.remove('hidden'); }} />
            <span className="hidden w-10 h-10 rounded-xl bg-[#9B2D3E] flex items-center justify-center text-white text-lg font-semibold shrink-0">TTC</span>
            <div>
              <span className="text-neutral-900 font-semibold text-lg tracking-tight">
                {tournament?.name || 'Secos & Molhados'}
              </span>
              <span className="text-neutral-500 text-xs block -mt-0.5">
                Tijuca Tênis Clube • {tournament?.year}
              </span>
            </div>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link to={base} className={isActive(base)}>Início</Link>
            <Link to={`${base}/calendario`} className={isActive(`${base}/calendario`)}>Calendário</Link>
            <Link to="/" className="text-neutral-500 hover:text-neutral-900 text-sm">Torneios</Link>
            <Link
              to={`/admin/t/${slug}`}
              className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Admin
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-neutral-600 hover:text-neutral-900 p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-neutral-100 space-y-1">
            <Link to={base} className={`block py-2.5 px-2 rounded-lg ${isActive(base)}`} onClick={() => setMenuOpen(false)}>Início</Link>
            <Link to={`${base}/calendario`} className={`block py-2.5 px-2 rounded-lg ${isActive(`${base}/calendario`)}`} onClick={() => setMenuOpen(false)}>Calendário</Link>
            <Link to="/" className="block py-2.5 px-2 text-neutral-500 hover:text-neutral-900 rounded-lg" onClick={() => setMenuOpen(false)}>Torneios</Link>
            <Link to={`/admin/t/${slug}`} className="block py-2.5 px-2 text-[#9B2D3E] font-medium rounded-lg" onClick={() => setMenuOpen(false)}>Admin</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
