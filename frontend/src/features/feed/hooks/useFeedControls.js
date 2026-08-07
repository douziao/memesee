import { useEffect, useState } from "react";
import { isHomeFeedActive } from "../state/feedViewHelpers";

const FLOATING_ACTION_SCROLL_THRESHOLD = 320;
const FLOATING_ACTION_IDLE_HIDE_DELAY_MS = 1600;

export function useFeedControls({
  routeType,
  view,
  topSortRef,
  feedSortModes,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedSortMode, setFeedSortMode] = useState("latest_message");
  const [sortMenuAnchor, setSortMenuAnchor] = useState("");
  const [showBackTop, setShowBackTop] = useState(false);

  function commitSearch() {
    setSearchQuery(searchInput.trim());
  }

  function updateSearchInput(value) {
    setSearchInput(value);
    if (!String(value || "").trim()) {
      setSearchQuery("");
    }
  }

  function clearSearch() {
    setSearchInput("");
    setSearchQuery("");
  }

  function backToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function applyFeedSort(mode) {
    if (!feedSortModes.includes(mode)) {
      return;
    }
    setFeedSortMode(mode);
    setSortMenuAnchor("");
    backToTop();
  }

  function toggleSortMenu(anchor) {
    setSortMenuAnchor((prev) => (prev === anchor ? "" : anchor));
  }

  function closeSortMenu() {
    setSortMenuAnchor("");
  }

  useEffect(() => {
    let hideTimerId = null;

    const clearHideTimer = () => {
      if (hideTimerId) {
        window.clearTimeout(hideTimerId);
        hideTimerId = null;
      }
    };

    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      clearHideTimer();

      if (y <= FLOATING_ACTION_SCROLL_THRESHOLD) {
        setShowBackTop(false);
        return;
      }

      setShowBackTop(true);
      hideTimerId = window.setTimeout(() => {
        setShowBackTop(false);
        hideTimerId = null;
      }, FLOATING_ACTION_IDLE_HIDE_DELAY_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearHideTimer();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!feedSortModes.includes(feedSortMode)) {
      setFeedSortMode("latest_message");
    }
  }, [feedSortMode, feedSortModes]);

  useEffect(() => {
    if (isHomeFeedActive(routeType, view)) {
      return;
    }
    setSortMenuAnchor("");
  }, [routeType, view]);

  useEffect(() => {
    if (!sortMenuAnchor) {
      return;
    }
    const close = () => setSortMenuAnchor("");
    const onPointerDown = (event) => {
      const target = event.target;
      const inTop = topSortRef.current?.contains(target);
      if (!inTop) {
        close();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sortMenuAnchor, topSortRef]);

  return {
    searchInput,
    setSearchInput: updateSearchInput,
    searchQuery,
    feedSortMode,
    sortMenuAnchor,
    showBackTop,
    commitSearch,
    clearSearch,
    applyFeedSort,
    toggleSortMenu,
    closeSortMenu,
    backToTop,
  };
}
