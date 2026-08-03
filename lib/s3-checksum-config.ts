import type { S3ClientConfig } from "@aws-sdk/client-s3";

export const S3_CHECKSUM_CONFIG = {
  requestChecksumCalculation: "WHEN_REQUIRED",
} satisfies Pick<S3ClientConfig, "requestChecksumCalculation">;
