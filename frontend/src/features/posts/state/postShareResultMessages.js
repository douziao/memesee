import { POST_SHARE_RESULTS } from "../../../shared/platform/postShareResults";
import { UI_MESSAGES } from "../../../shared/state/uiMessages";

export function resolvePostShareResultMessage(result, {
  sharedMessage = UI_MESSAGES.postShared,
  copiedMessage = UI_MESSAGES.postLinkCopied,
  failedMessage = UI_MESSAGES.postShareFailed,
} = {}) {
  switch (result) {
    case POST_SHARE_RESULTS.shared:
      return sharedMessage;
    case POST_SHARE_RESULTS.copied:
      return copiedMessage;
    case POST_SHARE_RESULTS.canceled:
      return "";
    case POST_SHARE_RESULTS.failed:
      return failedMessage;
    default:
      return "";
  }
}
