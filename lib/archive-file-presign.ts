import { PutObjectCommand } from "@aws-sdk/client-s3";

export function createArchiveFilePutObject({
  bucket,
  storageKey,
  mimeType,
}: {
  bucket: string;
  storageKey: string;
  mimeType: string;
}) {
  const uploadHeaders = { "Content-Type": mimeType };

  return {
    command: new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: uploadHeaders["Content-Type"],
    }),
    uploadHeaders,
  };
}
