export function buildComposerStateLayoutInput({ composerDraft }) {
  return {
    title: composerDraft.title,
    isTitlePreviewMode: composerDraft.isTitlePreviewMode,
    composerTags: composerDraft.composerTags,
    showTagEditor: composerDraft.showTagEditor,
    composerTagDraft: composerDraft.composerTagDraft,
    composerMode: composerDraft.composerMode,
    composerMediaUrls: composerDraft.composerMediaUrls,
    composerMediaAssets: composerDraft.composerMediaAssets,
    composerMediaIndex: composerDraft.composerMediaIndex,
    composerUploadStatus: composerDraft.composerUploadStatus,
    content: composerDraft.content,
    composerSubmitStatus: composerDraft.composerSubmitStatus,
    composerCommunityName: composerDraft.composerCommunityName,
    composerCommunitySlug: composerDraft.composerCommunitySlug,
    composeCommunityMenuOpen: composerDraft.composeCommunityMenuOpen,
    uploadingAssets: composerDraft.uploadingAssets,
    publishing: composerDraft.publishing,
    editingMainPostId: composerDraft.editingMainPostId,
  };
}
