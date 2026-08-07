import { useEffect } from "react";
import UiIcon from "../../../shared/components/UiIcon";

function resizeTitleField(element) {
  if (!element) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function getTagDraftInputWidth(draft) {
  if (!draft) {
    return "4.8em";
  }
  const width = Array.from(draft).reduce((sum, char) => {
    return sum + (/[\x00-\x7F]/.test(char) ? 0.62 : 1.05);
  }, 1.2);
  return `${Math.min(12.8, Math.max(4.8, width))}em`;
}

export default function ComposeHeader({
  title,
  composerTags,
  showTagEditor,
  composerTagDraft,
  composerCommunityName,
  orderedCommunities,
  composerCommunitySlug,
  composeCommunityMenuOpen,
  currentUser,
  setTitle,
  commitComposerTitlePreview,
  removeComposerTag,
  addComposerTag,
  handleComposerTagInputKeyDown,
  setComposerTagDraft,
  setComposerCommunitySlug,
  setComposeCommunityMenuOpen,
  toggleComposerTagEditor,
  closeComposerTagEditor,
  composerTitleInputRef,
  composerCommunityButtonRef,
  composerTagInputRef,
  composerContentRef,
  composeCommunityMenuRef,
  authorInitial,
  submitValidationTarget,
  submitValidationStatusId,
}) {
  const titleMaxLength = 30;
  const previewAuthor = currentUser || "我";
  const tagTotalLength = composerTags.reduce((sum, tag) => sum + String(tag || "").length, 0);
  const tagDraftMaxLength = Math.max(0, 12 - tagTotalLength);
  const canShowTagInput = composerTags.length < 3 && tagDraftMaxLength > 0;
  const tagQuotaFull = composerTags.length >= 3 || tagDraftMaxLength <= 0;
  const invalidTitle = submitValidationTarget === "title";
  const invalidCommunity = submitValidationTarget === "community";
  const invalidTag = submitValidationTarget === "tag";
  const validationDescriptionId = submitValidationStatusId || undefined;

  useEffect(() => {
    resizeTitleField(composerTitleInputRef.current);
  }, [composerTitleInputRef, title]);

  return (
    <div className="compose-inline-head post-detail-head">
      <textarea
        ref={composerTitleInputRef}
        className="compose-title-input"
        placeholder="请输入标题"
        value={title}
        maxLength={titleMaxLength}
        rows={1}
        onFocus={closeComposerTagEditor}
        onChange={(event) => {
          setTitle(event.target.value.replace(/\r?\n/g, ""));
          resizeTitleField(event.currentTarget);
        }}
        onBlur={commitComposerTitlePreview}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }
          event.preventDefault();
          composerContentRef?.current?.focus();
        }}
        aria-invalid={invalidTitle || undefined}
        aria-describedby={invalidTitle ? validationDescriptionId : undefined}
      />
      <div className="detail-post-taxonomy compose-taxonomy-preview">
        <div className="compose-taxonomy-community-wrap" ref={composeCommunityMenuRef}>
          <button
            ref={composerCommunityButtonRef}
            type="button"
            className={`detail-community-tag-text compose-taxonomy-community ${composeCommunityMenuOpen ? "open" : ""} ${composerCommunityName ? "" : "empty"}`}
            onClick={() => setComposeCommunityMenuOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={composeCommunityMenuOpen}
            aria-invalid={invalidCommunity || undefined}
            aria-describedby={invalidCommunity ? validationDescriptionId : undefined}
          >
            <span>{composerCommunityName || "选择社区"}</span>
            <UiIcon name="chevron-down" className="compose-taxonomy-community-icon" />
          </button>

          <div className={`compose-community-menu compose-taxonomy-community-menu ${composeCommunityMenuOpen ? "open" : ""}`} role="listbox">
            {orderedCommunities.map((community) => (
              <button
                key={community.slug}
                type="button"
                className={`compose-community-option ${composerCommunitySlug === community.slug ? "active" : ""}`}
                onClick={() => {
                  setComposerCommunitySlug(community.slug);
                  setComposeCommunityMenuOpen(false);
                }}
              >
                {community.name}
              </button>
            ))}
          </div>
        </div>

        <div className="detail-tag-list compose-tag-preview-list">
          {composerTags.map((tag) => (
            <button
              key={`compose-tag-${tag}`}
              type="button"
              className="detail-tag-chip-text compose-tag-chip-editable"
              onClick={() => removeComposerTag(tag)}
              title="点击移除该 TAG"
            >
              <span>#{tag}</span>
              <span className="compose-tag-chip-remove" aria-hidden="true">×</span>
            </button>
          ))}

          {showTagEditor && canShowTagInput && (
            <span className="detail-tag-chip-text compose-tag-chip-input-shell">
              <span className="compose-tag-hash">#</span>
              <input
                ref={composerTagInputRef}
                className="compose-tag-chip-input"
                placeholder="添加TAG"
                value={composerTagDraft}
                onChange={(event) => setComposerTagDraft(event.target.value)}
                onKeyDown={handleComposerTagInputKeyDown}
                onBlur={closeComposerTagEditor}
                maxLength={tagDraftMaxLength}
                style={{ width: getTagDraftInputWidth(composerTagDraft) }}
                aria-invalid={invalidTag || undefined}
                aria-describedby={invalidTag ? validationDescriptionId : undefined}
              />
              <button
                type="button"
                className="compose-tag-chip-confirm"
                onClick={addComposerTag}
                disabled={!composerTagDraft.trim()}
                title="添加 TAG"
                aria-label="添加 TAG"
              >
                +
              </button>
            </span>
          )}

          {!showTagEditor && !tagQuotaFull && (
            <button
              type="button"
              className="detail-tag-chip-text compose-tag-chip-add"
              onClick={toggleComposerTagEditor}
              title="添加 TAG"
              aria-label="添加 TAG"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div className="post-detail-owner-top compose-owner-preview">
        <div className="post-author-avatar">{authorInitial(previewAuthor)}</div>
        <div className="post-detail-owner-meta">
          <strong className="post-author-name">{previewAuthor}</strong>
          <span>1分钟前</span>
        </div>
      </div>
    </div>
  );
}
