import { S3Client } from "@aws-sdk/client-s3";

export function makeS3Client() {
  return new S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || "admin",
      secretAccessKey: process.env.MINIO_SECRET_KEY || "adminpass123",
    },
  });
}
