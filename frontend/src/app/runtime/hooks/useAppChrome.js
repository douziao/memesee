import { useCallback, useEffect, useRef, useState } from "react";
import { buildImageViewerState } from "../imageViewerState";
import {
  buildRoutePath,
  parseRouteFromLocation,
} from "../../../shared/state/appHelpers";
import { pushBrowserHistory } from "../../../shared/platform/browserNavigation";

export function restoreBlockedRouteHistory(route, pushHistory = pushBrowserHistory) {
  const routePath = buildRoutePath(route);
  if (!routePath) {
    return false;
  }
  return Boolean(pushHistory?.(routePath));
}

export function useAppChrome({
  apiBase,
}) {
  const [route, setRoute] = useState(parseRouteFromLocation);
  const [message, setMessage] = useState("");
  const [imageViewer, setImageViewer] = useState(null);
  const [detailMediaIndex, setDetailMediaIndex] = useState(0);
  const routeRef = useRef(route);
  const routeLeaveGuardRef = useRef(null);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    let disposed = false;
    const onPopState = async () => {
      const nextRoute = parseRouteFromLocation();
      const guard = routeLeaveGuardRef.current;
      if (typeof guard === "function") {
        const canLeave = await guard({ currentRoute: routeRef.current, nextRoute });
        if (disposed) {
          return;
        }
        if (!canLeave) {
          restoreBlockedRouteHistory(routeRef.current);
          return;
        }
      }
      setRoute(nextRoute);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      disposed = true;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const registerRouteLeaveGuard = useCallback((guard) => {
    routeLeaveGuardRef.current = typeof guard === "function" ? guard : null;
    return () => {
      if (routeLeaveGuardRef.current === guard) {
        routeLeaveGuardRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  function openImageViewer(url, sourceImages = [], options = {}) {
    const nextImageViewer = buildImageViewerState({
      url,
      sourceImages,
      options,
      apiBase,
      origin: window.location.origin,
    });
    if (!nextImageViewer) {
      return;
    }
    setImageViewer(nextImageViewer);
  }

  function closeImageViewer() {
    setImageViewer(null);
  }

  return {
    route,
    setRoute,
    registerRouteLeaveGuard,
    message,
    setMessage,
    imageViewer,
    openImageViewer,
    closeImageViewer,
    detailMediaIndex,
    setDetailMediaIndex,
  };
}
