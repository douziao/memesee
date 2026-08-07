import { describe, expect, it } from "vitest";
import { buildMainPostActionLayoutInput } from "./appRuntimeLayoutActionInputHelpers";

describe("buildMainPostActionLayoutInput", () => {
  it("passes sharing state helpers through to detail interaction props", () => {
    const sharePost = () => {};
    const isSharingPost = () => false;

    expect(buildMainPostActionLayoutInput({
      mainPostActions: {
        feedSortLabel: () => "",
        deletePost: () => {},
        openPostDetail: () => {},
        prefetchMainPostDetail: () => {},
        sharePost,
        isSharingPost,
      },
    })).toMatchObject({
      sharePost,
      isSharingPost,
    });
  });
});
