import { describe, expect, it } from "vitest";
import { buildSubPostThreadActionLayoutInput } from "./appRuntimeLayoutSubPostThreadActionInputHelpers";
import { buildSubPostThreadStateLayoutInput } from "./appRuntimeLayoutSubPostThreadStateInputHelpers";

describe("buildSubPostThreadStateLayoutInput", () => {
  it("passes target sub-post status through to the detail panel", () => {
    const targetSubPostStatus = {
      kind: "located",
      targetSubPostId: 8,
    };

    expect(buildSubPostThreadStateLayoutInput({
      subPostThreadState: {
        showTopSubPostComposer: false,
        activeSubPostTarget: null,
        subPostInput: "",
        subPostMediaAssets: [{ id: 7 }],
        uploadingSubPostMedia: true,
        subPostMediaUploadStatus: { type: "uploading" },
        submittingSubPost: false,
        collapsedSubPostBranches: {},
        subPostMoreMenuId: "",
        targetSubPostStatus,
      },
    })).toMatchObject({
      targetSubPostStatus,
      subPostMediaAssets: [{ id: 7 }],
      uploadingSubPostMedia: true,
      subPostMediaUploadStatus: { type: "uploading" },
    });
  });
});

describe("buildSubPostThreadActionLayoutInput", () => {
  it("passes sub-post location and share actions through to the detail panel", () => {
    const clearTargetSubPostLocation = () => {};
    const handleSubPostShareFromMenu = () => {};
    const copyTargetSubPostLink = () => {};
    const onSubPostMediaPicked = () => {};
    const retryFailedSubPostMediaUploads = () => {};
    const refreshSubPostMediaAssets = () => {};
    const removeSubPostMediaAt = () => {};

    expect(buildSubPostThreadActionLayoutInput({
      subPostThreadState: {
        openMainPostSubPostComposer: () => {},
        setSubPostInput: () => {},
        onSubPostMediaPicked,
        retryFailedSubPostMediaUploads,
        refreshSubPostMediaAssets,
        removeSubPostMediaAt,
        submitSubPost: () => {},
        cancelTopSubPostComposer: () => {},
        toggleSubPostBranches: () => {},
        jumpToSubPostFloor: () => {},
        clearTargetSubPostLocation,
        toggleSubPostMoreMenu: () => {},
        handleSubPostFavoriteFromMenu: () => {},
        handleSubPostShareFromMenu,
        copyTargetSubPostLink,
        handleSubPostReport: () => {},
        startNestedSubPostComposer: () => {},
        cancelNestedSubPostComposer: () => {},
        toggleSubPostLike: () => {},
        deleteSubPost: () => {},
      },
    })).toMatchObject({
      clearTargetSubPostLocation,
      handleSubPostShareFromMenu,
      copyTargetSubPostLink,
      onSubPostMediaPicked,
      retryFailedSubPostMediaUploads,
      refreshSubPostMediaAssets,
      removeSubPostMediaAt,
    });
  });
});
