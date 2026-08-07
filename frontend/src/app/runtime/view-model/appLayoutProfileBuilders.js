import {
  buildProfileStatusProps,
  buildProfileOverviewProps,
  buildProfileCommunityPostsProps,
  buildProfileLibraryPageProps,
  buildProfileNotificationPageProps,
} from "./appLayoutProfileSectionBuilders";

export function buildProfileCenterProps(dependencies) {
  return {
    statusProps: buildProfileStatusProps(dependencies),
    overviewProps: buildProfileOverviewProps(dependencies),
    communityPostsProps: buildProfileCommunityPostsProps(dependencies),
    libraryPageProps: buildProfileLibraryPageProps(dependencies),
    notificationPageProps: buildProfileNotificationPageProps(dependencies),
  };
}
