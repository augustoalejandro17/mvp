const AWS = require('aws-sdk');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Configure ffmpeg
try {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('✅ FFmpeg configured successfully');
} catch (error) {
  console.warn('⚠️ FFmpeg installer not available, using system ffmpeg');
}

class VideoProcessor {
  constructor() {
    // Configure AWS
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.tempBucket = process.env.AWS_S3_TEMP_BUCKET_NAME;
    this.finalBucket = process.env.AWS_S3_BUCKET_NAME;
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
    
    // SQS configuration (optional)
    this.sqs = new AWS.SQS({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.queueUrl = process.env.SQS_QUEUE_URL;

    console.log('🎬 Video Processor Worker initialized');
    console.log(`📦 Temp Bucket: ${this.tempBucket}`);
    console.log(`📦 Final Bucket: ${this.finalBucket}`);
    console.log(`🌐 API URL: ${this.apiUrl}`);
  }

  /**
   * Start the worker - either polling SQS or S3 directly
   */
  async start() {
    console.log('🚀 Starting video processor worker...');
    
    if (this.queueUrl) {
      console.log('📨 Using SQS queue for notifications');
      await this.startSQSPolling();
    } else {
      console.log('🔄 Using S3 polling mode');
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
          VisibilityTimeout: 300 // 5 minutes to process
        };

        const result = await this.sqs.receiveMessage(params).promise();
        
        if (result.Messages && result.Messages.length > 0) {
          for (const message of result.Messages) {
            try {
              await this.processSQSMessage(message);
              
              // Delete message after successful processing
              await this.sqs.deleteMessage({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle
              }).promise();
              
            } catch (error) {
              console.error('❌ Error processing SQS message:', error);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error polling SQS:', error);
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
        console.log('🔍 Checking temp bucket for new videos...');
        
        const params = {
          Bucket: this.tempBucket,
          Prefix: 'temp-videos/'
        };

        const result = await this.s3.listObjectsV2(params).promise();
        
        if (result.Contents && result.Contents.length > 0) {
          for (const object of result.Contents) {
            // Skip if it's a directory marker or too recent (still uploading)
            if (object.Key.endsWith('/') || this.isRecentUpload(object.LastModified)) {
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
        console.error('❌ Error polling S3:', error);
        await this.sleep(60000); // Wait 1 minute before retrying
      }
    }
  }

  /**
   * Process SQS message containing S3 notification
   */
  async processSQSMessage(message) {
    const body = JSON.parse(message.Body);
    
    // Handle S3 notification format
    if (body.Records) {
      for (const record of body.Records) {
        if (record.eventName && record.eventName.startsWith('s3:ObjectCreated')) {
          const bucket = record.s3.bucket.name;
          const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
          
          if (bucket === this.tempBucket && key.startsWith('temp-videos/')) {
            console.log(`📨 Processing SQS notification for: ${key}`);
            await this.processVideoFile(key);
          }
        }
      }
    }
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
    const diffMinutes = (now - uploadTime) / (1000 * 60);
    return diffMinutes < 2; // Wait at least 2 minutes after upload
  }

  /**
   * Main video processing logic
   */
  async processVideoFile(key) {
    console.log(`🎬 Starting video processing for: ${key}`);
    
    // Extract metadata from key: temp-videos/{schoolId}/{classId}/{filename}
    const pathParts = key.split('/');
    if (pathParts.length < 4) {
      throw new Error(`Invalid key format: ${key}`);
    }
    
    const schoolId = pathParts[1];
    const classId = pathParts[2];
    const filename = pathParts[3];
    
    console.log(`📋 Processing details: School=${schoolId}, Class=${classId}, File=${filename}`);

    // Update status to PROCESSING
    await this.updateVideoStatus(classId, 'PROCESSING');

    let tempInputPath = null;
    let tempOutputPath = null;

    try {
      // 1. Download video from temp bucket
      console.log('⬇️ Downloading video from temp bucket...');
      const videoBuffer = await this.downloadFromS3(this.tempBucket, key);
      
      // 2. Save to temporary file
      const tempDir = os.tmpdir();
      tempInputPath = path.join(tempDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
      tempOutputPath = path.join(tempDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
      
      fs.writeFileSync(tempInputPath, videoBuffer);
      console.log(`💾 Saved to temp file: ${tempInputPath}`);

      // 3. Process video with ffmpeg
      console.log('⚙️ Processing video with ffmpeg...');
      await this.processWithFFmpeg(tempInputPath, tempOutputPath);

      // 4. Upload processed video to final bucket
      console.log('⬆️ Uploading processed video to final bucket...');
      const processedBuffer = fs.readFileSync(tempOutputPath);
      const finalVideoUrl = await this.uploadToFinalBucket(processedBuffer, schoolId, classId, filename);

      // 5. Update class with final video URL
      console.log('✅ Updating class with final video URL...');
      await this.markVideoReady(classId, finalVideoUrl);

      // 6. Clean up temp bucket
      console.log('🗑️ Cleaning up temp bucket...');
      await this.deleteFromS3(this.tempBucket, key);

      console.log(`🎉 Video processing completed successfully for class ${classId}`);

    } catch (error) {
      console.error(`❌ Video processing failed for ${key}:`, error);
      await this.markVideoError(classId, error.message);
      throw error;
    } finally {
      // Clean up local temp files
      if (tempInputPath && fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (tempOutputPath && fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
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
   * Process video with ffmpeg
   */
  async processWithFFmpeg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',           // H.264 codec
          '-preset fast',           // Balance speed/quality
          '-crf 23',               // Quality setting
          '-s 1280x720',           // Scale to 720p
          '-metadata:s:v rotate=0', // Reset rotation metadata
          '-acodec aac',           // AAC audio codec
          '-b:a 128k',             // Audio bitrate
          '-movflags +faststart'    // Web optimization
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`🎬 FFmpeg started: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`📊 Processing progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ FFmpeg processing completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Upload processed video to final bucket
   */
  async uploadToFinalBucket(buffer, schoolId, classId, originalFilename) {
    const fileExtension = originalFilename.split('.').pop() || 'mp4';
    const key = `videos/${schoolId}/${classId}/final.${fileExtension}`;

    const params = {
      Bucket: this.finalBucket,
      Key: key,
      Body: buffer,
      ContentType: 'video/mp4',
      Metadata: {
        'x-amz-meta-orientation': 'normal',
        'x-amz-meta-video-rotation': '0',
        'x-amz-meta-video-transform': 'none',
        'x-amz-meta-video-display': 'inline'
      },
      ContentDisposition: 'inline',
      CacheControl: 'max-age=31536000'
    };

    await this.s3.upload(params).promise();
    console.log(`📦 Uploaded to final bucket: ${key}`);

    // Return the S3 URL - the backend will handle CloudFront URL generation
    return `https://${this.finalBucket}.s3.amazonaws.com/${key}`;
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
  async updateVideoStatus(classId, status) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/videos/mark-processing`, {
        classId,
        status
      });
      console.log(`📝 Updated video status to ${status} for class ${classId}`);
    } catch (error) {
      console.error(`❌ Failed to update video status:`, error.message);
    }
  }

  /**
   * Mark video as ready via API
   */
  async markVideoReady(classId, videoUrl) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/videos/mark-ready`, {
        classId,
        videoUrl
      });
      console.log(`✅ Marked video as ready for class ${classId}`);
    } catch (error) {
      console.error(`❌ Failed to mark video as ready:`, error.message);
      throw error;
    }
  }

  /**
   * Mark video processing as failed via API
   */
  async markVideoError(classId, errorMessage) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/videos/mark-error`, {
        classId,
        error: errorMessage
      });
      console.log(`❌ Marked video as error for class ${classId}`);
    } catch (error) {
      console.error(`❌ Failed to mark video error:`, error.message);
    }
  }

  /**
   * Notify about processing error
   */
  async notifyProcessingError(key, errorMessage) {
    // Extract classId from key if possible
    const pathParts = key.split('/');
    if (pathParts.length >= 3) {
      const classId = pathParts[2];
      await this.markVideoError(classId, errorMessage);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the worker
const processor = new VideoProcessor();
processor.start().catch(error => {
  console.error('💥 Worker crashed:', error);
  process.exit(1);
}); 