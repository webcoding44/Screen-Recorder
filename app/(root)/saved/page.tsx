import { redirect } from "next/navigation";
import { EmptyState, VideoCard } from "@/components";
import { getSavedVideos } from "@/lib/actions/video";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const SavedPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const result = await getSavedVideos();

  return (
    <main className="wrapper page">
      <header className="saved-page-header">
        <p>YOUR PERSONAL COLLECTION</p>
        <h1>Saved videos</h1>
        <span>Keep the videos you want to come back to in one place.</span>
      </header>
      {result === null ? (
        <EmptyState
          icon="/assets/icons/video.svg"
          title="Saved videos setup pending"
          description="Apply the video favorites migration to enable your personal collection."
        />
      ) : result.length > 0 ? (
        <section className="video-grid">
          {result.map(({ video, user, isFavorite }) => (
            <VideoCard
              key={video.id}
              id={video.videoId}
              title={video.title}
              thumbnail={video.thumbnailUrl}
              createdAt={video.createdAt}
              userImg={user?.image ?? ""}
              username={user?.name ?? "Guest"}
              views={video.views}
              visibility={video.visibility}
              duration={video.duration}
              isFavorite={isFavorite}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          icon="/assets/icons/video.svg"
          title="Nothing saved yet"
          description="Save videos from the library or a video page to find them here."
        />
      )}
    </main>
  );
};

export default SavedPage;
