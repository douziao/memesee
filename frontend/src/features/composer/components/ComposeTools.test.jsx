import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComposeTools, { buildComposerSubmitDisabledReason } from "./ComposeTools";

function renderComposeTools(props = {}) {
  return renderToStaticMarkup(
    <ComposeTools
      composerCommunitySlug="general"
      uploadingAssets={false}
      publishing={false}
      editingPostId={null}
      setComposerMode={() => {}}
      onComposerAssetPicked={() => {}}
      composerMode="long"
      full={false}
      viewMode="edit"
      setViewMode={() => {}}
      markdownGuideOpen={false}
      setMarkdownGuideOpen={() => {}}
      closeComposerTagEditor={() => {}}
      composerUploadButtonRef={null}
      {...props}
    />,
  );
}

describe("ComposeTools", () => {
  it("builds concise submit disabled reasons", () => {
    expect(buildComposerSubmitDisabledReason({ uploadingAssets: true, publishing: false, editingPostId: null }))
      .toBe("图片仍在上传，完成后即可发布。");
    expect(buildComposerSubmitDisabledReason({ uploadingAssets: false, publishing: true, editingPostId: "post-1" }))
      .toBe("正在保存修改，请稍候。");
    expect(buildComposerSubmitDisabledReason({ uploadingAssets: false, publishing: true, editingPostId: null }))
      .toBe("正在发布主帖，请稍候。");
    expect(buildComposerSubmitDisabledReason({ uploadingAssets: false, publishing: false, editingPostId: null }))
      .toBe("");
  });

  it("shows a full-capacity upload state when the composer already has 20 media assets", () => {
    const markup = renderComposeTools({ full: true });

    expect(markup).toContain("已满");
    expect(markup).toContain('class="compose-tool-btn compose-upload-btn file-btn disabled"');
    expect(markup).toContain("disabled");
  });

  it("keeps the upload action available while media capacity remains", () => {
    const markup = renderComposeTools();

    expect(markup).toContain("上传图片");
    expect(markup).not.toContain("已满");
  });

  it("keeps submit clickable without a selected community so validation can guide recovery", () => {
    const markup = renderComposeTools({ composerCommunitySlug: "" });

    expect(markup).toMatch(
      /<button type="submit" class="neo-btn composer-submit compose-submit-footer">确认发布<\/button>/,
    );
    expect(markup).toContain('class="compose-tool-btn compose-upload-btn file-btn disabled"');
    expect(markup).not.toContain("composer-submit-disabled-reason");
  });

  it("keeps submit disabled and described while uploads are in progress", () => {
    const markup = renderComposeTools({ uploadingAssets: true });

    expect(markup).toContain('aria-describedby="composer-submit-disabled-reason"');
    expect(markup).toMatch(
      /<button type="submit" class="neo-btn composer-submit compose-submit-footer" disabled="" aria-describedby="composer-submit-disabled-reason">确认发布<\/button>/,
    );
    expect(markup).toContain(
      '<div id="composer-submit-disabled-reason" class="composer-submit-disabled-reason" role="status" aria-live="polite">图片仍在上传，完成后即可发布。</div>',
    );
  });

  it("keeps submit disabled and described while publishing or saving", () => {
    const publishingMarkup = renderComposeTools({ publishing: true });
    const savingMarkup = renderComposeTools({ publishing: true, editingPostId: "post-1" });

    expect(publishingMarkup).toMatch(
      /<button type="submit" class="neo-btn composer-submit compose-submit-footer" disabled="" aria-describedby="composer-submit-disabled-reason">正在发布\.\.\.<\/button>/,
    );
    expect(publishingMarkup).toContain("正在发布主帖，请稍候。");

    expect(savingMarkup).toMatch(
      /<button type="submit" class="neo-btn composer-submit compose-submit-footer" disabled="" aria-describedby="composer-submit-disabled-reason">正在保存\.\.\.<\/button>/,
    );
    expect(savingMarkup).toContain("正在保存修改，请稍候。");
  });

  it("does not render a disabled reason while submit is enabled", () => {
    const markup = renderComposeTools();

    expect(markup).not.toContain("composer-submit-disabled-reason");
    expect(markup).not.toContain("aria-describedby");
  });
});
