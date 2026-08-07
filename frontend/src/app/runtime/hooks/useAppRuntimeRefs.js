import { useRef } from "react";

export function useAppRuntimeRefs() {
  const topSortRef = useRef(null);
  const topbarRef = useRef(null);
  const communityNavRef = useRef(null);
  const communityNavHeadRef = useRef(null);
  const subPostComposerRef = useRef(null);
  const subPostTextareaRef = useRef(null);

  return {
    topSortRef,
    topbarRef,
    communityNavRef,
    communityNavHeadRef,
    subPostComposerRef,
    subPostTextareaRef,
  };
}

export function buildAppRuntimeRefs({
  runtimeRefs,
  dataRuntime,
  interactionRuntime,
}) {
  return {
    ...runtimeRefs,
    feedLoadMoreRef: dataRuntime.feedView.feedLoadMoreRef,
    composerTitleInputRef: interactionRuntime.composerDraft.composerTitleInputRef,
    composerTagInputRef: interactionRuntime.composerDraft.composerTagInputRef,
    composerContentRef: interactionRuntime.composerDraft.composerContentRef,
    composeCommunityMenuRef: interactionRuntime.composerDraft.composeCommunityMenuRef,
  };
}
