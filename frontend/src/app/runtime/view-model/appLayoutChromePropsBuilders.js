import { buildForumGridProps, buildTopbarProps } from "./appLayoutBuilders";

export function buildAppChromeProps(dependencies) {
  return {
    topbarProps: buildTopbarProps(dependencies),
    forumGridProps: buildForumGridProps(dependencies),
  };
}
