import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import PQueue from "p-queue";

import { env } from "../lib/env";

const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

// Queue to ensure ordered uploads
const uploadQueue = new PQueue({ concurrency: 1 });

function getContentType(filename: string): string {
  if (filename.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (filename.endsWith(".ts")) return "video/MP2T";
  if (filename.endsWith(".m4s")) return "video/iso.segment";
  if (filename.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export async function uploadFile(localPath: string, remotePath: string): Promise<void> {
  return uploadQueue.add(async () => {
    const body = await readFile(localPath);
    const contentType = getContentType(basename(localPath));

    await s3.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: remotePath,
        Body: body,
        ContentType: contentType,
        CacheControl: remotePath.endsWith(".m3u8")
          ? "no-cache, no-store, must-revalidate"
          : "public, max-age=31536000, immutable",
      }),
    );

    console.log(`[uploader] uploaded ${remotePath}`);
  });
}

export async function uploadSegment(
  sessionId: string,
  type: "live" | "vod",
  localPath: string,
): Promise<void> {
  const filename = basename(localPath);
  const remotePath = `${sessionId}/${type}/${filename}`;
  await uploadFile(localPath, remotePath);
}

export async function uploadPlaylist(
  sessionId: string,
  type: "live" | "vod",
  localPath: string,
): Promise<void> {
  const remotePath = `${sessionId}/${type}/index.m3u8`;
  await uploadFile(localPath, remotePath);
}
