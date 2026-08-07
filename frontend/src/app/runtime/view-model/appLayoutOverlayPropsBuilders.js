import {
  buildAuthModalProps,
  buildHomeFloatingProps,
  buildLightboxProps,
  buildPostFloatingProps,
  buildToastProps,
} from "./appLayoutBuilders";

export function buildAppOverlayProps(dependencies) {
  return {
    authModalProps: buildAuthModalProps(dependencies),
    floatingProps: {
      homeFloatingProps: buildHomeFloatingProps(dependencies),
      postFloatingProps: buildPostFloatingProps(dependencies),
    },
    toastProps: buildToastProps(dependencies),
    lightboxProps: buildLightboxProps(dependencies),
  };
}
