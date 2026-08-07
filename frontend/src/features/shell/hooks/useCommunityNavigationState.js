import { useEffect, useState } from "react";

export function useCommunityNavigationState() {
  const [isCommunityCondensed, setIsCommunityCondensed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768,
  );

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth <= 768);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (isMobileViewport) {
      setIsCommunityCondensed(true);
    }
  }, [isMobileViewport]);

  function toggleCommunityCondensed(event) {
    event?.stopPropagation?.();
    setIsCommunityCondensed((prev) => !prev);
  }

  return {
    isCommunityCondensed,
    isMobileViewport,
    toggleCommunityCondensed,
  };
}
