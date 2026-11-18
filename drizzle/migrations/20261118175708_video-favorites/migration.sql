CREATE TABLE "video_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"video_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "video_favorites_user_video_idx" ON "video_favorites" ("user_id","video_id");--> statement-breakpoint
ALTER TABLE "video_favorites" ADD CONSTRAINT "video_favorites_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video_favorites" ADD CONSTRAINT "video_favorites_video_id_videos_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE;