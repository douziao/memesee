import {
  buildComposerActionLayoutInput,
  buildMainPostActionLayoutInput,
  buildShellActionLayoutInput,
} from "./appRuntimeLayoutActionInputHelpers";

export function buildActionsLayoutInput({
  shellNavigationState,
  composerDraft,
  mainPostActions,
  queryRuntimeRefreshInterface,
  sessionCleanupState,
}) {
  return {
    ...buildShellActionLayoutInput({
      shellNavigationState,
      queryRuntimeRefreshInterface,
      sessionCleanupState,
    }),
    ...buildComposerActionLayoutInput({
      composerDraft,
      mainPostActions,
    }),
    ...buildMainPostActionLayoutInput({
      mainPostActions,
    }),
  };
}
