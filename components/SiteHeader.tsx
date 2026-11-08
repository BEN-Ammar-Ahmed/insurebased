"use client";

import Link from "next/link";
import Brand from "./Brand";
import HeaderSearch from "./HeaderSearch";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const links = [["/find", "Browse by city"], ["/about", "About"]];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand"><Brand /></Link>
        <nav id="site-navigation" aria-label="Main navigation" data-open={open} onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); }
        }}>
          {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
        </nav>
        {pathname !== "/" && <HeaderSearch />}
        <button ref={menuButton} type="button" className="menu-button" aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(!open)}>Menu</button>
      </div>
    </header>
  );
}
