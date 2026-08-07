import { Suspense, lazy } from "react";
import ConfirmDialog from "../shared/components/ConfirmDialog";
import Toast from "../shared/components/Toast";
import ForumGrid from "../features/shell/components/ForumGrid";
import Topbar from "../features/shell/components/topbar/Topbar";
import { useDocumentMetadata } from "../shared/platform/useDocumentMetadata";

const AuthModal = lazy(() => import("../features/auth/components/AuthModal"));
const FloatingActions = lazy(() => import("../shared/components/FloatingActions"));
const ImageLightbox = lazy(() => import("../shared/components/overlays/ImageLightbox"));

export function shouldRenderAuthModal(authModalProps) {
  return Boolean(authModalProps?.authModalOpen && !authModalProps?.isLoggedIn);
}

export function shouldRenderFloatingActions(floatingActionProps) {
  return Boolean(floatingActionProps?.show);
}

export default function AppLayout({
  chromeProps,
  overlayProps,
  metadataProps,
}) {
  useDocumentMetadata(metadataProps);
  const { topbarProps, forumGridProps } = chromeProps;
  const {
    authModalProps,
    floatingProps: { homeFloatingProps, postFloatingProps },
    toastProps,
    lightboxProps,
  } = overlayProps;
  const renderAuthModal = shouldRenderAuthModal(authModalProps);
  const renderHomeFloatingActions = shouldRenderFloatingActions(homeFloatingProps);
  const renderPostFloatingActions = shouldRenderFloatingActions(postFloatingProps);

  return (
    <div className="forum-app">
      <Topbar {...topbarProps} />
      <ForumGrid {...forumGridProps} />
      {renderAuthModal && (
        <Suspense fallback={null}>
          <AuthModal {...authModalProps} />
        </Suspense>
      )}
      <ConfirmDialog />
      {(renderHomeFloatingActions || renderPostFloatingActions) && (
        <Suspense fallback={null}>
          {renderHomeFloatingActions && <FloatingActions {...homeFloatingProps} />}
          {renderPostFloatingActions && <FloatingActions {...postFloatingProps} />}
        </Suspense>
      )}
      <Toast {...toastProps} />
      {lightboxProps && (
        <Suspense fallback={null}>
          <ImageLightbox {...lightboxProps} />
        </Suspense>
      )}
    </div>
  );
}
