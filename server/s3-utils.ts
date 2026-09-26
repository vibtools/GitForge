import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pool } from './db.js';

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  region: string;
}

export interface StorageReport {
  connected: boolean;
  bucket: string;
  endpoint: string;
  region: string;
  latency_ms: number;
  total_objects: number;
  total_size_bytes: number;
  total_size_formatted: string;
  last_sync: string;
  objects: Array<{
    key: string;
    size: number;
    size_formatted: string;
    last_modified: string;
    etag?: string;
  }>;
  error?: string;
}

/**
 * Format bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Retrieve active S3 / Backblaze B2 credentials from Neon DB app_settings
 * with fallback to process.env
 */
export async function getS3Credentials(): Promise<S3Credentials> {
  try {
    const result = await pool.query(
      `SELECT key, value FROM app_settings 
       WHERE key IN ('s3_access_key_id', 's3_secret_access_key', 's3_bucket_name', 's3_endpoint', 's3_region')`
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      if (row.value && row.value.trim().length > 0) {
        map[row.key] = row.value.trim();
      }
    }

    return {
      accessKeyId: map['s3_access_key_id'] || (process.env.S3_ACCESS_KEY_ID || '').trim(),
      secretAccessKey: map['s3_secret_access_key'] || (process.env.S3_SECRET_ACCESS_KEY || '').trim(),
      bucketName: map['s3_bucket_name'] || (process.env.S3_BUCKET_NAME || 'gitforgedev').trim(),
      endpoint: map['s3_endpoint'] || (process.env.S3_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com').trim(),
      region: map['s3_region'] || (process.env.S3_REGION || 'us-west-004').trim(),
    };
  } catch (err) {
    return {
      accessKeyId: (process.env.S3_ACCESS_KEY_ID || '').trim(),
      secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || '').trim(),
      bucketName: (process.env.S3_BUCKET_NAME || 'gitforgedev').trim(),
      endpoint: (process.env.S3_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com').trim(),
      region: (process.env.S3_REGION || 'us-west-004').trim(),
    };
  }
}

/**
 * Instantiate an S3 Client with custom or stored credentials
 */
export function createS3Client(creds: S3Credentials): S3Client {
  let cleanEndpoint = creds.endpoint.trim();
  if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
    cleanEndpoint = `https://${cleanEndpoint}`;
  }

  return new S3Client({
    region: creds.region.trim() || 'us-west-004',
    endpoint: cleanEndpoint,
    credentials: {
      accessKeyId: creds.accessKeyId.trim(),
      secretAccessKey: creds.secretAccessKey.trim(),
    },
    forcePathStyle: true, // Required for Backblaze B2 & S3-compatible providers
  });
}

/**
 * Check connection health and latency to S3 / Backblaze bucket
 */
export async function checkS3Connection(customCreds?: Partial<S3Credentials>): Promise<{
  success: boolean;
  latency_ms: number;
  bucket: string;
  endpoint: string;
  region: string;
  error?: string;
  message?: string;
}> {
  const base = await getS3Credentials();
  const creds: S3Credentials = {
    accessKeyId: customCreds?.accessKeyId ? customCreds.accessKeyId.trim() : base.accessKeyId,
    secretAccessKey: customCreds?.secretAccessKey ? customCreds.secretAccessKey.trim() : base.secretAccessKey,
    bucketName: customCreds?.bucketName ? customCreds.bucketName.trim() : base.bucketName,
    endpoint: customCreds?.endpoint ? customCreds.endpoint.trim() : base.endpoint,
    region: customCreds?.region ? customCreds.region.trim() : base.region,
  };

  if (!creds.accessKeyId || !creds.secretAccessKey || !creds.bucketName) {
    return {
      success: false,
      latency_ms: 0,
      bucket: creds.bucketName || 'unknown',
      endpoint: creds.endpoint,
      region: creds.region,
      error: 'Missing credentials (access key id, secret access key, or bucket name).',
    };
  }

  const startTime = Date.now();
  try {
    const s3 = createS3Client(creds);
    // Execute a fast list/head operation to verify authentication & bucket permissions
    await s3.send(
      new ListObjectsV2Command({
        Bucket: creds.bucketName,
        MaxKeys: 1,
      })
    );
    const latency_ms = Date.now() - startTime;

    return {
      success: true,
      latency_ms,
      bucket: creds.bucketName,
      endpoint: creds.endpoint,
      region: creds.region,
      message: 'Connection verified successfully. Bucket is active and accessible.',
    };
  } catch (err: any) {
    const latency_ms = Date.now() - startTime;
    return {
      success: false,
      latency_ms,
      bucket: creds.bucketName,
      endpoint: creds.endpoint,
      region: creds.region,
      error: err.message || 'S3 Connection failed',
    };
  }
}

/**
 * Generate a secure Pre-Signed URL for temporary file access (e.g. 1 hour)
 * Supports: generatePresignedUrl(fileName, envOrCreds?, expiresInSeconds?)
 */
export async function generatePresignedUrl(
  fileName: string,
  envOrCreds?: any,
  expiresInSeconds: number = 3600
): Promise<string> {
  let creds: S3Credentials;
  if (
    envOrCreds &&
    typeof envOrCreds.S3_ACCESS_KEY_ID === 'string' &&
    envOrCreds.S3_ACCESS_KEY_ID.trim().length > 0 &&
    typeof envOrCreds.S3_SECRET_ACCESS_KEY === 'string' &&
    envOrCreds.S3_SECRET_ACCESS_KEY.trim().length > 0
  ) {
    creds = {
      accessKeyId: envOrCreds.S3_ACCESS_KEY_ID.trim(),
      secretAccessKey: envOrCreds.S3_SECRET_ACCESS_KEY.trim(),
      bucketName: (envOrCreds.S3_BUCKET_NAME || 'gitforgedev').trim(),
      endpoint: (envOrCreds.S3_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com').trim(),
      region: (envOrCreds.S3_REGION || 'us-west-004').trim(),
    };
  } else if (
    envOrCreds &&
    typeof envOrCreds.accessKeyId === 'string' &&
    envOrCreds.accessKeyId.trim().length > 0 &&
    typeof envOrCreds.secretAccessKey === 'string' &&
    envOrCreds.secretAccessKey.trim().length > 0
  ) {
    creds = {
      accessKeyId: envOrCreds.accessKeyId.trim(),
      secretAccessKey: envOrCreds.secretAccessKey.trim(),
      bucketName: (envOrCreds.bucketName || 'gitforgedev').trim(),
      endpoint: (envOrCreds.endpoint || 'https://s3.us-west-004.backblazeb2.com').trim(),
      region: (envOrCreds.region || 'us-west-004').trim(),
    };
  } else {
    creds = await getS3Credentials();
  }

  if (!creds.accessKeyId || !creds.secretAccessKey || !creds.bucketName) {
    throw new Error('S3 Storage credentials not configured');
  }

  // Clean and decode file name
  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');

  const s3 = createS3Client(creds);
  const command = new GetObjectCommand({
    Bucket: creds.bucketName,
    Key: cleanKey,
  });

  return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Alias for download URL generation
 */
export const generatePresignedDownloadUrl = generatePresignedUrl;

/**
 * Generate a Pre-signed URL for direct browser uploads to Backblaze S3
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType = 'application/octet-stream',
  expiresInSeconds: number = 900
): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
  const creds = await getS3Credentials();
  if (!creds.accessKeyId || !creds.secretAccessKey || !creds.bucketName) {
    throw new Error('S3 Storage credentials not configured');
  }

  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
  const s3 = createS3Client(creds);
  const command = new PutObjectCommand({
    Bucket: creds.bucketName,
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
 * Upload a file directly to S3 Bucket from server
 */
export async function uploadFileToS3(
  fileName: string,
  buffer: Buffer,
  contentType = 'application/octet-stream'
): Promise<{ success: boolean; key: string; size: number }> {
  const creds = await getS3Credentials();
  if (!creds.accessKeyId || !creds.secretAccessKey || !creds.bucketName) {
    throw new Error('S3 Storage credentials not configured');
  }

  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
  const s3 = createS3Client(creds);
  await s3.send(
    new PutObjectCommand({
      Bucket: creds.bucketName,
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

/**
 * Delete an object from S3 Bucket
 */
export async function deleteS3Object(fileName: string): Promise<boolean> {
  const creds = await getS3Credentials();
  const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
  const s3 = createS3Client(creds);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: creds.bucketName,
      Key: cleanKey,
    })
  );
  return true;
}

/**
 * Fetch storage sync and status report
 */
export async function getStorageReport(): Promise<StorageReport> {
  const creds = await getS3Credentials();
  const startTime = Date.now();

  if (!creds.accessKeyId || !creds.secretAccessKey || !creds.bucketName) {
    return {
      connected: false,
      bucket: creds.bucketName || 'gitforgedev',
      endpoint: creds.endpoint,
      region: creds.region,
      latency_ms: 0,
      total_objects: 0,
      total_size_bytes: 0,
      total_size_formatted: '0 B',
      last_sync: new Date().toISOString(),
      objects: [],
      error: 'S3 Credentials are not configured yet.',
    };
  }

  try {
    const s3 = createS3Client(creds);
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: creds.bucketName,
        MaxKeys: 100,
      })
    );
    const latency_ms = Date.now() - startTime;

    const rawList = (result.Contents || []).slice();
    // Sort by latest modified first
    rawList.sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

    const objectsList = rawList.map((obj: _Object) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      size_formatted: formatBytes(obj.Size || 0),
      last_modified: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString(),
      etag: obj.ETag?.replace(/"/g, ''),
    }));

    const totalBytes = objectsList.reduce((acc, obj) => acc + obj.size, 0);

    return {
      connected: true,
      bucket: creds.bucketName,
      endpoint: creds.endpoint,
      region: creds.region,
      latency_ms,
      total_objects: result.KeyCount || objectsList.length,
      total_size_bytes: totalBytes,
      total_size_formatted: formatBytes(totalBytes),
      last_sync: new Date().toISOString(),
      objects: objectsList,
    };
  } catch (err: any) {
    const latency_ms = Date.now() - startTime;
    return {
      connected: false,
      bucket: creds.bucketName,
      endpoint: creds.endpoint,
      region: creds.region,
      latency_ms,
      total_objects: 0,
      total_size_bytes: 0,
      total_size_formatted: '0 B',
      last_sync: new Date().toISOString(),
      objects: [],
      error: err.message || 'Failed to connect to S3 storage bucket',
    };
  }
}
