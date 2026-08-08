import { useCallback, useEffect, useRef, useState } from "react";
import { getHttpErrorStatus } from "../../../shared/api/httpError";
import { getMyProfile, loginUser, registerUser } from "../api/userApi";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  updateStoredToken,
  updateStoredUserLevel,
  writeStoredAuthSession,
} from "../../../shared/platform/authStorage";

export function useAuthSession({
  client,
  setMessage,
  onSessionExpired,
}) {
  const initialSession = getStoredAuthSession();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [token, setToken] = useState(initialSession.token);
  const [currentUser, setCurrentUser] = useState(initialSession.currentUser);
  const [currentUserLevel, setCurrentUserLevel] = useState(initialSession.currentUserLevel);
  const [levelProgress, setLevelProgress] = useState(null);
  const [authing, setAuthing] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const authRecoveryRef = useRef(false);
  const onSessionExpiredRef = useRef(onSessionExpired);

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const isLoggedIn = Boolean(token && currentUser);
  const userLevel = isLoggedIn ? Math.max(0, Number(currentUserLevel || 0)) : 0;

  const syncUserProgressFromPayload = useCallback((payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const nextLevel = Number(payload.level);
    if (Number.isFinite(nextLevel) && nextLevel >= 0) {
      setCurrentUserLevel(nextLevel);
      updateStoredUserLevel(nextLevel);
    }
    if (payload.progress && typeof payload.progress === "object") {
      setLevelProgress(payload.progress);
    }
    const refreshedToken = typeof payload.refreshedToken === "string"
      ? payload.refreshedToken.trim()
      : "";
    if (refreshedToken) {
      setToken(refreshedToken);
      updateStoredToken(refreshedToken);
    }
  }, []);

  const refreshLevelProgress = useCallback(async (authToken = token, options = {}) => {
    if (!authToken) {
      return null;
    }
    try {
      const payload = await getMyProfile(client, { token: authToken });
      syncUserProgressFromPayload(payload);
      return payload || null;
    } catch (error) {
      if (!options.silent) {
        setMessage(readableError(error, UI_MESSAGES.levelProgressLoadFailed));
      }
      return null;
    }
  }, [client, setMessage, syncUserProgressFromPayload, token]);

  useEffect(() => {
    const interceptorId = client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = getHttpErrorStatus(error);
        const requestUrl = String(error?.config?.url || "");
        const authHeader =
          error?.config?.headers?.Authorization ||
          error?.config?.headers?.authorization;
        const hasAuthHeader = Boolean(authHeader);
        const isAuthEndpoint =
          requestUrl.includes("/api/users/login") ||
          requestUrl.includes("/api/users/register");
        if (
          status === 401 &&
          hasAuthHeader &&
          !isAuthEndpoint &&
          !authRecoveryRef.current
        ) {
          authRecoveryRef.current = true;
          onSessionExpiredRef.current?.({
            message: UI_MESSAGES.sessionExpired,
            openLogin: true,
          });
          window.setTimeout(() => {
            authRecoveryRef.current = false;
          }, 0);
        }
        return Promise.reject(error);
      },
    );
    return () => {
      client.interceptors.response.eject(interceptorId);
    };
  }, [client]);

  useEffect(() => {
    if (!isLoggedIn) {
      setCurrentUserLevel(0);
      setLevelProgress(null);
      return;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    let active = true;
    refreshLevelProgress(token, { silent: true }).then(() => {
      if (!active) {
        return;
      }
    });
    return () => {
      active = false;
    };
  }, [isLoggedIn, refreshLevelProgress, token]);

  async function submitAuth(event) {
    event.preventDefault();
    setMessage("");
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setMessage(UI_MESSAGES.usernameRequired);
      return;
    }
    const normalizedInviteCode = inviteCode.trim().toUpperCase();
    if (mode === "register" && !normalizedInviteCode) {
      setMessage(UI_MESSAGES.inviteCodeRequired);
      return;
    }
    setAuthing(true);
    try {
      const authRequest = {
        username: normalizedUsername,
        password,
      };
      if (mode === "register") {
        authRequest.inviteCode = normalizedInviteCode;
      }
      const payload = await (mode === "register" ? registerUser : loginUser)(client, authRequest);
      const nextToken = String(payload.token || "");
      const nextUsername = String(payload.username || "");
      setToken(nextToken);
      setCurrentUser(nextUsername);
      const level = Number(payload.level || 0);
      setCurrentUserLevel(level);
      setLevelProgress(null);
      writeStoredAuthSession({
        token: nextToken,
        currentUser: nextUsername,
        currentUserLevel: level,
      });
      setUsername(normalizedUsername);
      setPassword("");
      setInviteCode("");
      setAuthModalOpen(false);
      await refreshLevelProgress(nextToken, { silent: true });
      setMessage(mode === "register" ? UI_MESSAGES.registerSuccess : UI_MESSAGES.loginSuccess);
    } catch (error) {
      setMessage(
        readableError(
          error,
          mode === "register" ? UI_MESSAGES.registerFailed : UI_MESSAGES.loginFailed,
        ),
      );
    } finally {
      setAuthing(false);
    }
  }

  function openAuthModal(nextMode = "login") {
    setMode(nextMode);
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    if (authing) {
      return;
    }
    setAuthModalOpen(false);
  }

  function clearLocalAuth({ openLogin = false } = {}) {
    setToken("");
    setCurrentUser("");
    setCurrentUserLevel(0);
    setLevelProgress(null);
    setPassword("");
    setInviteCode("");
    clearStoredAuthSession();
    if (openLogin) {
      setMode("login");
      setAuthModalOpen(true);
      return;
    }
    setAuthModalOpen(false);
  }

  return {
    mode,
    setMode,
    username,
    setUsername,
    password,
    setPassword,
    inviteCode,
    setInviteCode,
    token,
    currentUser,
    currentUserLevel,
    levelProgress,
    authing,
    authModalOpen,
    isLoggedIn,
    userLevel,
    syncUserProgressFromPayload,
    refreshLevelProgress,
    submitAuth,
    openAuthModal,
    closeAuthModal,
    clearLocalAuth,
  };
}
