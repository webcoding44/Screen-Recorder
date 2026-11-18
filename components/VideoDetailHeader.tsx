"use client";
import { daysAgo } from "@/lib/utils";
import { deleteVideo, updateVideoVisibility } from "@/lib/actions/video";
import Image from "next/image";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { visibilities } from "@/constants";
import DropdownList from "./DropdownList";
import ImageWithFallback from "./ImageWithFallback";
import FavoriteButton from "./FavoriteButton";

const sharePlatforms = [
  {
    name: "WhatsApp",
    shortName: "wa",
    className: "whatsapp",
    getUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    name: "Facebook",
    shortName: "f",
    className: "facebook",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "X",
    shortName: "𝕏",
    className: "x",
    getUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "Telegram",
    shortName: "➤",
    className: "telegram",
    getUrl: (url: string, title: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "LinkedIn",
    shortName: "in",
    className: "linkedin",
    getUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Email",
    shortName: "✉",
    className: "email",
    getUrl: (url: string, title: string) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];

const VideoDetailHeader = ({
  title,
  createdAt,
  userImg,
  username,
  videoId,
  ownerId,
  visibility,
  thumbnailUrl,
  isFavorite,
}: VideoDetailHeaderProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [visibilityState, setVisibilityState] = useState<Visibility>(
    visibility as Visibility
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const isOwner = userId === ownerId;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/video/${videoId}`;

  React.useEffect(() => {
    if (!isShareOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsShareOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isShareOpen]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteVideo(videoId, thumbnailUrl);
      router.push("/");
    } catch (error) {
      console.error("Error deleting video:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVisibilityChange = async (option: string) => {
    if (option !== visibilityState) {
      setIsUpdating(true);
      try {
        await updateVideoVisibility(videoId, option as Visibility);
        setVisibilityState(option as Visibility);
      } catch (error) {
        console.error("Error updating visibility:", error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareError(null);
    } catch (error) {
      console.error("Error copying video link:", error);
      setShareError("Could not copy the link. Please copy it manually.");
    }
  };

  const TriggerVisibility = (
    <div className="visibility-trigger">
      <div>
        <Image
          src="/assets/icons/eye.svg"
          alt="Views"
          width={16}
          height={16}
          className="mt-0.5"
        />
        <p>{visibilityState}</p>
      </div>
      <Image
        src="/assets/icons/arrow-down.svg"
        alt="Arrow Down"
        width={16}
        height={16}
      />
    </div>
  );

  return (
    <header className="detail-header">
      <aside className="user-info">
        <h1>{title}</h1>
        <figure>
          <button onClick={() => router.push(`/profile/${ownerId}`)}>
            <ImageWithFallback
              src={userImg ?? ""}
              alt="Jason"
              width={24}
              height={24}
              className="rounded-full"
            />
            <h2>{username ?? "Guest"}</h2>
          </button>
          <figcaption>
            <span className="mt-1">・</span>
            <p>{daysAgo(createdAt)}</p>
          </figcaption>
        </figure>
      </aside>
      <aside className="cta">
        <FavoriteButton videoId={videoId} initiallySaved={isFavorite} />
        <button
          type="button"
          className="share-trigger"
          onClick={() => {
            setCopied(false);
            setShareError(null);
            setIsShareOpen(true);
          }}
        >
          <Image src="/assets/icons/link.svg" alt="" width={18} height={18} />
          <span>Share</span>
        </button>
        {isOwner && (
          <div className="user-btn">
            <button
              className="delete-btn"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete video"}
            </button>
            <div className="bar" />
            {isUpdating ? (
              <div className="update-stats">
                <p>Updating...</p>
              </div>
            ) : (
              <DropdownList
                options={visibilities}
                selectedOption={visibilityState}
                onOptionSelect={handleVisibilityChange}
                triggerElement={TriggerVisibility}
              />
            )}
          </div>
        )}
      </aside>
      {isShareOpen && (
        <div
          className="share-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsShareOpen(false);
          }}
        >
          <section
            className="share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
          >
            <header>
              <div>
                <h2 id="share-dialog-title">Share this video</h2>
                <p>Share it with friends on your favorite platform.</p>
              </div>
              <button
                type="button"
                className="share-close"
                onClick={() => setIsShareOpen(false)}
                aria-label="Close share dialog"
              >
                ×
              </button>
            </header>

            <div className="share-platforms">
              {sharePlatforms.map((platform) => (
                <a
                  key={platform.name}
                  className="share-platform"
                  href={platform.getUrl(shareUrl, title)}
                  target={platform.name === "Email" ? undefined : "_blank"}
                  rel={platform.name === "Email" ? undefined : "noreferrer"}
                  aria-label={`Share on ${platform.name}`}
                >
                  <span className={`share-platform-icon ${platform.className}`}>
                    {platform.shortName}
                  </span>
                  <span>{platform.name}</span>
                </a>
              ))}
            </div>

            <div className="share-link-section">
              <label htmlFor="share-video-link">Or copy link</label>
              <div className="share-link-control">
                <input id="share-video-link" readOnly value={shareUrl} />
                <button type="button" onClick={copyLink}>
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
              {shareError && (
                <p className="share-error" role="alert">
                  {shareError}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </header>
  );
};

export default VideoDetailHeader;
