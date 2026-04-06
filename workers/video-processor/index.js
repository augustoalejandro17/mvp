const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { pipeline } = require("stream/promises");
require("dotenv").config();

// Configure ffmpeg
try {
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log("✅ FFmpeg configured successfully");
} catch (error) {
  console.warn("⚠️ FFmpeg installer not available, using system ffmpeg");
}

class VideoProcessor {
  constructor() {
    const useR2 = !!process.env.R2_ACCOUNT_ID;

    if (useR2) {
      // Cloudflare R2 (S3-compatible)
      this.s3 = new AWS.S3({
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        region: "auto",
        signatureVersion: "v4",
        s3ForcePathStyle: true,
      });
      this.tempBucket = process.env.R2_TEMP_BUCKET_NAME;
      this.finalBucket = process.env.R2_BUCKET_NAME;
      this.publicDomain = (process.env.R2_PUBLIC_DOMAIN || "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      this.sqs = null;
      this.queueUrl = null;
      console.log("☁️ Using Cloudflare R2 storage");
    } else {
      // AWS S3
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      });
      this.tempBucket = process.env.AWS_S3_TEMP_BUCKET_NAME;
      this.finalBucket = process.env.AWS_S3_BUCKET_NAME;
      this.publicDomain = null;
      this.sqs = new AWS.SQS({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      });
      this.queueUrl = process.env.SQS_QUEUE_URL;
      console.log("☁️ Using AWS S3 storage");
    }

    this.apiUrl = process.env.API_URL;
    this.workerSecret = process.env.VIDEO_WORKER_SECRET;
    this.ffmpegThreads = Number(process.env.FFMPEG_THREADS || 1);
    if (!this.apiUrl) {
      throw new Error("API_URL is required");
    }

    console.log("🎬 Video Processor Worker initialized");
    console.log(`📦 Temp Bucket: ${this.tempBucket}`);
    console.log(`📦 Final Bucket: ${this.finalBucket}`);
    console.log(`🌐 API URL: ${this.apiUrl}`);
  }

  /**
   * Start the worker - either polling SQS or S3 directly
   */
  async start() {
    console.log("🚀 Starting video processor worker...");

    if (this.queueUrl) {
      console.log("📨 Using SQS queue for notifications");
      await this.startSQSPolling();
    } else {
      console.log("🔄 Using S3 polling mode");
      await this.startS3Polling();
    }
  }

  /**
   * Poll SQS for S3 notifications
   */
  async startSQSPolling() {
    while (true) {
      try {
        const params = {
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          VisibilityTimeout: 300, // 5 minutes to process
        };

        const result = await this.sqs.receiveMessage(params).promise();

        if (result.Messages && result.Messages.length > 0) {
          for (const message of result.Messages) {
            try {
              await this.processSQSMessage(message);

              // Delete message after successful processing
              await this.sqs
                .deleteMessage({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle,
                })
                .promise();
            } catch (error) {
              console.error("❌ Error processing SQS message:", error);
              if (error && error.nonRetryable) {
                try {
                  await this.sqs
                    .deleteMessage({
                      QueueUrl: this.queueUrl,
                      ReceiptHandle: message.ReceiptHandle,
                    })
                    .promise();
                  console.warn("⚠️ Deleted non-retryable SQS message");
                } catch (deleteError) {
                  console.error(
                    "❌ Failed to delete non-retryable message:",
                    deleteError,
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("❌ Error polling SQS:", error);
        await this.sleep(5000); // Wait 5 seconds before retrying
      }
    }
  }

  /**
   * Poll S3 temp bucket directly for new files
   */
  async startS3Polling() {
    while (true) {
      try {
        console.log("🔍 Checking temp bucket for new videos...");

        const params = {
          Bucket: this.tempBucket,
          Prefix: "temp-videos/",
        };

        const result = await this.s3.listObjectsV2(params).promise();

        if (result.Contents && result.Contents.length > 0) {
          for (const object of result.Contents) {
            // Skip if it's a directory marker or too recent (still uploading)
            if (
              object.Key.endsWith("/") ||
              this.isRecentUpload(object.LastModified)
            ) {
              continue;
            }

            try {
              await this.processS3Object(object);
            } catch (error) {
              console.error(`❌ Error processing ${object.Key}:`, error);
              await this.notifyProcessingError(object.Key, error.message);
            }
          }
        }

        // Wait before next poll
        await this.sleep(30000); // 30 seconds
      } catch (error) {
        console.error("❌ Error polling S3:", error);
        await this.sleep(60000); // Wait 1 minute before retrying
      }
    }
  }

  /**
   * Process SQS message containing S3 notification
   */
  async processSQSMessage(message) {
    const body = this.parseSQSBody(message.Body);

    // Handle S3 notification format
    if (body.Records) {
      for (const record of body.Records) {
        if (
          record.eventName &&
          record.eventName.startsWith("s3:ObjectCreated")
        ) {
          const bucket = record.s3.bucket.name;
          const key = decodeURIComponent(
            record.s3.object.key.replace(/\+/g, " "),
          );

          if (bucket === this.tempBucket && key.startsWith("temp-videos/")) {
            console.log(`📨 Processing SQS notification for: ${key}`);
            await this.processVideoFile(key);
          }
        }
      }
    }
  }

  parseSQSBody(rawBody) {
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      const parseError = new Error("Invalid SQS message body JSON");
      parseError.nonRetryable = true;
      throw parseError;
    }

    // SNS -> SQS envelope: the real S3 event is in body.Message
    if (body && typeof body.Message === "string") {
      try {
        return JSON.parse(body.Message);
      } catch (error) {
        const parseError = new Error("Invalid SNS message payload JSON");
        parseError.nonRetryable = true;
        throw parseError;
      }
    }

    return body;
  }

  /**
   * Process S3 object directly
   */
  async processS3Object(object) {
    console.log(`📁 Processing S3 object: ${object.Key}`);
    await this.processVideoFile(object.Key);
  }

  /**
   * Check if upload is too recent (might still be in progress)
   */
  isRecentUpload(lastModified) {
    const now = new Date();
    const uploadTime = new Date(lastModified);
    const diffSeconds = (now - uploadTime) / 1000;
    return diffSeconds < 30; // Wait at least 30 seconds after upload (reduced for development)
  }

  /**
   * Main video processing logic
   */
  async processVideoFile(key) {
    console.log(`🎬 Starting video processing for: ${key}`);
    const context = this.parseUploadKey(key);

    console.log(
      `📋 Processing details: Type=${context.assetType}, School=${context.schoolId}, Class=${context.classId}, File=${context.filename}`,
    );

    await this.updateVideoStatus(context, "PROCESSING");

    let tempInputPath = null;
    let tempOutputPath = null;

    try {
      // 1. Build temp paths
      const tempDir = os.tmpdir();
      tempInputPath = path.join(
        tempDir,
        `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`,
      );
      tempOutputPath = path.join(
        tempDir,
        `output-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`,
      );

      // 2. Download video from temp bucket directly to file
      console.log("⬇️ Downloading video from temp bucket...");
      await this.downloadFromS3ToFile(this.tempBucket, key, tempInputPath);
      console.log(`💾 Saved input to temp file: ${tempInputPath}`);

      // 3. Process video with ffmpeg
      console.log("⚙️ Processing video with ffmpeg...");
      await this.processWithFFmpeg(tempInputPath, tempOutputPath);

      // 4. Upload processed video to final bucket
      console.log("⬆️ Uploading processed video to final bucket...");
      const uploadResult = await this.uploadToFinalBucket(
        tempOutputPath,
        context,
      );

      console.log("✅ Updating asset with final video URL...");
      await this.markVideoReady(context, uploadResult.videoUrl, uploadResult.key);

      // 6. Clean up temp bucket
      console.log("🗑️ Cleaning up temp bucket...");
      await this.deleteFromS3(this.tempBucket, key);

      console.log(
        `🎉 Video processing completed successfully for ${context.assetType} ${context.assetId}`,
      );
    } catch (error) {
      console.error(`❌ Video processing failed for ${key}:`, error);
      await this.markVideoError(context, error.message);
      throw error;
    } finally {
      // Clean up local temp files
      this.safeUnlink(tempInputPath);
      this.safeUnlink(tempOutputPath);
    }
  }

  safeUnlink(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.warn(`⚠️ Failed to delete temp file ${filePath}:`, error.message);
    }
  }

  /**
   * Download file from S3
   */
  async downloadFromS3(bucket, key) {
    const params = { Bucket: bucket, Key: key };
    const result = await this.s3.getObject(params).promise();
    return result.Body;
  }

  /**
   * Download file from S3 to local path using streaming.
   * This avoids loading full videos in memory.
   */
  async downloadFromS3ToFile(bucket, key, targetPath) {
    const params = { Bucket: bucket, Key: key };
    const readStream = this.s3.getObject(params).createReadStream();
    const writeStream = fs.createWriteStream(targetPath);
    await pipeline(readStream, writeStream);
  }

  /**
   * Process video with ffmpeg
   */
  async processWithFFmpeg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-c:v libx264", // H.264 codec
          "-preset fast", // Balance speed/quality
          "-crf 23", // Quality setting
          "-profile:v baseline", // Maximize device compatibility
          "-level 3.1", // Conservative H.264 level for older decoders
          "-pix_fmt yuv420p", // Widest color format support across mobile players
          `-threads ${Math.max(1, this.ffmpegThreads)}`, // Reduce memory pressure
          "-metadata:s:v rotate=0", // Reset rotation metadata
          "-acodec aac", // AAC audio codec
          "-profile:a aac_low", // Use AAC-LC for better compatibility
          "-ac 2", // Normalize to stereo
          "-ar 44100", // Common mobile sample rate
          "-b:a 128k", // Audio bitrate
          "-movflags +faststart", // Web optimization
          "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2", // Force even dimensions for decoders
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log(`🎬 FFmpeg started: ${commandLine}`);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(
              `📊 Processing progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on("end", () => {
          console.log("✅ FFmpeg processing completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Upload processed video to final bucket
   */
  async uploadToFinalBucket(input, context) {
    const versionSuffix = Date.now();
    const key =
      context.assetType === "submission"
        ? `videos/submissions/${context.schoolId}/${context.classId}/${context.studentId}/${context.submissionId}/final-${versionSuffix}.mp4`
        : `videos/${context.schoolId}/${context.classId}/final.mp4`;
    const body =
      typeof input === "string" ? fs.createReadStream(input) : input;

    const params = {
      Bucket: this.finalBucket,
      Key: key,
      Body: body,
      ContentType: "video/mp4",
      Metadata: {
        "x-amz-meta-orientation": "normal",
        "x-amz-meta-video-rotation": "0",
        "x-amz-meta-video-transform": "none",
        "x-amz-meta-video-display": "inline",
      },
      ContentDisposition: "inline",
      CacheControl: "max-age=31536000",
    };

    await this.s3.upload(params).promise();
    console.log(`📦 Uploaded to final bucket: ${key}`);

    // Return public URL (R2 CDN or S3)
    if (this.publicDomain) {
      return {
        key,
        videoUrl: `https://${this.publicDomain}/${key}`,
      };
    }
    return {
      key,
      videoUrl: `https://${this.finalBucket}.s3.amazonaws.com/${key}`,
    };
  }

  /**
   * Delete file from S3
   */
  async deleteFromS3(bucket, key) {
    const params = { Bucket: bucket, Key: key };
    await this.s3.deleteObject(params).promise();
    console.log(`🗑️ Deleted from S3: ${bucket}/${key}`);
  }

  /**
   * Update video status via API
   */
  async updateVideoStatus(context, status) {
    try {
      const config = this.getApiRequestConfig();
      if (context.assetType === "submission") {
        await axios.post(
          `${this.apiUrl}/api/class-submissions/worker/mark-processing`,
          {
            submissionId: context.submissionId,
            status,
          },
          config,
        );
        console.log(
          `📝 Updated video status to ${status} for submission ${context.submissionId}`,
        );
        return;
      }

      await axios.post(
        `${this.apiUrl}/api/videos/mark-processing`,
        {
          classId: context.classId,
          status,
        },
        config,
      );
      console.log(`📝 Updated video status to ${status} for class ${context.classId}`);
    } catch (error) {
      console.error(`❌ Failed to update video status:`, error.message);
    }
  }

  /**
   * Mark video as ready via API
   */
  async markVideoReady(context, videoUrl, videoKey) {
    try {
      const config = this.getApiRequestConfig();
      if (context.assetType === "submission") {
        await axios.post(
          `${this.apiUrl}/api/class-submissions/worker/mark-ready`,
          {
            submissionId: context.submissionId,
            videoUrl,
            videoKey,
          },
          config,
        );
        console.log(`✅ Marked video as ready for submission ${context.submissionId}`);
        return;
      }

      await axios.post(
        `${this.apiUrl}/api/videos/mark-ready`,
        {
          classId: context.classId,
          videoUrl,
        },
        config,
      );
      console.log(`✅ Marked video as ready for class ${context.classId}`);
    } catch (error) {
      console.error(`❌ Failed to mark video as ready:`, error.message);
      throw error;
    }
  }

  /**
   * Mark video processing as failed via API
   */
  async markVideoError(context, errorMessage) {
    try {
      const config = this.getApiRequestConfig();
      if (context.assetType === "submission") {
        await axios.post(
          `${this.apiUrl}/api/class-submissions/worker/mark-error`,
          {
            submissionId: context.submissionId,
            error: errorMessage,
          },
          config,
        );
        console.log(`❌ Marked video as error for submission ${context.submissionId}`);
        return;
      }

      await axios.post(
        `${this.apiUrl}/api/videos/mark-error`,
        {
          classId: context.classId,
          error: errorMessage,
        },
        config,
      );
      console.log(`❌ Marked video as error for class ${context.classId}`);
    } catch (error) {
      console.error(`❌ Failed to mark video error:`, error.message);
    }
  }

  /**
   * Notify about processing error
   */
  async notifyProcessingError(key, errorMessage) {
    try {
      const context = this.parseUploadKey(key);
      await this.markVideoError(context, errorMessage);
    } catch (error) {
      console.error("❌ Failed to notify processing error:", error.message);
    }
  }

  parseUploadKey(key) {
    const pathParts = key.split("/");
    if (pathParts.length < 4) {
      throw new Error(`Invalid key format: ${key}`);
    }

    if (pathParts[1] === "submissions") {
      if (pathParts.length < 7) {
        throw new Error(`Invalid submission key format: ${key}`);
      }

      return {
        assetType: "submission",
        assetId: pathParts[5],
        schoolId: pathParts[2],
        classId: pathParts[3],
        studentId: pathParts[4],
        submissionId: pathParts[5],
        filename: pathParts.slice(6).join("/"),
      };
    }

    return {
      assetType: "class",
      assetId: pathParts[2],
      schoolId: pathParts[1],
      classId: pathParts[2],
      filename: pathParts.slice(3).join("/"),
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getApiRequestConfig() {
    const config = {
      timeout: 10000,
    };

    if (this.workerSecret) {
      config.headers = {
        "x-worker-secret": this.workerSecret,
      };
    }

    return config;
  }
}

// Start the worker
const processor = new VideoProcessor();
processor.start().catch((error) => {
  console.error("💥 Worker crashed:", error);
  process.exit(1);
});
