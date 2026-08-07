import { useEffect, useMemo, useRef, useState } from "react";
import { apiBase } from "../appRuntimeConfig";
import { runtimeHelpers, runtimeLayoutConfig } from "../appRuntimeStatics";
import { buildAppRuntimeViewModel } from "../appRuntimeViewModelBuilders";
import { createApiClient } from "../../../shared/api/httpClient";
import { useAppChrome } from "./useAppChrome";
import { useAppDataRuntime } from "./useAppDataRuntime";
import { useAppInteractionRuntime } from "./useAppInteractionRuntime";
import { buildAppRuntimeRefs, useAppRuntimeRefs } from "./useAppRuntimeRefs";
import { useAuthSession } from "../../../features/auth/hooks/useAuthSession";

export function useAppRuntime() {
  const [view, setView] = useState("latest");
  const runtimeRefs = useAppRuntimeRefs();
  const client = useMemo(() => createApiClient({ baseURL: apiBase }), []);
  const sessionExpiredHandlerRef = useRef(() => {});

  const appChrome = useAppChrome({ apiBase });

  const authSession = useAuthSession({
    client,
    setMessage: appChrome.setMessage,
    onSessionExpired: (options) => sessionExpiredHandlerRef.current?.(options),
  });

  const dataRuntime = useAppDataRuntime({
    client,
    apiBase,
    view,
    topSortRef: runtimeRefs.topSortRef,
    appChrome,
    authSession,
    setMessage: appChrome.setMessage,
  });

  const interactionRuntime = useAppInteractionRuntime({
    client,
    apiBase,
    view,
    setView,
    refs: runtimeRefs,
    appChrome,
    authSession,
    dataRuntime,
    setMessage: appChrome.setMessage,
  });

  const refs = buildAppRuntimeRefs({
    runtimeRefs,
    dataRuntime,
    interactionRuntime,
  });
  const { setDetailMediaIndex } = appChrome;

  useEffect(() => {
    sessionExpiredHandlerRef.current = interactionRuntime.sessionCleanupState.clearAuthState;
  }, [interactionRuntime.sessionCleanupState.clearAuthState]);

  useEffect(() => {
    setDetailMediaIndex(0);
  }, [dataRuntime.queryRuntimes.detailQueryRuntime.currentDetailPostId, setDetailMediaIndex]);

  return buildAppRuntimeViewModel({
    view,
    appChrome,
    authSession,
    dataRuntime,
    interactionRuntime,
    refs,
    helpers: runtimeHelpers,
    runtimeConfig: runtimeLayoutConfig,
  });
}
