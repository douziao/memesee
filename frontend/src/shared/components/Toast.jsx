export default function Toast({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-dot" aria-hidden="true" />
      <span className="toast-message">{message}</span>
    </div>
  );
}
