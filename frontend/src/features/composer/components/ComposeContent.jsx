import { useMemo } from "react";
import {
  removeExternalMarkdownImages,
  removeMarkdownImages,
} from "../../../shared/media/markdownContent";
import MarkdownRenderer from "../../../shared/media/MarkdownRenderer";
import {
  buildComposerMarkdownMediaEditorStatus,
  buildComposerMarkdownMediaPreviewStatus,
  buildComposerMarkdownMediaUsageStatus,
} from "../state/composerMarkdownStatusHelpers";

export default function ComposeContent({
  composerMode,
  content,
  viewMode,
  handleComposerContentChange,
  composerContentRef,
  closeComposerTagEditor,
  composerMediaAssets,
  openImageViewer,
  onEditMissingMarkdownMedia,
  onCleanMissingMarkdownMedia,
  onRestoreUnreferencedMarkdownMedia,
  submitValidationTarget,
  submitValidationStatusId,
}) {
  const isPreviewing = viewMode === "preview";
  const markdownPreviewContent = useMemo(
    () => composerMode === "long"
      ? removeExternalMarkdownImages(content)
      : removeMarkdownImages(content),
    [composerMode, content],
  );
  const markdownMediaPreviewStatus = useMemo(
    () => composerMode === "long"
      ? buildComposerMarkdownMediaPreviewStatus({
        content,
        composerMediaAssets,
      })
      : { type: "" },
    [composerMediaAssets, composerMode, content],
  );
  const markdownMediaEditorStatus = useMemo(
    () => composerMode === "long"
      ? buildComposerMarkdownMediaEditorStatus({
        content,
        composerMediaAssets,
      })
      : { type: "" },
    [composerMediaAssets, composerMode, content],
  );
  const markdownMediaUsageStatus = useMemo(
    () => composerMode === "long"
      ? buildComposerMarkdownMediaUsageStatus({
        content,
        composerMediaAssets,
      })
      : { type: "" },
    [composerMediaAssets, composerMode, content],
  );
  const contentHasPreviewableText = markdownPreviewContent.trim();
  const shouldExplainEmptyLongPreview = composerMode === "long" &&
    String(content || "").trim() &&
    !contentHasPreviewableText;
  const invalidContent = submitValidationTarget === "content";

  return (
    <div className="post-detail-content article-content compose-content-shell">
      <textarea
        ref={composerContentRef}
        className={`compose-content-input ${isPreviewing ? "is-preview-hidden" : ""}`}
        placeholder={
          composerMode === "long"
            ? "在正文区域直接写长文，支持 Markdown。"
            : "添加图文说明，可留空。"
        }
        value={content}
        onFocus={closeComposerTagEditor}
        onChange={handleComposerContentChange}
        required={!isPreviewing && composerMode === "long"}
        aria-hidden={isPreviewing}
        tabIndex={isPreviewing ? -1 : undefined}
        aria-invalid={invalidContent || undefined}
        aria-describedby={invalidContent ? submitValidationStatusId : undefined}
      />

      {!isPreviewing && markdownMediaEditorStatus.type && (
        <div
          className={`composer-preview-status composer-editor-status ${markdownMediaEditorStatus.type}`}
          role="status"
          aria-live="polite"
        >
          <span>{markdownMediaEditorStatus.message}</span>
          <div className="composer-preview-status-actions">
            <button
              type="button"
              className="composer-preview-status-btn"
              onClick={() => onEditMissingMarkdownMedia?.(markdownMediaEditorStatus)}
            >
              {markdownMediaEditorStatus.actionLabel}
            </button>
            <button
              type="button"
              className="composer-preview-status-btn danger"
              onClick={() => onCleanMissingMarkdownMedia?.(markdownMediaEditorStatus)}
            >
              {markdownMediaEditorStatus.cleanActionLabel}
            </button>
          </div>
        </div>
      )}

      {!isPreviewing && !markdownMediaEditorStatus.type && markdownMediaUsageStatus.type && (
        <div
          className={`composer-preview-status composer-editor-status ${markdownMediaUsageStatus.type}`}
          role="status"
          aria-live="polite"
        >
          <span>{markdownMediaUsageStatus.message}</span>
          <div className="composer-preview-status-actions">
            <button
              type="button"
              className="composer-preview-status-btn"
              onClick={() => onRestoreUnreferencedMarkdownMedia?.(markdownMediaUsageStatus)}
            >
              {markdownMediaUsageStatus.actionLabel}
            </button>
          </div>
        </div>
      )}

      {isPreviewing && (
        <div className="markdown-content compose-markdown-preview">
          {markdownMediaPreviewStatus.type && (
            <div className={`composer-preview-status ${markdownMediaPreviewStatus.type}`} role="alert">
              <span>{markdownMediaPreviewStatus.message}</span>
              <div className="composer-preview-status-actions">
                <button
                  type="button"
                  className="composer-preview-status-btn"
                  onClick={() => onEditMissingMarkdownMedia?.(markdownMediaPreviewStatus)}
                >
                  {markdownMediaPreviewStatus.actionLabel}
                </button>
                <button
                  type="button"
                  className="composer-preview-status-btn danger"
                  onClick={() => onCleanMissingMarkdownMedia?.(markdownMediaPreviewStatus)}
                >
                  {markdownMediaPreviewStatus.cleanActionLabel}
                </button>
              </div>
            </div>
          )}
          {!markdownMediaPreviewStatus.type && markdownMediaUsageStatus.type && (
            <div className={`composer-preview-status ${markdownMediaUsageStatus.type}`} role="status" aria-live="polite">
              <span>{markdownMediaUsageStatus.message}</span>
              <div className="composer-preview-status-actions">
                <button
                  type="button"
                  className="composer-preview-status-btn"
                  onClick={() => onRestoreUnreferencedMarkdownMedia?.(markdownMediaUsageStatus)}
                >
                  {markdownMediaUsageStatus.actionLabel}
                </button>
              </div>
            </div>
          )}
          {contentHasPreviewableText ? (
            <MarkdownRenderer
              content={markdownPreviewContent}
              mediaAssets={composerMediaAssets}
              openImageViewer={openImageViewer}
            />
          ) : (
            <p className="paper-inline-status compose-markdown-empty" role={shouldExplainEmptyLongPreview ? "status" : undefined}>
              {shouldExplainEmptyLongPreview
                ? "预览为空：外链图片已被隐藏，请上传图片后用 media: 引用。"
                : "暂无预览内容。"}
            </p>
          )}
        </div>
      )}

    </div>
  );
}
