"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toggleVideoFavorite } from "@/lib/actions/video";

const FavoriteButton = ({
  videoId,
  initiallySaved = false,
  compact = false,
}: {
  videoId: string;
  initiallySaved?: boolean;
  compact?: boolean;
}) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [isSaved, setIsSaved] = useState(initiallySaved);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!session?.user) {
      router.push("/sign-in");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const result = await toggleVideoFavorite(videoId);
      setIsSaved(result.isFavorite);
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update saved videos.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <span className="favorite-control">
      <button
        type="button"
        className={`favorite-button${isSaved ? " is-favorite" : ""}${compact ? " compact" : ""}`}
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Remove from saved videos" : "Save video"}
        title={isSaved ? "Saved" : "Save video"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 16.77l-5.4 2.84 1.03-6.01-4.36-4.25 6.03-.88L12 3Z" />
        </svg>
        {!compact && (
          <span>
            {isPending ? "Saving..." : isSaved ? "Saved" : "Save"}
          </span>
        )}
      </button>
      {error && (
        <span className="favorite-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
};

export default FavoriteButton;
