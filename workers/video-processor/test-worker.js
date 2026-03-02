const axios = require("axios");
require("dotenv").config();

/**
 * Simple test script to validate worker configuration
 */
async function testWorkerConfig() {
  console.log("🧪 Testing Video Processor Worker Configuration...\n");
  const useR2 = !!process.env.R2_ACCOUNT_ID;

  // Test environment variables
  console.log("📋 Environment Variables:");
  const requiredVars = useR2
    ? [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
        "R2_TEMP_BUCKET_NAME",
        "API_URL",
      ]
    : [
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_S3_BUCKET_NAME",
        "AWS_S3_TEMP_BUCKET_NAME",
        "API_URL",
      ];

  let missingVars = [];
  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    if (value) {
      console.log(
        `✅ ${varName}: ${varName.includes("SECRET") ? "***" : value}`,
      );
    } else {
      console.log(`❌ ${varName}: Missing`);
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.log(
      `\n❌ Missing required environment variables: ${missingVars.join(", ")}`,
    );
    return;
  }

  // Test API connectivity
  console.log("\n🌐 Testing API Connectivity:");
  try {
    const apiUrl = process.env.API_URL;
    const response = await axios.get(`${apiUrl}/api/health`, { timeout: 5000 });
    console.log(`✅ API reachable at ${apiUrl}`);
  } catch (error) {
    console.log(`❌ API not reachable: ${error.message}`);
    console.log("💡 Make sure the backend is running");
  }

  // Test S3-compatible SDK (AWS S3 or Cloudflare R2)
  console.log(`\n☁️ Testing ${useR2 ? "R2" : "AWS S3"} SDK:`);
  try {
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3({
      accessKeyId: useR2
        ? process.env.R2_ACCESS_KEY_ID
        : process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: useR2
        ? process.env.R2_SECRET_ACCESS_KEY
        : process.env.AWS_SECRET_ACCESS_KEY,
      region: useR2 ? "auto" : process.env.AWS_REGION || "us-east-1",
      ...(useR2
        ? {
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            signatureVersion: "v4",
            s3ForcePathStyle: true,
          }
        : {}),
    });

    // Test temp bucket access
    try {
      const tempBucket = useR2
        ? process.env.R2_TEMP_BUCKET_NAME
        : process.env.AWS_S3_TEMP_BUCKET_NAME;
      await s3.headBucket({ Bucket: tempBucket }).promise();
      console.log(`✅ Temp bucket accessible: ${tempBucket}`);
    } catch (error) {
      console.log(`❌ Temp bucket not accessible: ${error.message}`);
    }

    // Test final bucket access
    try {
      const finalBucket = useR2
        ? process.env.R2_BUCKET_NAME
        : process.env.AWS_S3_BUCKET_NAME;
      await s3.headBucket({ Bucket: finalBucket }).promise();
      console.log(`✅ Final bucket accessible: ${finalBucket}`);
    } catch (error) {
      console.log(`❌ Final bucket not accessible: ${error.message}`);
    }
  } catch (error) {
    console.log(`❌ AWS SDK error: ${error.message}`);
  }

  // Test FFmpeg
  console.log("\n🎬 Testing FFmpeg:");
  try {
    const ffmpeg = require("fluent-ffmpeg");

    // Try to get ffmpeg version
    ffmpeg.ffprobe("", (err, data) => {
      // We expect an error since we're not passing a valid file
      // but if ffmpeg is available, the error will be about the file, not ffmpeg
      if (err && err.message.includes("No such file")) {
        console.log("✅ FFmpeg is available");
      } else if (err && err.message.includes("spawn")) {
        console.log("❌ FFmpeg not found in PATH");
        console.log("💡 Install ffmpeg or use Docker image");
      } else {
        console.log("✅ FFmpeg is available");
      }
    });
  } catch (error) {
    console.log(`❌ FFmpeg test error: ${error.message}`);
  }

  console.log("\n🎉 Configuration test completed!");
  console.log("\n💡 Next steps:");
  console.log("1. Fix any ❌ issues above");
  console.log("2. Run: npm start");
  console.log("3. Upload a video to test the full pipeline");
}

// Run the test
testWorkerConfig().catch((error) => {
  console.error("💥 Test failed:", error);
  process.exit(1);
});
