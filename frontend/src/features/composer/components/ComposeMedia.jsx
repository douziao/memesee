import RichGallery from "../../posts/components/post/RichGallery";

function displayUrl(url) {
  if (!url) {
    return "";
  }
  const normalizedRaw = String(url).trim();
  if (!normalizedRaw) {
    return "";
  }
  if (/^https?:\/\//i.test(normalizedRaw)) {
    return normalizedRaw;
  }
  return normalizedRaw.startsWith("/") ? normalizedRaw : `/${normalizedRaw}`;
}

export default function ComposeMedia({
  composerMediaUrls,
  composerMediaAssets,
  composerMediaIndex,
  setComposerMediaIndex,
  openImageViewer,
  moveComposerMedia,
  removeComposerMediaAt,
}) {
  const mediaAssets = Array.isArray(composerMediaAssets) ? composerMediaAssets : [];
  const mediaUrls = Array.isArray(composerMediaUrls) ? composerMediaUrls : [];
  const sourceItems = mediaAssets.length > 0
    ? mediaAssets
      .map((asset, index) => {
        const url = displayUrl(
          asset?.displayUrl ||
          asset?.url ||
          asset?.mediumUrl ||
          asset?.smallUrl ||
          asset?.thumbUrl ||
          mediaUrls[index] ||
          "",
        );
        const processingStatus = String(asset?.processingStatus || (url ? "READY" : "PROCESSING")).toUpperCase();
        return {
          ...asset,
          src: url,
          displayUrl: url,
          processingStatus,
        };
      })
      .filter((asset) => Number(asset?.id || 0) > 0)
    : mediaUrls
      .map((url) => displayUrl(url))
      .filter(Boolean)
      .map((url) => ({ src: url, displayUrl: url, processingStatus: "READY" }));

  if (sourceItems.length === 0) {
    return null;
  }

  return (
    <div className="compose-media-area">
      <RichGallery
        richImageSources={sourceItems}
        detailMediaIndex={composerMediaIndex}
        setDetailMediaIndex={setComposerMediaIndex}
        openImageViewer={openImageViewer}
      />

      <div className="compose-rich-editbar">
        <button
          type="button"
          className="compose-rich-control-btn"
          onClick={() => moveComposerMedia(-1)}
          disabled={composerMediaIndex <= 0}
        >
          前移
        </button>
        <button
          type="button"
          className="compose-rich-control-btn danger"
          onClick={() => removeComposerMediaAt(composerMediaIndex)}
        >
          移除
        </button>
        <button
          type="button"
          className="compose-rich-control-btn"
          onClick={() => moveComposerMedia(1)}
          disabled={composerMediaIndex >= sourceItems.length - 1}
        >
          后移
        </button>
      </div>
    </div>
  );
}
