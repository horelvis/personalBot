export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="px-1 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
