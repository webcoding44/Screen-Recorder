import { redirect } from "next/navigation";

import { getAllVideosByUser } from "@/lib/actions/video";
import { EmptyState, SharedHeader, VideoCard } from "@/components";

const ProfilePage = async ({ params, searchParams }: ParamsWithSearch) => {
  const { id } = await params;
  const { query, filter } = await searchParams;

  const { user, videos, totalViews } = await getAllVideosByUser(id, query, filter);
  if (!user) redirect("/404");

  return (
    <main className="wrapper page">
      <SharedHeader
        subHeader={user?.email}
        title={user?.name}
        userImg={user?.image ?? ""}
      />
      <section className="profile-stats" aria-label="Profile statistics">
        <article>
          <span>Videos</span>
          <strong>{videos.length}</strong>
        </article>
        <article>
          <span>Total views</span>
          <strong>{totalViews.toLocaleString()}</strong>
        </article>
        <article>
          <span>Public videos</span>
          <strong>
            {videos.filter(({ video }) => video.visibility === "public").length}
          </strong>
        </article>
      </section>

      {videos?.length > 0 ? (
        <section className="video-grid">
          {videos.map(({ video, isFavorite }) => (
            <VideoCard
              key={video.id}
              id={video.videoId}
              title={video.title}
              thumbnail={video.thumbnailUrl}
              createdAt={video.createdAt}
              userImg={user.image ?? ""}
              username={user.name ?? "Guest"}
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
          title="No Videos Available Yet"
          description="Video will show up here once you upload them."
        />
      )}
    </main>
  );
};

export default ProfilePage;
