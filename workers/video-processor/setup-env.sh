#!/bin/bash

echo "🔧 Setting up Video Processor Worker Environment"
echo "================================================"

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️ .env file already exists. Backing up to .env.backup"
    cp .env .env.backup
fi

echo "📝 Creating .env file..."

cat > .env << 'EOF'
# AWS Configuration
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# S3 Buckets - REQUIRED
AWS_S3_BUCKET_NAME=
AWS_S3_TEMP_BUCKET_NAME=

# API Configuration
API_URL=http://localhost:4000

# Optional: SQS Queue for S3 notifications (leave empty to use S3 polling)
SQS_QUEUE_URL=

# Optional: CloudFront Configuration
AWS_CLOUDFRONT_DOMAIN=
EOF

echo "✅ .env file created!"
echo ""
echo "🚨 IMPORTANT: You need to edit the .env file and add your actual values:"
echo "   - AWS_ACCESS_KEY_ID: Your AWS access key"
echo "   - AWS_SECRET_ACCESS_KEY: Your AWS secret key"
echo "   - AWS_S3_BUCKET_NAME: Your final/production S3 bucket name"
echo "   - AWS_S3_TEMP_BUCKET_NAME: Your temporary S3 bucket name"
echo ""
echo "📝 Edit the file with: nano .env"
echo "🚀 Then run: npm start"
echo ""
echo "💡 Tip: You can copy the values from your backend .env file if they exist there." 