import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ComposeMedia from "./ComposeMedia";

function renderComposeMedia(props = {}) {
  return renderToStaticMarkup(
    <ComposeMedia
      composerMediaUrls={[]}
      composerMediaAssets={[]}
      composerMediaIndex={0}
      setComposerMediaIndex={() => {}}
      openImageViewer={() => {}}
      moveComposerMedia={() => {}}
      removeComposerMediaAt={() => {}}
      {...props}
    />,
  );
}

describe("ComposeMedia", () => {
  it("renders processing media assets as rich gallery placeholders instead of hiding the preview", () => {
    const markup = renderComposeMedia({
      composerMediaUrls: [""],
      composerMediaAssets: [
        {
          id: 7,
          publicId: "asset-7",
          processingStatus: "PROCESSING",
          width: 1600,
          height: 900,
        },
      ],
    });

    expect(markup).toContain('class="compose-media-area"');
    expect(markup).toContain("图片处理中");
    expect(markup).toContain('class="post-rich-gallery-status is-processing"');
  });

  it("keeps legacy URL-only rich media previews working", () => {
    const markup = renderComposeMedia({
      composerMediaUrls: ["/media/legacy.webp"],
      composerMediaAssets: [],
    });

    expect(markup).toContain('class="compose-media-area"');
    expect(markup).toContain('src="/media/legacy.webp"');
  });
});
