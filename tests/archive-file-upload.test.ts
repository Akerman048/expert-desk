import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it, vi } from "vitest";

import {
  ArchiveFileUploadError,
  extractSafeS3UploadErrorCode,
  uploadArchiveFileToS3,
} from "@/lib/archive-file-browser-upload";
import { createArchiveFilePutObject } from "@/lib/archive-file-presign";
import { S3_CHECKSUM_CONFIG } from "@/lib/s3-checksum-config";

const fakeCredentials = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "local-test-secret",
};

function createTestClient(
  checksumConfig: typeof S3_CHECKSUM_CONFIG | undefined,
) {
  return new S3Client({
    region: "us-east-1",
    credentials: fakeCredentials,
    ...checksumConfig,
  });
}

describe("archive browser S3 upload", () => {
  it("uses the supported WHEN_REQUIRED request checksum setting", () => {
    expect(S3_CHECKSUM_CONFIG).toEqual({
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  });

  it("does not presign an empty-body CRC32 checksum", async () => {
    const command = new PutObjectCommand({
      Bucket: "private-test-bucket",
      Key: "organizations/org-1/archive/upload-1/photo.jpg",
      ContentType: "image/jpeg",
    });
    const defaultUrl = new URL(
      await getSignedUrl(createTestClient(undefined), command),
    );
    const fixedUrl = new URL(
      await getSignedUrl(createTestClient(S3_CHECKSUM_CONFIG), command),
    );

    expect(defaultUrl.searchParams.get("x-amz-checksum-crc32")).toBe(
      "AAAAAA==",
    );
    expect(defaultUrl.searchParams.get("x-amz-sdk-checksum-algorithm")).toBe(
      "CRC32",
    );
    expect(fixedUrl.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(fixedUrl.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(
      false,
    );
  });

  it("uses one MIME value for signing and returned browser headers", () => {
    const { command, uploadHeaders } = createArchiveFilePutObject({
      bucket: "private-test-bucket",
      storageKey: "organizations/org-1/archive/upload-1/photo.jpg",
      mimeType: "image/jpeg",
    });

    expect(command.input.ContentType).toBe("image/jpeg");
    expect(uploadHeaders).toEqual({ "Content-Type": "image/jpeg" });
  });

  it("passes returned headers to fetch unchanged without checksum headers", async () => {
    const uploadHeaders = { "Content-Type": "image/jpeg" };
    const file = new Blob(["non-empty"], { type: "image/jpeg" });
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(null, { status: 200 }),
    );

    await uploadArchiveFileToS3({
      uploadUrl: "https://private-test-bucket.s3.amazonaws.com/signed",
      uploadHeaders,
      file,
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [, init] = fetchImplementation.mock.calls[0];
    expect(init?.headers).toBe(uploadHeaders);
    expect(init?.body).toBe(file);
    expect(init?.method).toBe("PUT");
    expect(Object.keys(uploadHeaders)).not.toContain("x-amz-checksum-crc32");
    expect(Object.keys(uploadHeaders)).not.toContain(
      "x-amz-sdk-checksum-algorithm",
    );
    expect(Object.keys(uploadHeaders)).not.toContain("Content-MD5");
  });

  it.each(["AccessDenied", "BadDigest", "SignatureDoesNotMatch"] as const)(
    "safely normalizes %s without exposing the raw S3 response",
    async (code) => {
      const rawResponse = `<Error><Code>${code}</Code><Message>secret</Message><RequestId>request-id</RequestId><HostId>host-id</HostId><Signature>X-Amz-Signature=secret</Signature></Error>`;
      const fetchImplementation = vi.fn<typeof fetch>(async () =>
        new Response(rawResponse, { status: 403 }),
      );

      const promise = uploadArchiveFileToS3({
        uploadUrl: "https://private-test-bucket.s3.amazonaws.com/signed",
        uploadHeaders: { "Content-Type": "image/jpeg" },
        file: new Blob(["non-empty"]),
        fetchImplementation,
      });

      const error = await promise.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ArchiveFileUploadError);
      expect(error).toMatchObject({
        stage: "s3-put",
        status: 403,
        s3ErrorCode: code,
      });
      expect((error as Error).message).not.toContain(rawResponse);
      expect((error as Error).message).not.toContain("X-Amz-Signature");
      expect((error as Error).message).not.toContain("request-id");
      expect((error as Error).message).not.toContain("host-id");
    },
  );

  it("does not expose unknown XML error fields", async () => {
    const rawResponse =
      "<Error><Code>UnexpectedError</Code><Message>sensitive</Message></Error>";
    expect(extractSafeS3UploadErrorCode(rawResponse)).toBeNull();

    const promise = uploadArchiveFileToS3({
      uploadUrl: "https://private-test-bucket.s3.amazonaws.com/signed",
      uploadHeaders: { "Content-Type": "image/jpeg" },
      file: new Blob(["non-empty"]),
      fetchImplementation: async () =>
        new Response(rawResponse, { status: 500 }),
    });

    await expect(promise).rejects.toMatchObject({
      message: "Не вдалося завантажити файл у сховище.",
      s3ErrorCode: null,
    });
  });

  it("keeps signed GET downloads free of upload checksum parameters", async () => {
    const signedUrl = new URL(
      await getSignedUrl(
        createTestClient(S3_CHECKSUM_CONFIG),
        new GetObjectCommand({
          Bucket: "private-test-bucket",
          Key: "organizations/org-1/archive/upload-1/photo.jpg",
          ResponseContentDisposition: "attachment",
        }),
      ),
    );

    expect(signedUrl.searchParams.get("response-content-disposition")).toBe(
      "attachment",
    );
    expect(signedUrl.searchParams.has("X-Amz-Signature")).toBe(true);
    expect(signedUrl.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(signedUrl.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(
      false,
    );
  });
});
