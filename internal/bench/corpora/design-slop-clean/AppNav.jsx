// clean: primary nav with aria-current, skip link, and a disclosure menu that closes on Escape
import { useEffect, useRef, useState } from "react";

export function AppNav({ items, currentPath, account }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onPointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    <header className="appbar">
      <a className="visually-hidden-focusable" href="#main">
        Skip to content
      </a>

      <span className="appbar__brand">Ferrymark</span>

      <nav className="appbar__nav" aria-label="Primary">
        {items.map((item) => (
          <a
            className="appbar__link"
            key={item.href}
            href={item.href}
            aria-current={item.href === currentPath ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="appbar__account" ref={menuRef}>
        <button
          type="button"
          className="appbar__account-trigger"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {account.name}
        </button>

        {menuOpen && (
          <div className="menu" role="menu">
            <a className="menu__item" role="menuitem" href="/account">
              Account
            </a>
            <a className="menu__item" role="menuitem" href="/account/billing">
              Billing
            </a>
            <form method="post" action="/session/end">
              <button className="menu__item" role="menuitem" type="submit">
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
