import { Link } from 'react-router-dom';

/**
 * AdminBreadcrumb
 * items: [{ label, href? }]  — último item é a página atual (sem href)
 */
export default function AdminBreadcrumb({ items = [] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-1">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-neutral-300 select-none">›</span>}
            {isLast || !item.href ? (
              <span className={isLast ? 'text-neutral-500 font-medium' : 'text-neutral-400'}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="text-neutral-400 hover:text-[#9B2D3E] transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
