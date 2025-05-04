# Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- AWS account (for S3 and CloudFront)
- MongoDB Atlas account or MongoDB server

## Environment Variables
Before deploying, make sure to set up your environment variables. Create a `.env` file based on the following template:

```
# Application settings
PORT=4000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Authentication
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRATION=7d

# URLs
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain
AWS_CLOUDFRONT_KEY_PAIR_ID=your-key-pair-id
AWS_CLOUDFRONT_PRIVATE_KEY_PATH=./private-key.pem
```

**Important Security Note**: Never commit your `.env` file to version control. It contains sensitive credentials that should be kept private.

## Running in Production

1. Create your `.env` file with all required variables
2. Build and start the containers:
   ```bash
   docker compose up -d
   ```

3. To check the status of your services:
   ```bash
   docker compose ps
   ```

4. To view logs:
   ```bash
   docker compose logs -f
   ```

## Security Best Practices

1. **AWS Credentials**: Use IAM roles instead of access keys when possible, especially in production environments.

2. **Database Credentials**: Use a strong password and restrict network access to your MongoDB instance.

3. **JWT Secret**: Use a strong, randomly generated string for your JWT secret.

4. **HTTPS**: Always use HTTPS in production. You can set up Nginx as a reverse proxy with Let's Encrypt certificates.

5. **Regular Updates**: Keep your Docker images updated with security patches.

## Infrastructure as Code

Consider using infrastructure as code tools like Terraform or AWS CloudFormation to manage your infrastructure. This helps with consistency, repeatability, and documentation of your infrastructure setup.

## Backups

Set up regular backups of your MongoDB database to prevent data loss. 