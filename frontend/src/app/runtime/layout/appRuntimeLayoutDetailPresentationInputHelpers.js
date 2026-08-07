export function buildDetailPresentationLayoutInput({
  appChrome,
  postDetailView,
}) {
  return {
    detailMarkdownInput: {
      ...postDetailView.detailMarkdownInput,
      openImageViewer: appChrome.openImageViewer,
    },
    richDetailImages: postDetailView.richDetailImages,
    richOriginalImages: postDetailView.richOriginalImages,
    richImageSources: postDetailView.richImageSources,
    detailMediaIndex: appChrome.detailMediaIndex,
    setDetailMediaIndex: appChrome.setDetailMediaIndex,
    openImageViewer: appChrome.openImageViewer,
  };
}
