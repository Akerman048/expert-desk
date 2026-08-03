import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { S3_CHECKSUM_CONFIG } from "@/lib/s3-checksum-config";

function readPositiveInteger(
  name: string,
  fallback: number,
  maximum: number,
) {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

const region = process.env.AWS_REGION;

if (!region) {
  throw new Error("AWS_REGION is not configured");
}

export const s3 = new S3Client({
  region,
  ...S3_CHECKSUM_CONFIG,
  maxAttempts: readPositiveInteger("AWS_MAX_ATTEMPTS", 3, 5),
  retryMode: "standard",
  requestHandler: new NodeHttpHandler({
    connectionTimeout: readPositiveInteger(
      "AWS_CONNECTION_TIMEOUT_MS",
      3_000,
      60_000,
    ),
    requestTimeout: readPositiveInteger(
      "AWS_REQUEST_TIMEOUT_MS",
      30_000,
      300_000,
    ),
    socketTimeout: readPositiveInteger(
      "AWS_SOCKET_TIMEOUT_MS",
      30_000,
      300_000,
    ),
    throwOnRequestTimeout: true,
  }),
});
