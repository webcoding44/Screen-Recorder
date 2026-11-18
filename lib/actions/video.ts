"use server";

import { db } from "@/drizzle/db";
import { videos, user, videoFavorites } from "@/drizzle/schema";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import {apiFetch, doesTitleMatch, getEnv, getOrderByClause, withErrorHandling} from "@/lib/utils";
import { BUNNY } from "@/constants";
import { MAX_THUMBNAIL_SIZE, MAX_VIDEO_SIZE } from "@/constants";
import {
  createNeonPresignedGet,
  createNeonPresignedUpload,
  deleteNeonObject,
  parseNeonObjectUri,
  verifyNeonObject,
} from "@/lib/storage/neon";

// Constants with full names
const VIDEO_STREAM_BASE_URL = BUNNY.STREAM_BASE_URL;
const THUMBNAIL_STORAGE_BASE_URL = BUNNY.STORAGE_BASE_URL;
const getBunnyLibraryId = () => getEnv("BUNNY_LIBRARY_ID");

// Helper functions with descriptive names
const revalidatePaths = (paths: string[]) => {
  paths.forEach((path) => revalidatePath(path));
};

const getSessionUserId = async (): Promise<string> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthenticated");
  return session.user.id;
};

const buildVideoWithUserQuery = () =>
  db
    .select({
      video: videos,
      user: { id: user.id, name: user.name, image: user.image },
    })
    .from(videos)
    .leftJoin(user, eq(videos.userId, user.id));

const resolveThumbnail = async (video: typeof videos.$inferSelect) => {
  const thumbnail = parseNeonObjectUri(video.thumbnailUrl);
  return thumbnail
    ? {
        ...video,
        thumbnailUrl: await createNeonPresignedGet(thumbnail.key, "image/jpeg"),
      }
    : video;
};

const hasFavoritesTable = async () => {
  const result = await db.execute(
    sql`select to_regclass('public.video_favorites') is not null as exists`,
  );
  return Boolean(result.rows[0]?.exists);
};

const getFavoriteVideoIds = async (userId: string, videoIds: string[]) => {
  if (videoIds.length === 0 || !(await hasFavoritesTable())) {
    return new Set<string>();
  }
  const favorites = await db
    .select({ videoId: videoFavorites.videoId })
    .from(videoFavorites)
    .where(
      and(
        eq(videoFavorites.userId, userId),
        inArray(videoFavorites.videoId, videoIds),
      ),
    );
  return new Set(favorites.map(({ videoId }) => videoId));
};

// Server Actions
export const getVideoUploadUrl = withErrorHandling(
  async (contentType: string, fileSize: number) => {
    const userId = await getSessionUserId();
    if (!contentType.startsWith("video/")) {
      throw new Error("Only video files are allowed");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_VIDEO_SIZE) {
      throw new Error("Video exceeds the maximum allowed size");
    }
    const upload = await createNeonPresignedUpload(
      userId,
      contentType,
      "video",
    );
    const videoId = upload.objectKey.split("/").pop()?.replace(/\.[^.]+$/, "") ?? upload.objectKey;
    return {
      videoId,
      objectKey: upload.objectKey,
      videoUri: upload.uri,
      uploadUrl: upload.uploadUrl,
      contentType,
    };
  }
);

export const getThumbnailUploadUrl = withErrorHandling(
  async (_videoId: string, contentType: string, fileSize: number) => {
    const userId = await getSessionUserId();
    if (!contentType.startsWith("image/")) {
      throw new Error("Only image thumbnails are allowed");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_THUMBNAIL_SIZE) {
      throw new Error("Thumbnail exceeds the maximum allowed size");
    }
    const upload = await createNeonPresignedUpload(
      userId,
      contentType,
      "thumbnail",
    );
    return {
      uploadUrl: upload.uploadUrl,
      thumbnailUri: upload.uri,
      objectKey: upload.objectKey,
      contentType,
    };
  }
);

export const saveVideoDetails = withErrorHandling(
  async (videoDetails: VideoDetails) => {
    const userId = await getSessionUserId();
    const videoObject = videoDetails.videoUri
      ? parseNeonObjectUri(videoDetails.videoUri)
      : null;
    const thumbnailObject = videoDetails.thumbnailUrl
      ? parseNeonObjectUri(videoDetails.thumbnailUrl)
      : null;
    if (!videoObject || !thumbnailObject) {
      throw new Error("Invalid or missing Neon object identifier");
    }
    await verifyNeonObject(videoObject.key);
    await verifyNeonObject(thumbnailObject.key);

    const now = new Date();
    await db.insert(videos).values({
      title: videoDetails.title,
      description: videoDetails.description,
      thumbnailUrl: videoDetails.thumbnailUrl,
      videoUrl: videoDetails.videoUri!,
      videoId: videoDetails.videoId,
      visibility: videoDetails.visibility,
      duration: videoDetails.duration,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePaths(["/"]);
    return { videoId: videoDetails.videoId };
  }
);

export const getAllVideos = withErrorHandling(async (
  searchQuery: string = '',
  sortFilter?: string,
  pageNumber: number = 1,
  pageSize: number = 8,
) => {
  const session = await auth.api.getSession({ headers: await headers() })
  const currentUserId = session?.user.id;

  const canSeeTheVideos = or(
      eq(videos.visibility, 'public'),
      eq(videos.userId, currentUserId!),
  );

  const whereCondition = searchQuery.trim()
      ? and(
          canSeeTheVideos,
          doesTitleMatch(videos, searchQuery),
      )
      : canSeeTheVideos

    // Count total for pagination
    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)` })
      .from(videos)
      .where(whereCondition);
    const totalVideos = Number(totalCount || 0);
    const totalPages = Math.ceil(totalVideos / pageSize);

    // Fetch paginated, sorted results
    const videoRecords = await buildVideoWithUserQuery()
      .where(whereCondition)
      .orderBy(
        sortFilter
          ? getOrderByClause(sortFilter)
          : sql`${videos.createdAt} DESC`
      )
      .limit(pageSize)
      .offset((pageNumber - 1) * pageSize);

    const favoriteIds = currentUserId
      ? await getFavoriteVideoIds(
          currentUserId,
          videoRecords.map(({ video }) => video.id),
        )
      : new Set<string>();
    const resolvedVideos = await Promise.all(
      videoRecords.map(async ({ video, user }) => {
        return {
          video: await resolveThumbnail(video),
          user,
          isFavorite: favoriteIds.has(video.id),
        };
      }),
    );

    return {
      videos: resolvedVideos,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalVideos,
        pageSize,
      },
    };
  }
);

export const getVideoById = withErrorHandling(async (videoId: string) => {
  const [videoRecord] = await buildVideoWithUserQuery().where(
    eq(videos.videoId, videoId)
  );
  if (!videoRecord) return undefined;
  const currentUserId = (
    await auth.api.getSession({ headers: await headers() })
  )?.user.id;
  const isFavorite =
    !!currentUserId &&
    (await getFavoriteVideoIds(currentUserId, [videoRecord.video.id])).has(
      videoRecord.video.id,
    );
  return { ...videoRecord, isFavorite };
});

export const toggleVideoFavorite = withErrorHandling(
  async (videoId: string) => {
    const userId = await getSessionUserId();
    if (!(await hasFavoritesTable())) {
      throw new Error(
        "Saved videos are not set up yet. Apply the video favorites migration first.",
      );
    }
    const [videoRecord] = await db
      .select({
        id: videos.id,
        userId: videos.userId,
        visibility: videos.visibility,
      })
      .from(videos)
      .where(eq(videos.videoId, videoId));
    if (!videoRecord) throw new Error("Video not found");
    if (videoRecord.visibility === "private" && videoRecord.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const [existingFavorite] = await db
      .select({ id: videoFavorites.id })
      .from(videoFavorites)
      .where(
        and(
          eq(videoFavorites.userId, userId),
          eq(videoFavorites.videoId, videoRecord.id),
        ),
      );

    if (existingFavorite) {
      await db
        .delete(videoFavorites)
        .where(eq(videoFavorites.id, existingFavorite.id));
    } else {
      await db.insert(videoFavorites).values({
        userId,
        videoId: videoRecord.id,
      });
    }

    revalidatePaths(["/", "/saved", `/video/${videoId}`, `/profile/${userId}`]);
    return { isFavorite: !existingFavorite };
  },
);

export const getSavedVideos = withErrorHandling(async () => {
  const userId = await getSessionUserId();
  if (!(await hasFavoritesTable())) return null;
  const records = await db
    .select({
      video: videos,
      user: { id: user.id, name: user.name, image: user.image },
    })
    .from(videoFavorites)
    .innerJoin(videos, eq(videoFavorites.videoId, videos.id))
    .leftJoin(user, eq(videos.userId, user.id))
    .where(eq(videoFavorites.userId, userId))
    .orderBy(desc(videoFavorites.createdAt));

  return Promise.all(
    records.map(async ({ video, user }) => ({
      video: await resolveThumbnail(video),
      user,
      isFavorite: true,
    })),
  );
});

export const getNeonPlaybackUrl = withErrorHandling(
  async (videoId: string) => {
    const [videoRecord] = await db
      .select()
      .from(videos)
      .where(eq(videos.videoId, videoId));
    if (!videoRecord) throw new Error("Video not found");

    const neonObject = parseNeonObjectUri(videoRecord.videoUrl);
    if (!neonObject) return { playbackUrl: null };

    if (videoRecord.visibility === "private") {
      const userId = await getSessionUserId();
      if (userId !== videoRecord.userId) {
        throw new Error("Unauthorized");
      }
    }

    const contentType = neonObject.key.endsWith(".mp4")
      ? "video/mp4"
      : neonObject.key.endsWith(".webm")
        ? "video/webm"
        : neonObject.key.endsWith(".mov")
          ? "video/quicktime"
          : "application/octet-stream";
    return {
      playbackUrl: await createNeonPresignedGet(neonObject.key, contentType),
    };
  }
);

export const getTranscript = withErrorHandling(async (videoId: string) => {
  const [videoRecord] = await db
    .select({ videoUrl: videos.videoUrl })
    .from(videos)
    .where(eq(videos.videoId, videoId));
  if (videoRecord?.videoUrl.startsWith("neon://")) return "";

  const response = await fetch(
    `${BUNNY.TRANSCRIPT_URL}/${videoId}/captions/en-auto.vtt`
  );
  return response.text();
});

export const incrementVideoViews = withErrorHandling(
  async (videoId: string) => {
    await db
      .update(videos)
      .set({ views: sql`${videos.views} + 1`, updatedAt: new Date() })
      .where(eq(videos.videoId, videoId));

    revalidatePaths([`/video/${videoId}`]);
    return {};
  }
);

export const getAllVideosByUser = withErrorHandling(
  async (
    userIdParameter: string,
    searchQuery: string = "",
    sortFilter?: string
  ) => {
    const currentUserId = (
      await auth.api.getSession({ headers: await headers() })
    )?.user.id;
    const isOwner = userIdParameter === currentUserId;

    const [userInfo] = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        email: user.email,
      })
      .from(user)
      .where(eq(user.id, userIdParameter));
    if (!userInfo) throw new Error("User not found");

        /* eslint-disable @typescript-eslint/no-explicit-any */
    const conditions = [
      eq(videos.userId, userIdParameter),
      !isOwner && eq(videos.visibility, "public"),
      searchQuery.trim() && ilike(videos.title, `%${searchQuery}%`),
    ].filter(Boolean) as any[];

    const userVideos = await buildVideoWithUserQuery()
      .where(and(...conditions))
      .orderBy(
        sortFilter ? getOrderByClause(sortFilter) : desc(videos.createdAt)
      );
    const favoriteIds = currentUserId
      ? await getFavoriteVideoIds(
          currentUserId,
          userVideos.map(({ video }) => video.id),
        )
      : new Set<string>();
    const resolvedVideos = await Promise.all(
      userVideos.map(async ({ video, user }) => {
        return {
          video: await resolveThumbnail(video),
          user,
          isFavorite: favoriteIds.has(video.id),
        };
      }),
    );

    return {
      user: userInfo,
      videos: resolvedVideos,
      count: resolvedVideos.length,
      totalViews: resolvedVideos.reduce(
        (total, { video }) => total + video.views,
        0,
      ),
    };
  }
);

export const updateVideoVisibility = withErrorHandling(
  async (videoId: string, visibility: Visibility) => {
    const userId = await getSessionUserId();
    const [videoRecord] = await db
      .select({ userId: videos.userId })
      .from(videos)
      .where(eq(videos.videoId, videoId));
    if (!videoRecord || videoRecord.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await db
      .update(videos)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(videos.videoId, videoId));

    revalidatePaths(["/", `/video/${videoId}`]);
    return {};
  }
);

export const getVideoProcessingStatus = withErrorHandling(
  async (videoId: string) => {
    const [videoRecord] = await db
      .select({ videoUrl: videos.videoUrl })
      .from(videos)
      .where(eq(videos.videoId, videoId));
    if (videoRecord?.videoUrl.startsWith("neon://")) {
      return {
        isProcessed: true,
        encodingProgress: 100,
        status: 4,
      };
    }
    const processingInfo = await apiFetch<BunnyVideoResponse>(
      `${VIDEO_STREAM_BASE_URL}/${getBunnyLibraryId()}/videos/${videoId}`,
      { bunnyType: "stream" }
    );

    return {
      isProcessed: processingInfo.status === 4,
      encodingProgress: processingInfo.encodeProgress || 0,
      status: processingInfo.status,
    };
  }
);

export const deleteVideo = withErrorHandling(
  async (videoId: string, thumbnailUrl: string) => {
    const userId = await getSessionUserId();
    const [videoRecord] = await db
      .select()
      .from(videos)
      .where(eq(videos.videoId, videoId));
    if (!videoRecord) return {};
    if (videoRecord.userId !== userId) throw new Error("Unauthorized");

    const videoObject = parseNeonObjectUri(videoRecord.videoUrl);
    const thumbnailObject = parseNeonObjectUri(
      videoRecord.thumbnailUrl || thumbnailUrl,
    );

    if (videoObject || thumbnailObject) {
      if (videoObject) await deleteNeonObject(videoObject.key);
      if (thumbnailObject) await deleteNeonObject(thumbnailObject.key);
    } else {
      await apiFetch(
        `${VIDEO_STREAM_BASE_URL}/${getBunnyLibraryId()}/videos/${videoId}`,
        { method: "DELETE", bunnyType: "stream" }
      );
      const thumbnailPath = thumbnailUrl.split("thumbnails/")[1];
      if (thumbnailPath) {
        await apiFetch(
          `${THUMBNAIL_STORAGE_BASE_URL}/thumbnails/${thumbnailPath}`,
          { method: "DELETE", bunnyType: "storage", expectJson: false }
        );
      }
    }

    await db.delete(videos).where(eq(videos.videoId, videoId));
    revalidatePaths(["/", `/video/${videoId}`]);
    return {};
  }
);


