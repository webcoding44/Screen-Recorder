import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const NEON_BUCKET =
  process.env.NEON_OBJECT_STORAGE_BUCKET ??
  process.env.AWS_BUCKET_NAME ??
  "name";

type NeonRequiredEnv =
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_ENDPOINT_URL_S3"
  | "AWS_REGION";

const getRequiredEnv = (key: NeonRequiredEnv) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

export const s3Client = new S3Client({
  region: getRequiredEnv("AWS_REGION"),
  endpoint: getRequiredEnv("AWS_ENDPOINT_URL_S3"),
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  },
});

export const neonObjectUri = (objectKey: string) =>
  `neon://${NEON_BUCKET}/${objectKey}`;

export const parseNeonObjectUri = (uri: string) => {
  if (!uri.startsWith("neon://")) return null;
  const prefix = `neon://${NEON_BUCKET}/`;
  if (!uri.startsWith(prefix)) return null;
  const key = uri.slice(prefix.length);
  return key ? { bucket: NEON_BUCKET, key } : null;
};

const extensionForType = (contentType: string) => {
  const extensions: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[contentType] ?? null;
};

export const createNeonPresignedUpload = async (
  userId: string,
  contentType: string,
  kind: "video" | "thumbnail",
) => {
  const extension = extensionForType(contentType);
  if (!extension) throw new Error("Unsupported file type");

  const objectKey =
    kind === "video"
      ? `videos/${userId}/${randomUUID()}.${extension}`
      : `thumbnails/${userId}/${randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: NEON_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 900 },
  );

  return { uploadUrl, objectKey, uri: neonObjectUri(objectKey), contentType };
};

export const createNeonPresignedGet = async (
  objectKey: string,
  contentType?: string,
) =>
  getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: NEON_BUCKET,
      Key: objectKey,
      ...(contentType ? { ResponseContentType: contentType } : {}),
    }),
    { expiresIn: 900 },
  );

export const verifyNeonObject = async (objectKey: string) =>
  s3Client.send(
    new HeadObjectCommand({
      Bucket: NEON_BUCKET,
      Key: objectKey,
    }),
  );

export const deleteNeonObject = async (objectKey: string) =>
  s3Client.send(
    new DeleteObjectCommand({
      Bucket: NEON_BUCKET,
      Key: objectKey,
    }),
  );
