export function buildAuthStateLayoutInput({ authSession }) {
  return {
    authModalOpen: authSession.authModalOpen,
    mode: authSession.mode,
    username: authSession.username,
    password: authSession.password,
    authing: authSession.authing,
  };
}

export function buildAuthActionLayoutInput({ authSession }) {
  return {
    setMode: authSession.setMode,
    setUsername: authSession.setUsername,
    setPassword: authSession.setPassword,
    submitAuth: authSession.submitAuth,
    closeAuthModal: authSession.closeAuthModal,
    openAuthModal: authSession.openAuthModal,
  };
}
