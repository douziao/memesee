import {
  buildComposerSessionProps,
  buildComposerContentProps,
  buildComposerCommunityProps,
  buildComposerMediaProps,
  buildComposerActionProps,
  buildComposerRefProps,
} from "./appLayoutComposerSectionBuilders";

export function buildComposerPageProps(dependencies) {
  return {
    ...buildComposerSessionProps(dependencies),
    ...buildComposerContentProps(dependencies),
    ...buildComposerCommunityProps(dependencies),
    ...buildComposerMediaProps(dependencies),
    ...buildComposerActionProps(dependencies),
    ...buildComposerRefProps(dependencies),
  };
}
