import { useMemo, useState } from "react";
import MarkdownMediaImage from "./MarkdownMediaImage";
import { parseMarkdownBlocks, parseMarkdownInlineSegments } from "./markdownParser";
import {
  buildMarkdownImageGallery,
  buildMarkdownMediaAssetMap,
  findMarkdownImageGalleryStartIndex,
  resolveMarkdownImageData,
} from "./markdownImages";
import {
  normalizeMarkdownLinkHref,
} from "./markdownRenderHelpers";

function renderInlineTextSegments(text, renderSegment, keyPrefix) {
  return parseMarkdownInlineSegments(text).map((segment, index) =>
    renderSegment(segment, `${keyPrefix}-${index}`),
  );
}

function hasTaskListItems(items = []) {
  return items.some((item) =>
    item.checked !== null ||
    (Array.isArray(item.children) && item.children.some((child) => hasTaskListItems(child.items))),
  );
}

export default function MarkdownRenderer({
  apiBase = "",
  content,
  mediaAssets,
  openImageViewer,
  renderPre,
  firstImageLoadKey = "",
  gateImagesAfterFirst = false,
}) {
  const [firstImageLoadedKey, setFirstImageLoadedKey] = useState("");
  const firstImageLoaded = firstImageLoadedKey === firstImageLoadKey;
  const mediaAssetMap = useMemo(
    () => buildMarkdownMediaAssetMap(mediaAssets),
    [mediaAssets],
  );
  const markdownImageGallery = useMemo(
    () => buildMarkdownImageGallery({ content, mediaAssetMap, apiBase }),
    [apiBase, content, mediaAssetMap],
  );
  const viewerImages = markdownImageGallery.map((entry) => entry.imageUrl);
  const viewerOriginalImages = markdownImageGallery.map((entry) => entry.originalUrl);
  const viewerImageSources = markdownImageGallery.map((entry) => entry.imageSource);
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const markdownSourceOccurrenceCounts = new Map();
  let markdownImageRenderIndex = 0;
  const renderInlineSegment = (segment, key) => {
    if (segment.type === "link") {
      const normalized = normalizeMarkdownLinkHref(segment.href, apiBase);
      const children = renderInlineTextSegments(segment.text, renderInlineSegment, `${key}-link`);
      if (!normalized) {
        return <span key={key}>{children}</span>;
      }
      return (
        <a key={key} href={normalized} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
    if (segment.type === "autoLink") {
      const normalized = normalizeMarkdownLinkHref(segment.href, apiBase);
      if (!normalized) {
        return <span key={key}>{segment.text}</span>;
      }
      return (
        <a key={key} href={normalized} target="_blank" rel="noreferrer">
          {segment.text}
        </a>
      );
    }
    if (segment.type === "image") {
      const imageOccurrenceIndex = markdownImageRenderIndex;
      markdownImageRenderIndex += 1;
      const sourceSrc = String(segment.href || "").trim();
      const sourceOccurrenceIndex = markdownSourceOccurrenceCounts.get(sourceSrc) || 0;
      markdownSourceOccurrenceCounts.set(sourceSrc, sourceOccurrenceIndex + 1);
      const imageData = resolveMarkdownImageData({
        src: segment.href,
        alt: segment.text,
        mediaAssetMap,
        apiBase,
      });
      if (!imageData) {
        return null;
      }
      const shouldPrioritizeImage = gateImagesAfterFirst && imageOccurrenceIndex === 0;
      const shouldDeferImage = gateImagesAfterFirst && imageOccurrenceIndex > 0;
      const viewerStartIndex = markdownImageGallery.length > 0
        ? findMarkdownImageGalleryStartIndex({
          gallery: markdownImageGallery,
          src: sourceSrc,
          imageUrl: imageData.imageUrl,
          sourceOccurrenceIndex,
        })
        : undefined;
      return (
        <MarkdownMediaImage
          key={key}
          {...imageData}
          openImageViewer={openImageViewer}
          viewerImages={viewerImages}
          viewerOriginalImages={viewerOriginalImages}
          viewerImageSources={viewerImageSources}
          viewerStartIndex={viewerStartIndex}
          loading={shouldPrioritizeImage ? "eager" : "lazy"}
          fetchPriority={shouldPrioritizeImage ? "high" : "low"}
          deferLoad={shouldDeferImage}
          holdLoad={shouldDeferImage && !firstImageLoaded}
          onLoadStateChange={shouldPrioritizeImage
            ? (nextState) => {
              if (nextState?.loaded || nextState?.failed) {
                setFirstImageLoadedKey(firstImageLoadKey);
              }
            }
            : undefined}
        />
      );
    }
    if (segment.type === "code") {
      return <code key={key}>{segment.text}</code>;
    }
    if (segment.type === "strong") {
      return <strong key={key}>{renderInlineTextSegments(segment.text, renderInlineSegment, `${key}-strong`)}</strong>;
    }
    if (segment.type === "delete") {
      return <del key={key}>{renderInlineTextSegments(segment.text, renderInlineSegment, `${key}-delete`)}</del>;
    }
    if (segment.type === "em") {
      return <em key={key}>{renderInlineTextSegments(segment.text, renderInlineSegment, `${key}-em`)}</em>;
    }
    return segment.text;
  };
  const renderInlineLines = (lines, keyPrefix) => lines.flatMap((line, index) => [
    ...(index > 0 ? [<br key={`${keyPrefix}-br-${index}`} />] : []),
    ...renderInlineTextSegments(line, renderInlineSegment, `${keyPrefix}-${index}`),
  ]);
  const renderCell = (cell, key) => renderInlineTextSegments(cell, renderInlineSegment, key);
  const renderList = (block, key) => {
    const ListTag = block.ordered ? "ol" : "ul";
    const hasTasks = hasTaskListItems(block.items);
    return (
      <ListTag key={key} className={hasTasks ? "contains-task-list" : undefined}>
        {block.items.map((item, itemIndex) => (
          <li
            key={`${key}-item-${itemIndex}`}
            className={item.checked !== null ? "task-list-item" : undefined}
          >
            {item.checked !== null && (
              <input type="checkbox" checked={item.checked} disabled readOnly />
            )}
            {renderInlineTextSegments(item.text, renderInlineSegment, `${key}-item-${itemIndex}`)}
            {Array.isArray(item.children) && item.children.map((child, childIndex) =>
              renderList(child, `${key}-item-${itemIndex}-child-${childIndex}`),
            )}
          </li>
        ))}
      </ListTag>
    );
  };
  const renderBlock = (block, index) => {
    const key = `markdown-block-${index}`;
    if (block.type === "heading") {
      const Tag = `h${block.level}`;
      return <Tag key={key}>{renderInlineLines(block.lines, key)}</Tag>;
    }
    if (block.type === "code") {
      return renderPre
        ? <div key={key}>{renderPre({ children: block.text })}</div>
        : <pre key={key}><code>{block.text}</code></pre>;
    }
    if (block.type === "blockquote") {
      return <blockquote key={key}><p>{renderInlineLines(block.lines, key)}</p></blockquote>;
    }
    if (block.type === "hr") {
      return <hr key={key} />;
    }
    if (block.type === "list") {
      return renderList(block, key);
    }
    if (block.type === "table") {
      return (
        <div key={key} className="markdown-table-scroll" role="region" tabIndex={0} aria-label="Markdown 表格">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th key={`${key}-head-${cellIndex}`} style={block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined}>
                    {renderCell(cell, `${key}-head-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`}>
                  {block.header.map((_, cellIndex) => (
                    <td key={`${key}-row-${rowIndex}-${cellIndex}`} style={block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined}>
                      {renderCell(row[cellIndex] || "", `${key}-row-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <p key={key}>{renderInlineLines(block.lines, key)}</p>;
  };

  return blocks.map(renderBlock);
}
