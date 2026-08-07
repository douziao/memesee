import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComposerPage from "./ComposerPage";

function renderComposerPage(props = {}) {
  return renderToStaticMarkup(
    <ComposerPage
      isLoggedIn
      title="测试标题"
      isTitlePreviewMode={false}
      composerTags={[]}
      showTagEditor={false}
      composerTagDraft=""
      currentUser="alice"
      composerMode="long"
      composerMediaUrls={[]}
      composerMediaIndex={0}
      composerMediaAssets={[]}
      composerUploadStatus={{ type: "" }}
      content="正文"
      composerSubmitStatus={{ type: "" }}
      composerCommunityName="大厅"
      orderedCommunities={[{ slug: "general", name: "大厅" }]}
      composerCommunitySlug="general"
      composeCommunityMenuOpen={false}
      uploadingAssets={false}
      publishing={false}
      editingPostId={null}
      setTitle={() => {}}
      commitComposerTitlePreview={() => {}}
      editComposerTitle={() => {}}
      removeComposerTag={() => {}}
      addComposerTag={() => {}}
      handleComposerTagInputKeyDown={() => {}}
      setComposerMediaIndex={() => {}}
      removeComposerMediaAt={() => {}}
      moveComposerMedia={() => {}}
      openImageViewer={() => {}}
      handleComposerContentChange={() => {}}
      cleanMissingMarkdownMediaRefs={() => {}}
      restoreUnreferencedMarkdownMediaRefs={() => {}}
      setComposerCommunitySlug={() => {}}
      setComposeCommunityMenuOpen={() => {}}
      setComposerMode={() => {}}
      toggleComposerTagEditor={() => {}}
      closeComposerTagEditor={() => {}}
      setComposerTagDraft={() => {}}
      onComposerAssetPicked={() => {}}
      retryFailedComposerUploads={() => {}}
      submitPost={() => {}}
      composerTitleInputRef={createRef()}
      composerTagInputRef={createRef()}
      composerContentRef={createRef()}
      composeCommunityMenuRef={createRef()}
      authorInitial={(name) => String(name || "?").slice(0, 1).toUpperCase()}
      {...props}
    />,
  );
}

describe("ComposerPage upload status", () => {
  it("renders retryable upload failures as assertive alerts with the retry label", () => {
    const markup = renderComposerPage({
      composerUploadStatus: {
        type: "warning",
        message: "上传 1 张图片，失败 1 张",
        canRetry: true,
        retryLabel: "重试失败图片",
      },
    });

    expect(markup).toContain('class="composer-upload-status warning"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain("上传 1 张图片，失败 1 张");
    expect(markup).toContain('class="composer-upload-retry-btn"');
    expect(markup).toContain(">重试失败图片</button>");
  });

  it("keeps retry controls disabled while another upload is running", () => {
    const markup = renderComposerPage({
      uploadingAssets: true,
      composerUploadStatus: {
        type: "error",
        message: "附件上传失败。 已上传的图片和正文草稿仍保留，可直接重试失败图片。",
        canRetry: true,
        retryLabel: "重试失败图片",
      },
    });

    expect(markup).toContain('class="composer-upload-status error"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain(">重试失败图片</button>");
  });
});

describe("ComposerPage submit status", () => {
  it("keeps the submit button clickable when community validation needs to run", () => {
    const markup = renderComposerPage({
      composerCommunitySlug: "",
      composerCommunityName: "",
    });

    expect(markup).toMatch(
      /<button type="submit" class="neo-btn composer-submit compose-submit-footer">确认发布<\/button>/,
    );
  });

  it("renders publish failures as assertive alerts with retry copy", () => {
    const markup = renderComposerPage({
      composerSubmitStatus: {
        type: "error",
        message: "网络连接失败 内容仍保留在编辑器中，可以修改后重试。",
        canRetry: true,
        retryLabel: "重试发布",
      },
    });

    expect(markup).toContain('class="composer-submit-status error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain("网络连接失败 内容仍保留在编辑器中，可以修改后重试。");
    expect(markup).toContain('class="composer-submit-retry-btn"');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain(">重试发布</button>");
  });

  it("links community validation feedback to the community picker", () => {
    const markup = renderComposerPage({
      composerCommunitySlug: "",
      composerCommunityName: "",
      composerSubmitStatus: {
        type: "validation",
        message: "请选择社区。",
        focusTarget: "community",
      },
    });

    expect(markup).toContain('id="composer-submit-status-message"');
    expect(markup).toContain('class="composer-submit-status validation"');
    expect(markup).toMatch(
      /<button type="button" class="detail-community-tag-text compose-taxonomy-community\s+empty"[^>]*aria-invalid="true"[^>]*aria-describedby="composer-submit-status-message"/,
    );
    expect(markup).toContain("请选择社区。");
  });

  it("links content validation feedback to the editor textarea", () => {
    const markup = renderComposerPage({
      content: "",
      composerSubmitStatus: {
        type: "validation",
        message: "请输入主帖内容。",
        focusTarget: "content",
      },
    });

    expect(markup).toMatch(
      /<textarea[^>]*class="compose-content-input "[^>]*aria-invalid="true"[^>]*aria-describedby="composer-submit-status-message"/,
    );
  });

  it("keeps submit retry disabled while image uploads are still running", () => {
    const markup = renderComposerPage({
      uploadingAssets: true,
      composerSubmitStatus: {
        type: "error",
        message: "网络连接失败 内容仍保留在编辑器中，可以修改后重试。",
        canRetry: true,
        retryLabel: "重试发布",
      },
    });

    expect(markup).toContain('class="composer-submit-status error"');
    expect(markup).toContain('class="composer-submit-retry-btn"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain(">重试发布</button>");
  });

  it("announces saving status politely without retry controls", () => {
    const markup = renderComposerPage({
      publishing: true,
      composerSubmitStatus: {
        type: "saving",
        message: "正在发布主帖...",
      },
    });

    expect(markup).toContain('class="composer-submit-status saving"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("正在发布主帖...");
    expect(markup).not.toContain('class="composer-submit-retry-btn"');
  });
});
