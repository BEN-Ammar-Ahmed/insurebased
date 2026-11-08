"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import SearchPanel from "./SearchPanel";
import { SearchIcon, XIcon } from "./Icons";
import { useSearchDisclosure } from "./useSearchDisclosure";

// The round search button in the top bar (every page except home). It opens
// the same search panel, dropping down under the header.
export default function HeaderSearch() {
  const pathname = usePathname();
  const { open, setOpen, close, opener, area } = useSearchDisclosure<HTMLButtonElement>();
  useEffect(() => { close(false); }, [pathname, close]);
  return (
    <div className="header-search" ref={area}>
      <button ref={opener} type="button" className="header-search-button" aria-label={open ? "Close search" : "Search"}
        aria-expanded={open} aria-controls="header-search-panel" onClick={() => (open ? close() : setOpen(true))}>
        {open ? <XIcon size={22} /> : <SearchIcon size={22} />}
      </button>
      {open && (
        <div id="header-search-panel" className="header-search-panel">
          <SearchPanel titleId="header-search-title" onClose={() => close()} onNavigate={() => close(false)} />
        </div>
      )}
    </div>
  );
}
