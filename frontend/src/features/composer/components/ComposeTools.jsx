import UiIcon from "../../../shared/components/UiIcon";

const GUIDE_IMAGE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='220' viewBox='0 0 360 220'%3E%3Crect width='360' height='220' rx='24' fill='%23f7e9b9'/%3E%3Ccircle cx='275' cy='66' r='34' fill='%23ffbf69'/%3E%3Cpath d='M0 165 92 92l76 56 52-38 140 92v18H0z' fill='%237cc7b2'/%3E%3Cpath d='M0 190 122 118l78 46 44-25 116 63v18H0z' fill='%233d8f83'/%3E%3C/svg%3E";

const MARKDOWN_GUIDE_ITEMS = [
  {
    label: "标题",
    syntax: "# 一级标题\n## 二级标题\n### 三级标题",
    effect: (
      <div className="markdown-guide-effect">
        <h1>一级标题</h1>
        <h2>二级标题</h2>
        <h3>三级标题</h3>
      </div>
    ),
  },
  {
    label: "强调",
    syntax: "**加粗文字**\n*斜体文字*\n~~删除线~~",
    effect: (
      <div className="markdown-guide-effect">
        <strong>加粗文字</strong>
        <em>斜体文字</em>
        <del>删除线</del>
      </div>
    ),
  },
  {
    label: "列表",
    syntax: "- 第一项\n- 第二项\n\n1. 第一步\n2. 第二步",
    effect: (
      <div className="markdown-guide-effect markdown-guide-lists">
        <ul>
          <li>第一项</li>
          <li>第二项</li>
        </ul>
        <ol>
          <li>第一步</li>
          <li>第二步</li>
        </ol>
      </div>
    ),
  },
  {
    label: "引用",
    syntax: "> 这里是一段引用\n> 可以连续写多行",
    effect: (
      <blockquote className="markdown-guide-quote">
        <p>这里是一段引用</p>
        <p>可以连续写多行</p>
      </blockquote>
    ),
  },
  {
    label: "链接",
    syntax: "[显示文字](https://example.com)",
    effect: (
      <a className="markdown-guide-link" href="https://example.com" target="_blank" rel="noreferrer">
        显示文字
      </a>
    ),
  },
  {
    label: "图片",
    syntax: "![图片说明](media:图片ID)",
    effect: (
      <span className="markdown-guide-image-frame">
        <img src={GUIDE_IMAGE_SRC} alt="图片说明" />
      </span>
    ),
  },
  {
    label: "图片大小",
    syntax: "![图片说明|300](media:图片ID)\n![图片说明|300x300](media:图片ID)\n![图片说明|width=60%](media:图片ID)",
    effect: (
      <div className="markdown-guide-sized-images">
        <span className="markdown-guide-image-frame small">
          <img src={GUIDE_IMAGE_SRC} alt="宽 120" />
        </span>
        <span className="markdown-guide-image-frame square">
          <img src={GUIDE_IMAGE_SRC} alt="最大 86 x 86" />
        </span>
      </div>
    ),
  },
  {
    label: "代码",
    syntax: "`行内代码`\n\n```js\nconsole.log(\"hello\")\n```",
    effect: (
      <div className="markdown-guide-effect">
        <p>
          这是 <code>行内代码</code>
        </p>
        <pre>{"console.log(\"hello\")"}</pre>
      </div>
    ),
  },
  {
    label: "分割线",
    syntax: "---",
    effect: <hr className="markdown-guide-hr" />,
  },
  {
    label: "表格",
    syntax: "| 名称 | 数值 |\n| --- | --- |\n| A | 1 |\n| B | 2 |",
    effect: (
      <table className="markdown-guide-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>数值</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A</td>
            <td>1</td>
          </tr>
          <tr>
            <td>B</td>
            <td>2</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    label: "任务",
    syntax: "- [ ] 待完成\n- [x] 已完成",
    effect: (
      <div className="markdown-guide-tasks">
        <label><input type="checkbox" readOnly /> 待完成</label>
        <label><input type="checkbox" checked readOnly /> 已完成</label>
      </div>
    ),
  },
  {
    label: "换行",
    syntax: "第一行\n第二行\n\n新的段落",
    effect: (
      <div className="markdown-guide-effect">
        <p>第一行<br />第二行</p>
        <p>新的段落</p>
      </div>
    ),
  },
];

const COMPOSER_SUBMIT_DISABLED_REASON_ID = "composer-submit-disabled-reason";

export function buildComposerSubmitDisabledReason({ uploadingAssets, publishing, editingPostId }) {
  if (uploadingAssets) {
    return "图片仍在上传，完成后即可发布。";
  }

  if (publishing && editingPostId) {
    return "正在保存修改，请稍候。";
  }

  if (publishing) {
    return "正在发布主帖，请稍候。";
  }

  return "";
}

export default function ComposeTools({
  composerCommunitySlug,
  uploadingAssets,
  publishing,
  editingPostId,
  setComposerMode,
  onComposerAssetPicked,
  composerMode,
  full,
  viewMode,
  setViewMode,
  markdownGuideOpen,
  setMarkdownGuideOpen,
  closeComposerTagEditor,
  composerUploadButtonRef,
  submitValidationTarget,
  submitValidationStatusId,
}) {
  const isPreviewing = viewMode === "preview";
  const uploadDisabled = uploadingAssets || !composerCommunitySlug || full;
  const invalidMedia = submitValidationTarget === "media";
  const submitDisabled = publishing || uploadingAssets;
  const submitDisabledReason = buildComposerSubmitDisabledReason({ uploadingAssets, publishing, editingPostId });
  const guideItems = composerMode === "long"
    ? MARKDOWN_GUIDE_ITEMS
    : MARKDOWN_GUIDE_ITEMS.filter((item) => item.label !== "图片" && item.label !== "图片大小");

  return (
    <>
      <div className="detail-interact-wrap compose-preview-interact">
        <div className="detail-interact-topline compose-preview-topline">
          <div className="detail-interact-edited-slot" />
          <div className="detail-interact-meta detail-interact-meta-plain compose-preview-meta">
            <span className="detail-interact-meta-text">{"\u6d4f\u89c8 0"}</span>
            <span className="detail-interact-meta-text">{"\u70ed\u5ea6 0.0"}</span>
          </div>
        </div>

        <div className="detail-interact-mainline compose-preview-mainline">
          <div className="compose-preview-mainline-spacer" />
          <div className="detail-interact-bar detail-interact-bar-post compose-preview-actions">
            <button type="button" className="detail-interact-btn detail-interact-btn-large compose-preview-btn" disabled aria-label="预览点赞按钮">
              <span className="action-icon"><UiIcon name="heart" /></span>
              <span className="action-label">点赞</span>
            </button>
            <button type="button" className="detail-interact-btn detail-interact-btn-large compose-preview-btn" disabled aria-label="预览更多按钮">
              <span className="action-icon"><UiIcon name="more" /></span>
              <span className="action-label">更多</span>
            </button>
            <button type="button" className="detail-interact-btn detail-interact-btn-large compose-preview-btn" disabled aria-label="预览子帖按钮">
              <span className="action-icon"><UiIcon name="sub-post" /></span>
              <span className="action-label">子帖</span>
            </button>
          </div>
        </div>
      </div>

      <section className="compose-tools-block detail-section-block">
        <div className="compose-tools-row">
          <div className="compose-inline-actions-left">
            <div className="compose-tool-group compose-tool-group-primary">
              <div className="compose-mode-switch" role="group" aria-label="发布模式">
                <button type="button" className={`compose-mode-btn ${composerMode === "long" ? "active" : ""}`} onClick={() => setComposerMode("long")}>
                  长文
                </button>
                <button type="button" className={`compose-mode-btn ${composerMode === "rich" ? "active" : ""}`} onClick={() => setComposerMode("rich")}>
                  图文
                </button>
              </div>
            </div>

            <div className="compose-tool-group compose-tool-group-secondary">
              <label
                ref={composerUploadButtonRef}
                className={`compose-tool-btn compose-upload-btn file-btn ${uploadDisabled ? "disabled" : ""}`}
                tabIndex={uploadDisabled ? -1 : 0}
                aria-invalid={invalidMedia || undefined}
                aria-describedby={invalidMedia ? submitValidationStatusId : undefined}
              >
                <UiIcon name="grid" />
                <span>{uploadingAssets ? "上传中..." : full ? "已满" : "上传图片"}</span>
                <input type="file" accept="image/*" multiple onChange={onComposerAssetPicked} disabled={uploadDisabled} />
              </label>

              <button
                type="button"
                className={`compose-markdown-guide-toggle ${markdownGuideOpen ? "active" : ""}`}
                onClick={() => {
                  closeComposerTagEditor();
                  setMarkdownGuideOpen((open) => !open);
                }}
                aria-expanded={markdownGuideOpen}
              >
                <UiIcon name="list" />
                <span>Markdown</span>
              </button>
            </div>
          </div>

          <div className="compose-inline-actions-right compose-tools-submit-wrap">
            <div className="compose-content-tabs compose-submit-tabs" role="tablist" aria-label="正文视图">
              <button type="button" className={`compose-content-tab ${!isPreviewing ? "active" : ""}`} onClick={() => setViewMode("edit")}>
                编辑
              </button>
              <button type="button" className={`compose-content-tab ${isPreviewing ? "active" : ""}`} onClick={() => setViewMode("preview")}>
                预览
              </button>
            </div>
            <button
              type="submit"
              className="neo-btn composer-submit compose-submit-footer"
              disabled={submitDisabled}
              aria-describedby={submitDisabledReason ? COMPOSER_SUBMIT_DISABLED_REASON_ID : undefined}
            >
              {publishing
                ? editingPostId
                  ? "正在保存..."
                  : "正在发布..."
                : editingPostId
                  ? "保存修改"
                  : "确认发布"}
            </button>
            {submitDisabledReason && (
              <div
                id={COMPOSER_SUBMIT_DISABLED_REASON_ID}
                className="composer-submit-disabled-reason"
                role="status"
                aria-live="polite"
              >
                {submitDisabledReason}
              </div>
            )}
          </div>
        </div>

        {markdownGuideOpen && (
          <div className="compose-markdown-guide">
            {guideItems.map((item) => (
              <div className="compose-markdown-guide-row" key={item.label}>
                <div className="compose-markdown-guide-copy">
                  <span className="compose-markdown-guide-label">{item.label}</span>
                  <code>{item.syntax}</code>
                </div>
                <div className="compose-markdown-guide-preview" aria-label={`${item.label} 示例效果`}>
                  {item.effect}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
