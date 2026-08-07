export function buildComposerActionLayoutInput({ composerDraft }) {
  return {
    setTitle: composerDraft.setTitle,
    commitComposerTitlePreview: composerDraft.commitComposerTitlePreview,
    editComposerTitle: composerDraft.editComposerTitle,
    removeComposerTag: composerDraft.removeComposerTag,
    addComposerTag: composerDraft.addComposerTag,
    closeComposerTagEditor: composerDraft.closeComposerTagEditor,
    handleComposerTagInputKeyDown: composerDraft.handleComposerTagInputKeyDown,
    toggleComposerTagEditor: composerDraft.toggleComposerTagEditor,
    setComposerMediaIndex: composerDraft.setComposerMediaIndex,
    removeComposerMediaAt: composerDraft.removeComposerMediaAt,
    moveComposerMedia: composerDraft.moveComposerMedia,
    handleComposerContentChange: composerDraft.handleComposerContentChange,
    setComposerCommunitySlug: composerDraft.setComposerCommunitySlug,
    setComposeCommunityMenuOpen: composerDraft.setComposeCommunityMenuOpen,
    setComposerMode: composerDraft.setComposerMode,
    setComposerTagDraft: composerDraft.setComposerTagDraft,
    onComposerAssetPicked: composerDraft.onComposerAssetPicked,
    retryFailedComposerUploads: composerDraft.retryFailedComposerUploads,
    submitPost: composerDraft.submitPost,
  };
}
