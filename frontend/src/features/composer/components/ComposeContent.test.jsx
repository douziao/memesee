import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComposeContent from "./ComposeContent";

function renderComposeContent(props = {}) {
  return renderToStaticMarkup(
    <ComposeContent
      composerMode="long"
      content=""
      viewMode="preview"
      handleComposerContentChange={() => {}}
      composerContentRef={null}
      closeComposerTagEditor={() => {}}
      composerMediaAssets={[]}
      openImageViewer={() => {}}
      onEditMissingMarkdownMedia={() => {}}
      onCleanMissingMarkdownMedia={() => {}}
      onRestoreUnreferencedMarkdownMedia={() => {}}
      {...props}
    />,
  );
}

describe("ComposeContent", () => {
  it("explains why long-form preview is empty after external images are hidden", () => {
    const markup = renderComposeContent({
      content: "![外链图](https://example.com/image.jpg)",
    });

    expect(markup).toContain("预览为空：外链图片已被隐藏，请上传图片后用 media: 引用。");
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain("暂无预览内容。");
  });

  it("keeps the simple empty preview copy for truly empty drafts", () => {
    const markup = renderComposeContent({ content: "" });

    expect(markup).toContain("暂无预览内容。");
    expect(markup).not.toContain("外链图片已被隐藏");
  });
});
