import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { mapApiStatusToUi } from "../api/mappers.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiJobApplication } from "../api/types.js";
import { cn } from "../lib/utils.js";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 5;

type SearchState = "idle" | "loading" | "ready" | "error";

export function TopbarApplicationSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchSequence = useRef(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [query, setQuery] = useState(() => getApplicationsRouteQuery(location));
  const [results, setResults] = useState<ApiJobApplication[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const normalizedQuery = query.trim();

  useEffect(() => {
    let isMounted = true;

    profilesApi
      .me()
      .then((profile) => {
        if (isMounted) {
          setProfileId(profile.id);
          setProfileUnavailable(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProfileUnavailable(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setQuery(getApplicationsRouteQuery(location));
    setResults([]);
    setTotalItems(0);
    setSearchState("idle");
    setActiveResultIndex(-1);
    onOpenChange(false);
  }, [location.pathname, location.search, onOpenChange]);

  useEffect(() => {
    if (!open || !normalizedQuery) {
      setResults([]);
      setTotalItems(0);
      setSearchState("idle");
      setActiveResultIndex(-1);
      return;
    }

    if (profileUnavailable) {
      setSearchState("error");
      return;
    }

    if (!profileId) {
      setSearchState("loading");
      return;
    }

    const sequence = ++searchSequence.current;
    setSearchState("loading");
    setActiveResultIndex(-1);

    const timer = window.setTimeout(() => {
      jobApplicationsApi
        .list({
          page: 1,
          pageSize: SEARCH_RESULT_LIMIT,
          profileId,
          search: normalizedQuery,
          sortBy: "updatedAt",
          sortDirection: "desc",
        })
        .then((page) => {
          if (sequence !== searchSequence.current) return;
          setResults(page.items);
          setTotalItems(page.totalItems);
          setSearchState("ready");
        })
        .catch(() => {
          if (sequence !== searchSequence.current) return;
          setResults([]);
          setTotalItems(0);
          setSearchState("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (sequence === searchSequence.current) {
        searchSequence.current += 1;
      }
    };
  }, [normalizedQuery, open, profileId, profileUnavailable]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        onOpenChange(false);
        setActiveResultIndex(-1);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [onOpenChange, open]);

  function openApplication(applicationId: string) {
    setQuery("");
    setResults([]);
    setActiveResultIndex(-1);
    onOpenChange(false);
    navigate(`/applications/${applicationId}`);
  }

  function openAllResults() {
    if (!normalizedQuery) return;
    const searchParams = new URLSearchParams({ q: normalizedQuery });
    setActiveResultIndex(-1);
    onOpenChange(false);
    navigate(`/applications?${searchParams.toString()}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openAllResults();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      setActiveResultIndex(-1);
      return;
    }

    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onOpenChange(true);
      setActiveResultIndex((index) => (index + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onOpenChange(true);
      setActiveResultIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
      return;
    }

    if (event.key === "Enter" && activeResultIndex >= 0) {
      event.preventDefault();
      openApplication(results[activeResultIndex].id);
    }
  }

  return (
    <div ref={containerRef} className="relative hidden [-webkit-app-region:no-drag] md:block">
      <form role="search" onSubmit={handleSubmit}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-activedescendant={
            activeResultIndex >= 0 ? `${listboxId}-result-${activeResultIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open && Boolean(normalizedQuery)}
          aria-label="Search applications"
          role="combobox"
          value={query}
          placeholder="Search applications..."
          className="h-9 w-56 rounded-lg border border-input bg-card pr-3 pl-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 [-webkit-app-region:no-drag]"
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setActiveResultIndex(-1);
            onOpenChange(Boolean(nextQuery.trim()));
          }}
          onFocus={() => {
            if (normalizedQuery) onOpenChange(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </form>

      {open && normalizedQuery ? (
        <div className="absolute top-11 right-0 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div id={listboxId} role="listbox" aria-label="Application search results">
            {searchState === "loading" ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Searching applications...
              </div>
            ) : null}

            {searchState === "error" ? (
              <p className="px-4 py-6 text-center text-sm text-destructive">
                Application search is temporarily unavailable.
              </p>
            ) : null}

            {searchState === "ready" && results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No matching applications.
              </p>
            ) : null}

            {searchState === "ready"
              ? results.map((application, index) => (
                  <button
                    key={application.id}
                    id={`${listboxId}-result-${index}`}
                    aria-selected={activeResultIndex === index}
                    role="option"
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60",
                      activeResultIndex === index && "bg-muted/60",
                    )}
                    onClick={() => openApplication(application.id)}
                    onMouseEnter={() => setActiveResultIndex(index)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {application.tracking.roleTitle ?? "Untitled role"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {application.tracking.companyName ?? "Unknown company"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {mapApiStatusToUi(application.tracking.applicationStatus)}
                    </span>
                  </button>
                ))
              : null}
          </div>

          {searchState === "ready" && results.length > 0 ? (
            <button
              className="block w-full border-t border-border px-4 py-3 text-center text-xs font-semibold text-primary hover:bg-muted/60"
              type="button"
              onClick={openAllResults}
            >
              {totalItems > results.length ? `View all ${totalItems} results` : "View all results"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getApplicationsRouteQuery(location: { pathname: string; search: string }): string {
  if (location.pathname !== "/applications") return "";
  return new URLSearchParams(location.search).get("q") ?? "";
}
