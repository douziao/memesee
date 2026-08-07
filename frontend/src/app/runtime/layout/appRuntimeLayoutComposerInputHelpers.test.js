import { describe, expect, it } from "vitest";
import { buildComposerActionLayoutInput } from "./appRuntimeLayoutComposerActionInputHelpers";
import { buildComposerStateLayoutInput } from "./appRuntimeLayoutComposerStateInputHelpers";

describe("composer runtime layout input helpers", () => {
  it("passes composer feedback state through to the page view-model", () => {
    const composerUploadStatus = {
      type: "uploading",
      message: "上传中...",
    };
    const composerSubmitStatus = {
      type: "validation",
      message: "请选择社区。",
      focusTarget: "community",
    };

    expect(buildComposerStateLayoutInput({
      composerDraft: {
        title: "标题",
        isTitlePreviewMode: false,
        composerTags: [],
        showTagEditor: false,
        composerTagDraft: "",
        composerMode: "long",
        composerMediaUrls: [],
        composerMediaAssets: [],
        composerMediaIndex: 0,
        composerUploadStatus,
        content: "正文",
        composerSubmitStatus,
        composerCommunityName: "大厅",
        composerCommunitySlug: "general",
        composeCommunityMenuOpen: false,
        uploadingAssets: true,
        publishing: false,
        editingMainPostId: null,
      },
    })).toMatchObject({
      composerUploadStatus,
      composerSubmitStatus,
      uploadingAssets: true,
    });
  });

  it("passes upload retry actions through to the page view-model", () => {
    const retryFailedComposerUploads = () => {};
    const submitPost = () => {};

    expect(buildComposerActionLayoutInput({
      composerDraft: {
        setTitle: () => {},
        commitComposerTitlePreview: () => {},
        editComposerTitle: () => {},
        removeComposerTag: () => {},
        addComposerTag: () => {},
        closeComposerTagEditor: () => {},
        handleComposerTagInputKeyDown: () => {},
        toggleComposerTagEditor: () => {},
        setComposerMediaIndex: () => {},
        removeComposerMediaAt: () => {},
        moveComposerMedia: () => {},
        handleComposerContentChange: () => {},
        setComposerCommunitySlug: () => {},
        setComposeCommunityMenuOpen: () => {},
        setComposerMode: () => {},
        setComposerTagDraft: () => {},
        onComposerAssetPicked: () => {},
        retryFailedComposerUploads,
        submitPost,
      },
    })).toMatchObject({
      retryFailedComposerUploads,
      submitPost,
    });
  });
});
