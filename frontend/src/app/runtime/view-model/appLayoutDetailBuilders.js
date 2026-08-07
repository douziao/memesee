import {
  buildDetailStatusProps,
  buildDetailHeaderProps,
  buildDetailGalleryProps,
  buildDetailContentProps,
  buildDetailInteractionProps,
  buildSubPostPanelProps,
} from "./appLayoutDetailSectionBuilders";

export function buildPostDetailProps(dependencies) {
  return {
    statusProps: buildDetailStatusProps(dependencies),
    headerProps: buildDetailHeaderProps(dependencies),
    galleryProps: buildDetailGalleryProps(dependencies),
    contentProps: buildDetailContentProps(dependencies),
    interactionProps: buildDetailInteractionProps(dependencies),
    subPostPanelProps: buildSubPostPanelProps(dependencies),
  };
}
