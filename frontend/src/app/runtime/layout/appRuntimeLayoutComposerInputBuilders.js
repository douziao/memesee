import { buildComposerActionLayoutInput } from "./appRuntimeLayoutComposerActionInputHelpers";
import { buildComposerStateLayoutInput } from "./appRuntimeLayoutComposerStateInputHelpers";

export function buildComposerLayoutInput({ composerDraft }) {
  return {
    ...buildComposerStateLayoutInput({ composerDraft }),
    ...buildComposerActionLayoutInput({ composerDraft }),
  };
}
