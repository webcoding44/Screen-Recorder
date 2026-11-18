"use client";
import Image from "next/image";
import ImageWithFallback from "./ImageWithFallback";
import Link from "next/link";
import { useState } from "react";
import FavoriteButton from "./FavoriteButton";

const VideoCard = ({
  id,
  title,
  thumbnail,
  userImg,
  username,
  createdAt,
  views,
  visibility,
  duration,
  isFavorite = false,
}: VideoCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(`${window.location.origin}/video/${id}`);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  return (
    <article className="video-card">
      <Link href={`/video/${id}`} className="video-card-media">
        <Image
          src={thumbnail}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          alt={`${title} thumbnail`}
          className="thumbnail"
        />
        {duration && (
          <span className="duration">{Math.ceil(duration / 60)} min</span>
        )}
      </Link>
      <div className="video-card-actions">
        <FavoriteButton videoId={id} initiallySaved={isFavorite} compact />
        <button onClick={handleCopy} className="copy-btn" aria-label="Copy video link">
          <Image
            src={
              copied ? "/assets/icons/checkmark.svg" : "/assets/icons/link.svg"
            }
            alt=""
            width={18}
            height={18}
          />
        </button>
      </div>
      <div className="video-card-content">
        <Link href={`/video/${id}`} className="video-card-title">
          <h2>{title}</h2>
        </Link>
        <div className="video-card-meta">
          <figure>
            <ImageWithFallback
              src={userImg}
              width={34}
              height={34}
              alt="avatar"
              className="rounded-full aspect-square"
            />
            <figcaption>
              <h3>{username}</h3>
              <p>{visibility}</p>
            </figcaption>
          </figure>
          <aside>
            <Image
              src="/assets/icons/eye.svg"
              alt="views"
              width={16}
              height={16}
            />
            <span>{views}</span>
          </aside>
        </div>
        <footer>
          <span>{visibility}</span>
          <time dateTime={createdAt.toISOString()}>
            {createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            })}
          </time>
        </footer>
      </div>
    </article>
  );
};

export default VideoCard;
