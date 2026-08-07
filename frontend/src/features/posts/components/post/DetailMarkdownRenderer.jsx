import { useState } from "react";
import UiIcon from "../../../../shared/components/UiIcon";
import { extractMarkdownCodeText } from "../../../../shared/media/markdownRenderHelpers";
import {
  removeExternalMarkdownImages,
  removeMarkdownImages,
} from "../../../../shared/media/markdownContent";
import MarkdownRenderer from "../../../../shared/media/MarkdownRenderer";
import { copyTextToClipboard } from "../../../../shared/platform/clipboard";

function MarkdownCodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const codeText = extractMarkdownCodeText(children).replace(/\n$/, "");

  async function copyCode() {
    if (!codeText) {
      return;
    }
    try {
      await copyTextToClipboard(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="markdown-code-block">
      <button
        type="button"
        className={`markdown-code-copy ${copied ? "copied" : ""}`}
        onClick={copyCode}
        aria-label={copied ? "代码已复制" : "复制代码"}
        title={copied ? "已复制" : "复制代码"}
      >
        <UiIcon name={copied ? "check" : "copy"} />
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export default function DetailMarkdownRenderer({
  apiBase,
  selectedPost,
  openImageViewer,
}) {
  const renderedMarkdownContent = selectedPost?.postMode === "rich"
    ? removeMarkdownImages(selectedPost?.content || "")
    : removeExternalMarkdownImages(selectedPost?.content || "");

  if (!selectedPost) {
    return null;
  }

  return (
    <MarkdownRenderer
      apiBase={apiBase}
      content={renderedMarkdownContent}
      firstImageLoadKey={`${selectedPost.id || ""}:${renderedMarkdownContent}`}
      gateImagesAfterFirst={selectedPost.postMode === "long"}
      mediaAssets={selectedPost.mediaAssets}
      openImageViewer={openImageViewer}
      renderPre={({ children }) => (
        <MarkdownCodeBlock>{children}</MarkdownCodeBlock>
      )}
    />
  );
}
