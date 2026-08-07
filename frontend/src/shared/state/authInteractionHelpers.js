import { UI_MESSAGES } from "./uiMessages";

export function notifyAuthRequired({ setMessage, onAuthRequired }) {
  setMessage?.(UI_MESSAGES.authRequired);
  onAuthRequired?.("login");
}
