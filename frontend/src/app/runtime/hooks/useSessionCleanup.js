import { useCallback } from "react";
import { navigateToHome } from "../../../shared/state/appHelpers";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";

export function useSessionCleanup({
  resetShellNavigation,
  resetNotifications,
  clearProfileState,
  resetComposerForm,
  clearLocalAuth,
  setView,
  setRoute,
  setMessage,
}) {
  const clearAuthState = useCallback(({ message = "", openLogin = false } = {}) => {
    resetShellNavigation();
    resetNotifications();
    clearProfileState();
    resetComposerForm();
    clearLocalAuth({ openLogin });
    setView("latest");
    navigateToHome(setRoute);
    if (message) {
      setMessage(message);
    }
  }, [
    resetShellNavigation,
    resetNotifications,
    clearProfileState,
    resetComposerForm,
    clearLocalAuth,
    setView,
    setRoute,
    setMessage,
  ]);

  const logout = useCallback(() => {
    clearAuthState({ message: UI_MESSAGES.logoutSuccess });
  }, [clearAuthState]);

  return {
    clearAuthState,
    logout,
  };
}
