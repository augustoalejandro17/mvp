# Video Processor Worker

This worker processes video files uploaded to the temp S3 bucket, applies ffmpeg processing, and moves them to the final S3 bucket for delivery via CloudFront.

## Features

- **S3 Integration**: Downloads from temp bucket, uploads to final bucket
- **Video Processing**: Uses ffmpeg to scale videos to 1280x720, H.264 encoding
- **Flexible Deployment**: Can run as standalone process, Docker container, or AWS Fargate
- **Monitoring**: Supports both SQS notifications and S3 polling
- **Error Handling**: Comprehensive error handling with API status updates

## Architecture

```
Frontend → Temp S3 Bucket → Worker → Final S3 Bucket → CloudFront → Users
                ↓                ↓
            SQS Queue      API Status Updates
```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1

# S3 Bucket Configuration
AWS_S3_BUCKET_NAME=your-final-videos-bucket
AWS_S3_TEMP_BUCKET_NAME=your-temp-videos-bucket

# API Configuration
API_URL=http://localhost:4000

# SQS Configuration (Optional - for S3 notifications)
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/video-processing-queue

# Worker Configuration
NODE_ENV=production
TEMP_VIDEO_DIR=/tmp/videos
```

## Installation

### Local Development

```bash
cd workers/video-processor
npm install
cp .env.example .env  # Edit with your values
npm start
```

### Docker

```bash
cd workers/video-processor
docker build -t video-processor .
docker run --env-file .env video-processor
```

### AWS Fargate

1. Build and push to ECR:
```bash
aws ecr create-repository --repository-name video-processor
docker build -t video-processor .
docker tag video-processor:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/video-processor:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/video-processor:latest
```

2. Create Fargate service with appropriate IAM roles and environment variables

## Processing Flow

1. **Upload Detection**: Worker detects new files in temp bucket (via SQS or polling)
2. **Status Update**: Updates class status to "PROCESSING"
3. **Download**: Downloads video from temp bucket
4. **Process**: Applies ffmpeg processing (scale to 720p, H.264, optimize for web)
5. **Upload**: Uploads processed video to final bucket at `/videos/{schoolId}/{classId}/final.mp4`
6. **Update**: Updates class with final video URL and "READY" status
7. **Cleanup**: Deletes original file from temp bucket

## Video Processing Settings

- **Resolution**: 1280x720 (720p)
- **Codec**: H.264 (libx264)
- **Audio**: AAC, 128k bitrate
- **Optimization**: Fast start for web streaming
- **Quality**: CRF 23 (balanced quality/size)

## Monitoring

The worker provides comprehensive logging and health checks:

- **Health Check**: Docker health check monitors process
- **Logging**: Structured logging with emojis for easy reading
- **Error Handling**: Failed videos are marked with error status
- **Retry Logic**: Automatic retry for transient failures

## Permissions Required

The worker needs the following AWS permissions:

### S3 Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-temp-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::your-final-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-temp-bucket",
        "arn:aws:s3:::your-final-bucket"
      ]
    }
  ]
}
```

### SQS Permissions (if using SQS)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:video-processing-queue"
    }
  ]
}
```

## Scaling

- **Horizontal**: Run multiple worker instances for parallel processing
- **Vertical**: Increase CPU/memory for faster processing
- **Queue-based**: Use SQS for reliable message delivery and load balancing

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure ffmpeg is installed or use Docker image
2. **Permission denied**: Check AWS credentials and S3 bucket permissions
3. **Out of disk space**: Ensure adequate temp storage for video processing
4. **API connection failed**: Verify API_URL and network connectivity

### Logs

The worker provides detailed logging for debugging:
- 🎬 Video processing start/end
- 📦 S3 upload/download operations
- ⚙️ FFmpeg processing progress
- ✅ Success operations
- ❌ Error conditions 