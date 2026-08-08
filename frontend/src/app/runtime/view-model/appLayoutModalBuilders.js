export function buildAuthModalProps({ shell, auth }) {
  return {
    authModalOpen: auth.authModalOpen,
    isLoggedIn: shell.isLoggedIn,
    mode: auth.mode,
    username: auth.username,
    password: auth.password,
    authing: auth.authing,
    setMode: auth.setMode,
    setUsername: auth.setUsername,
    setPassword: auth.setPassword,
    submitAuth: auth.submitAuth,
    closeAuthModal: auth.closeAuthModal,
  };
}

export function buildLightboxProps({ shell }) {
  return shell.imageViewer
    ? {
        images: shell.imageViewer.images,
        originalImages: shell.imageViewer.originalImages,
        imageSources: shell.imageViewer.imageSources,
        startIndex: shell.imageViewer.index,
        onClose: shell.closeImageViewer,
      }
    : null;
}
