const SAFE_S3_UPLOAD_ERROR_CODES = new Set([
  "AccessDenied",
  "BadDigest",
  "SignatureDoesNotMatch",
]);

export type SafeS3UploadErrorCode =
  | "AccessDenied"
  | "BadDigest"
  | "SignatureDoesNotMatch";

export class ArchiveFileUploadError extends Error {
  readonly stage = "s3-put";
  readonly status: number;
  readonly s3ErrorCode: SafeS3UploadErrorCode | null;

  constructor({
    status,
    s3ErrorCode,
  }: {
    status: number;
    s3ErrorCode: SafeS3UploadErrorCode | null;
  }) {
    super(getArchiveFileUploadErrorMessage(s3ErrorCode));
    this.name = "ArchiveFileUploadError";
    this.status = status;
    this.s3ErrorCode = s3ErrorCode;
  }
}

export function extractSafeS3UploadErrorCode(
  responseBody: string,
): SafeS3UploadErrorCode | null {
  const code = /<Code>\s*([^<\s]+)\s*<\/Code>/i.exec(responseBody)?.[1];
  return code && SAFE_S3_UPLOAD_ERROR_CODES.has(code)
    ? (code as SafeS3UploadErrorCode)
    : null;
}

export function getArchiveFileUploadErrorMessage(
  code: SafeS3UploadErrorCode | null,
) {
  switch (code) {
    case "AccessDenied":
      return "Сховище відхилило завантаження. Перевірте права доступу.";
    case "BadDigest":
      return "Контрольна сума файлу не збігається. Спробуйте ще раз.";
    case "SignatureDoesNotMatch":
      return "Підпис завантаження недійсний або прострочений. Спробуйте ще раз.";
    default:
      return "Не вдалося завантажити файл у сховище.";
  }
}

export async function uploadArchiveFileToS3({
  uploadUrl,
  uploadHeaders,
  file,
  fetchImplementation = fetch,
}: {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  file: Blob;
  fetchImplementation?: typeof fetch;
}) {
  let response: Response;

  try {
    response = await fetchImplementation(uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: file,
    });
  } catch {
    throw new Error("Мережева помилка під час завантаження.");
  }

  if (response.ok) return;

  let responseBody = "";
  try {
    responseBody = await response.text();
  } catch {
    // A safe generic error is returned when S3's response cannot be read.
  }

  throw new ArchiveFileUploadError({
    status: response.status,
    s3ErrorCode: extractSafeS3UploadErrorCode(responseBody),
  });
}
