"use client";
import SearchPanel from "./SearchPanel";
import { SearchIcon } from "./Icons";
import { useSearchDisclosure } from "./useSearchDisclosure";

// The big rounded search bar. It opens into the search panel in place.
// Without JavaScript it is a plain link to the question page.
export default function HomeSearchBar({ titleId = "home-search-title" }: { titleId?: string }) {
  const { open, setOpen, close, opener, area } = useSearchDisclosure<HTMLAnchorElement>();
  return (
    <div className="home-search" ref={area}>
      {open ? (
        <SearchPanel titleId={titleId} onClose={() => close()} />
      ) : (
        <a ref={opener} href="/search" className="search-pill" onClick={(e) => { e.preventDefault(); setOpen(true); }}>
          <SearchIcon size={22} />
          <span>Search by ZIP code, address, or insurance…</span>
        </a>
      )}
    </div>
  );
}
