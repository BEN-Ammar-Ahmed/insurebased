"use client";
import SearchPanel from "./SearchPanel";
import { SearchIcon } from "./Icons";
import { useSearchDisclosure } from "./useSearchDisclosure";

// A round search icon that grows into the search bar on hover or keyboard
// focus, and opens the search panel in place on click or tap.
// Without JavaScript it is a plain link to the question page.
export default function HomeSearchBar({ titleId = "home-search-title" }: { titleId?: string }) {
  const { open, setOpen, close, opener, area } = useSearchDisclosure<HTMLAnchorElement>();
  return (
    <div className="home-search" ref={area}>
      {open ? (
        <SearchPanel titleId={titleId} onClose={() => close()} />
      ) : (
        <a ref={opener} href="/search" className="search-pill" onClick={(e) => { e.preventDefault(); setOpen(true); }}>
          <SearchIcon size={26} />
          <span className="search-pill-text">Search by ZIP code, address, or insurance…</span>
        </a>
      )}
    </div>
  );
}
