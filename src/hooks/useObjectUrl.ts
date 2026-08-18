import { useEffect, useState } from 'react';

/**
 * Hold an object URL for a Blob, revoking it when the Blob changes or on unmount.
 *
 * Deliberately not revoked right after a download click: Safari cancels an in-flight
 * download when its URL is revoked, so the URL has to outlive the click. Tying its lifetime
 * to the Blob's presence in state is both correct and leak-free.
 */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return url;
}
