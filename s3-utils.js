// S3 Backblaze B2 utility wrapper for standalone Node.js and VPS compatibility
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Instantiate S3 client with credentials or fallback to process.env
 */
export function createS3Client(creds = {}) {
  const accessKeyId = creds.accessKeyId || creds.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '';
  const secretAccessKey = creds.secretAccessKey || creds.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
  const endpoint = (creds.endpoint || creds.S3_ENDPOINT || process.env.S3_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com').trim();
  const region = (creds.region || creds.S3_REGION || process.env.S3_REGION || 'us-west-004').trim();

  let cleanEndpoint = endpoint;
  if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
    cleanEndpoint = `https://${cleanEndpoint}`;
  }

  return new S3Client({
    region,
    endpoint: cleanEndpoint,
    credentials: {
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
    },
    forcePathStyle: true,
  });
}

/**
 * Generate a Pre-signed URL for a given file in the Backblaze S3 private bucket
 * Usage in VPS server.js:
 *   const signedUrl = await generatePresignedUrl(fileName, process.env);
 *   res.redirect(302, signedUrl);
 */
export async function generatePresignedUrl(fileName, envOrCreds = process.env, expiresInSeconds = 3600) {
  const bucketName = (
    envOrCreds?.S3_BUCKET_NAME ||
    envOrCreds?.bucketName ||
    process.env.S3_BUCKET_NAME ||
    'gitforgedev'
  ).trim();

  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
  const s3 = createS3Client(envOrCreds);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
  });

  return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

export const generatePresignedDownloadUrl = generatePresignedUrl;

/**
 * Generate pre-signed upload URL for direct browser uploads
 */
export async function generatePresignedUploadUrl(
  fileName,
  contentType = 'application/octet-stream',
  envOrCreds = process.env,
  expiresInSeconds = 900
) {
  const bucketName = (
    envOrCreds?.S3_BUCKET_NAME ||
    envOrCreds?.bucketName ||
    process.env.S3_BUCKET_NAME ||
    'gitforgedev'
  ).trim();

  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
  const s3 = createS3Client(envOrCreds);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  return {
    uploadUrl,
    key: cleanKey,
    expiresIn: expiresInSeconds,
  };
}

/**
 * Check connection health to S3 / Backblaze bucket
 */
export async function checkS3Connection(envOrCreds = process.env) {
  const bucketName = (
    envOrCreds?.S3_BUCKET_NAME ||
    envOrCreds?.bucketName ||
    process.env.S3_BUCKET_NAME ||
    'gitforgedev'
  ).trim();

  const endpoint = (
    envOrCreds?.S3_ENDPOINT ||
    envOrCreds?.endpoint ||
    process.env.S3_ENDPOINT ||
    'https://s3.us-west-004.backblazeb2.com'
  ).trim();

  const region = (
    envOrCreds?.S3_REGION ||
    envOrCreds?.region ||
    process.env.S3_REGION ||
    'us-west-004'
  ).trim();

  const startTime = Date.now();
  try {
    const s3 = createS3Client(envOrCreds);
    await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));
    const latency_ms = Date.now() - startTime;
    return {
      success: true,
      latency_ms,
      bucket: bucketName,
      endpoint,
      region,
      message: 'Connection verified successfully.',
    };
  } catch (err) {
    const latency_ms = Date.now() - startTime;
    return {
      success: false,
      latency_ms,
      bucket: bucketName,
      endpoint,
      region,
      error: err.message || 'S3 Connection failed',
    };
  }
}

/**
 * Upload a file directly to S3
 */
export async function uploadFileToS3(fileName, buffer, contentType = 'application/octet-stream', envOrCreds = process.env) {
  const bucketName = (
    envOrCreds?.S3_BUCKET_NAME ||
    envOrCreds?.bucketName ||
    process.env.S3_BUCKET_NAME ||
    'gitforgedev'
  ).trim();

  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
  const s3 = createS3Client(envOrCreds);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    success: true,
    key: cleanKey,
    size: buffer.length,
  };
}
