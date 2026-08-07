import { useEffect, useRef, useState } from "react";
import { StatusCard } from "../../../shared/components/PageShell";
import ComposeContent from "./ComposeContent";
import ComposeHeader from "./ComposeHeader";
import ComposeMedia from "./ComposeMedia";
import ComposeTools from "./ComposeTools";
import "./Composer.css";

export default function ComposerPage({
  isLoggedIn,
  title,
  isTitlePreviewMode,
  composerTags,
  showTagEditor,
  composerTagDraft,
  currentUser,
  composerMode,
  composerMediaUrls,
  composerMediaIndex,
  composerMediaAssets,
  composerUploadStatus,
  content,
  composerSubmitStatus,
  composerCommunityName,
  orderedCommunities,
  composerCommunitySlug,
  composeCommunityMenuOpen,
  uploadingAssets,
  publishing,
  editingPostId,
  setTitle,
  commitComposerTitlePreview,
  editComposerTitle,
  removeComposerTag,
  addComposerTag,
  handleComposerTagInputKeyDown,
  setComposerMediaIndex,
  removeComposerMediaAt,
  moveComposerMedia,
  openImageViewer,
  handleComposerContentChange,
  cleanMissingMarkdownMediaRefs,
  restoreUnreferencedMarkdownMediaRefs,
  setComposerCommunitySlug,
  setComposeCommunityMenuOpen,
  setComposerMode,
  toggleComposerTagEditor,
  closeComposerTagEditor,
  setComposerTagDraft,
  onComposerAssetPicked,
  retryFailedComposerUploads,
  submitPost,
  composerTitleInputRef,
  composerTagInputRef,
  composerContentRef,
  composeCommunityMenuRef,
  authorInitial,
}) {
  const [composerContentViewMode, setComposerContentViewMode] = useState("edit");
  const [markdownGuideOpen, setMarkdownGuideOpen] = useState(false);
  const composerCommunityButtonRef = useRef(null);
  const composerUploadButtonRef = useRef(null);
  const submitValidationTarget = composerSubmitStatus?.type === "validation"
    ? String(composerSubmitStatus.focusTarget || "")
    : "";
  const submitStatusId = composerSubmitStatus?.type ? "composer-submit-status-message" : undefined;

  function focusComposerContent(selection = {}) {
    const frameId = window.requestAnimationFrame(() => {
      const target = composerContentRef?.current;
      if (!target) {
        return;
      }
      target.scrollIntoView?.({ block: "center", behavior: "smooth" });
      target.focus?.({ preventScroll: true });
      const selectionStart = Number(selection.selectionStart);
      const selectionEnd = Number(selection.selectionEnd);
      if (
        Number.isInteger(selectionStart) &&
        Number.isInteger(selectionEnd) &&
        selectionEnd >= selectionStart &&
        typeof target.setSelectionRange === "function"
      ) {
        target.setSelectionRange(selectionStart, selectionEnd);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }

  useEffect(() => {
    if (composerSubmitStatus?.type !== "validation" || !composerSubmitStatus.focusTarget) {
      return undefined;
    }
    if (composerSubmitStatus.focusTarget === "content") {
      setComposerContentViewMode("edit");
    }
    if (composerSubmitStatus.focusTarget === "community") {
      closeComposerTagEditor?.();
      setComposeCommunityMenuOpen?.(true);
    }
    const frameId = window.requestAnimationFrame(() => {
      const focusTargetMap = {
        title: composerTitleInputRef?.current,
        community: composerCommunityButtonRef.current,
        content: composerContentRef?.current,
        media: composerUploadButtonRef.current,
        tag: composerTagInputRef?.current,
      };
      const target = focusTargetMap[composerSubmitStatus.focusTarget];
      if (!target) {
        return;
      }
      target.scrollIntoView?.({ block: "center", behavior: "smooth" });
      target.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    composerSubmitStatus?.focusTarget,
    composerSubmitStatus?.message,
    composerSubmitStatus?.type,
    composerContentRef,
    composerTagInputRef,
    composerTitleInputRef,
    closeComposerTagEditor,
    setComposeCommunityMenuOpen,
  ]);

  function editMissingMarkdownMedia(status = {}) {
    setComposerContentViewMode("edit");
    focusComposerContent(status);
  }

  function handleComposerAssetPicked(event) {
    if (composerMode === "long") {
      setComposerContentViewMode("edit");
    }
    onComposerAssetPicked?.(event);
  }

  function restoreUnreferencedMarkdownMedia() {
    setComposerContentViewMode("edit");
    restoreUnreferencedMarkdownMediaRefs?.();
  }

  return (
    <section className="feed-grid">
      {!isLoggedIn && (
        <StatusCard
          title="请先登录后发布主帖"
          description="登录后就可以选择分区、上传图片并发布内容。"
          tone="empty"
        />
      )}
      {isLoggedIn && (
        <article className="composer-page composer-inline-page composer-paper">
          <form id="composer-form" onSubmit={submitPost} className="compose-inline-form">
            <ComposeHeader
              title={title}
              isTitlePreviewMode={isTitlePreviewMode}
              composerTags={composerTags}
              showTagEditor={showTagEditor}
              composerTagDraft={composerTagDraft}
              composerCommunityName={composerCommunityName}
              orderedCommunities={orderedCommunities}
              composerCommunitySlug={composerCommunitySlug}
              composeCommunityMenuOpen={composeCommunityMenuOpen}
              currentUser={currentUser}
              setTitle={setTitle}
              commitComposerTitlePreview={commitComposerTitlePreview}
              editComposerTitle={editComposerTitle}
              removeComposerTag={removeComposerTag}
              addComposerTag={addComposerTag}
              handleComposerTagInputKeyDown={handleComposerTagInputKeyDown}
              setComposerTagDraft={setComposerTagDraft}
              setComposerCommunitySlug={setComposerCommunitySlug}
              setComposeCommunityMenuOpen={setComposeCommunityMenuOpen}
              toggleComposerTagEditor={toggleComposerTagEditor}
              closeComposerTagEditor={closeComposerTagEditor}
              composerTitleInputRef={composerTitleInputRef}
              composerCommunityButtonRef={composerCommunityButtonRef}
              composerTagInputRef={composerTagInputRef}
              composerContentRef={composerContentRef}
              composeCommunityMenuRef={composeCommunityMenuRef}
              authorInitial={authorInitial}
              submitValidationTarget={submitValidationTarget}
              submitValidationStatusId={submitStatusId}
            />

            {composerMode === "rich" && (
              <ComposeMedia
                composerMediaUrls={composerMediaUrls}
                composerMediaAssets={composerMediaAssets}
                composerMediaIndex={composerMediaIndex}
                setComposerMediaIndex={setComposerMediaIndex}
                openImageViewer={openImageViewer}
                removeComposerMediaAt={removeComposerMediaAt}
                moveComposerMedia={moveComposerMedia}
              />
            )}

            {composerUploadStatus?.type && (
              <div
                className={`composer-upload-status ${composerUploadStatus.type}`}
                role={composerUploadStatus.type === "uploading" ? "status" : "alert"}
                aria-live={composerUploadStatus.type === "uploading" ? "polite" : "assertive"}
              >
                <span>{composerUploadStatus.message}</span>
                {composerUploadStatus.canRetry && (
                  <button
                    type="button"
                    className="composer-upload-retry-btn"
                    onClick={retryFailedComposerUploads}
                    disabled={uploadingAssets}
                  >
                    {composerUploadStatus.retryLabel || "重试"}
                  </button>
                )}
              </div>
            )}

            <ComposeContent
              composerMode={composerMode}
              content={content}
              viewMode={composerContentViewMode}
              handleComposerContentChange={handleComposerContentChange}
              composerContentRef={composerContentRef}
              closeComposerTagEditor={closeComposerTagEditor}
              composerMediaAssets={composerMediaAssets}
              openImageViewer={openImageViewer}
              onEditMissingMarkdownMedia={editMissingMarkdownMedia}
              onCleanMissingMarkdownMedia={cleanMissingMarkdownMediaRefs}
              onRestoreUnreferencedMarkdownMedia={restoreUnreferencedMarkdownMedia}
              submitValidationTarget={submitValidationTarget}
              submitValidationStatusId={submitStatusId}
            />

            {composerSubmitStatus?.type && (
              <div
                id={submitStatusId}
                className={`composer-submit-status ${composerSubmitStatus.type}`}
                role={composerSubmitStatus.type === "saving" ? "status" : "alert"}
                aria-live={composerSubmitStatus.type === "saving" ? "polite" : "assertive"}
              >
                <span>{composerSubmitStatus.message}</span>
                {composerSubmitStatus.canRetry && (
                  <button
                    type="submit"
                    className="composer-submit-retry-btn"
                    disabled={publishing || uploadingAssets}
                  >
                    {composerSubmitStatus.retryLabel || "重试"}
                  </button>
                )}
              </div>
            )}

            <ComposeTools
              composerCommunitySlug={composerCommunitySlug}
              uploadingAssets={uploadingAssets}
              publishing={publishing}
              editingPostId={editingPostId}
              setComposerMode={setComposerMode}
              onComposerAssetPicked={handleComposerAssetPicked}
              composerMode={composerMode}
              full={composerMediaAssets.length > 19}
              viewMode={composerContentViewMode}
              setViewMode={setComposerContentViewMode}
              markdownGuideOpen={markdownGuideOpen}
              setMarkdownGuideOpen={setMarkdownGuideOpen}
              closeComposerTagEditor={closeComposerTagEditor}
              composerUploadButtonRef={composerUploadButtonRef}
              submitValidationTarget={submitValidationTarget}
              submitValidationStatusId={submitStatusId}
            />
          </form>
        </article>
      )}
    </section>
  );
}
