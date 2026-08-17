export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1 text-sm text-red-700 dark:text-red-400"
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
