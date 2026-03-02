import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Cookies from 'js-cookie';
import axios from 'axios';

const VideoDebugPage: React.FC = () => {
  const router = useRouter();
  const { classId } = router.query;
  
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>({});

  const addDebugInfo = (key: string, value: any) => {
    setDebugInfo((prev: any) => ({
      ...prev,
      [key]: value,
      timestamp: new Date().toISOString()
    }));
  };

  const testVideoAccess = async () => {
    if (!classId) {
      addDebugInfo('error', 'No class ID provided');
      return;
    }

    setLoading(true);
    const results: any = {};

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = Cookies.get('token');
      
      addDebugInfo('apiUrl', apiUrl);
      addDebugInfo('hasToken', !!token);
      addDebugInfo('classId', classId);

      // Test 1: Get class details
      try {
        console.log('Testing class details...');
        const classResponse = await axios.get(`${apiUrl}/api/classes/${classId}`);
        results.classDetails = {
          success: true,
          data: classResponse.data
        };
        addDebugInfo('classDetails', results.classDetails);
      } catch (error: any) {
        results.classDetails = {
          success: false,
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        };
        addDebugInfo('classDetailsError', results.classDetails);
      }

      // Test 2: Get stream URL without auth
      try {
        console.log('Testing stream URL without auth...');
        const streamResponse = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`);
        results.streamUrlNoAuth = {
          success: true,
          data: streamResponse.data
        };
        addDebugInfo('streamUrlNoAuth', results.streamUrlNoAuth);
      } catch (error: any) {
        results.streamUrlNoAuth = {
          success: false,
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        };
        addDebugInfo('streamUrlNoAuthError', results.streamUrlNoAuth);
      }

      // Test 3: Get stream URL with auth (if token exists)
      if (token) {
        try {
          console.log('Testing stream URL with auth...');
          const streamResponse = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          results.streamUrlWithAuth = {
            success: true,
            data: streamResponse.data
          };
          addDebugInfo('streamUrlWithAuth', results.streamUrlWithAuth);
        } catch (error: any) {
          results.streamUrlWithAuth = {
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
          };
          addDebugInfo('streamUrlWithAuthError', results.streamUrlWithAuth);
        }
      }

      // Test 4: Test video proxy endpoint
      const streamUrl = results.streamUrlWithAuth?.data?.url || results.streamUrlNoAuth?.data?.url;
      if (streamUrl) {
        try {
          console.log('Testing video proxy endpoint...');
          const proxyResponse = await fetch(streamUrl, {
            method: 'HEAD', // Just check if accessible
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          results.proxyTest = {
            success: proxyResponse.ok,
            status: proxyResponse.status,
            headers: Object.fromEntries(proxyResponse.headers.entries())
          };
          addDebugInfo('proxyTest', results.proxyTest);
        } catch (error: any) {
          results.proxyTest = {
            success: false,
            error: error.message
          };
          addDebugInfo('proxyTestError', results.proxyTest);
        }
      }

      setTestResults(results);
    } catch (error: any) {
      addDebugInfo('generalError', error.message);
    } finally {
      setLoading(false);
    }
  };

  const testVideoPlayback = (videoUrl: string) => {
    if (!videoUrl) return;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    const testResult: any = {
      url: videoUrl,
      startTime: new Date().toISOString()
    };

    video.onloadstart = () => {
      testResult.loadStart = new Date().toISOString();
      console.log('Video load start');
    };

    video.onloadedmetadata = () => {
      testResult.metadataLoaded = new Date().toISOString();
      testResult.duration = video.duration;
      testResult.videoWidth = video.videoWidth;
      testResult.videoHeight = video.videoHeight;
      console.log('Video metadata loaded');
    };

    video.oncanplay = () => {
      testResult.canPlay = new Date().toISOString();
      console.log('Video can play');
    };

    video.onerror = (e) => {
      testResult.error = {
        message: 'Video error occurred',
        code: video.error?.code,
        timestamp: new Date().toISOString()
      };
      console.error('Video error:', video.error);
    };

    video.src = videoUrl;
    
    // Update test results after 5 seconds
    setTimeout(() => {
      testResult.endTime = new Date().toISOString();
      addDebugInfo('videoPlaybackTest', testResult);
    }, 5000);
  };

  useEffect(() => {
    if (classId) {
      testVideoAccess();
    }
  }, [classId]);

  return (
    <Layout>
      <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        <h1>Video Debug Tool</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Enter Class ID"
            value={classId || ''}
            onChange={(e) => {
              router.push(`/video-debug?classId=${e.target.value}`);
            }}
            style={{
              padding: '10px',
              marginRight: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '300px'
            }}
          />
          <button
            onClick={testVideoAccess}
            disabled={loading || !classId}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#ccc' : '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Testing...' : 'Run Tests'}
          </button>
        </div>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2>Test Results</h2>
            {Object.entries(testResults).map(([key, result]: [string, any]) => (
              <div key={key} style={{
                marginBottom: '15px',
                padding: '15px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: result.success ? '#f0f9ff' : '#fef2f2'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: result.success ? '#0369a1' : '#dc2626' }}>
                  {key}: {result.success ? '✅ Success' : '❌ Failed'}
                </h3>
                <pre style={{ 
                  fontSize: '12px', 
                  overflow: 'auto',
                  backgroundColor: '#f8f9fa',
                  padding: '10px',
                  borderRadius: '4px'
                }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
                
                {/* Test video playback button */}
                {result.success && result.data?.url && (
                  <button
                    onClick={() => testVideoPlayback(result.data.url)}
                    style={{
                      marginTop: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Test Video Playback
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Debug Information */}
        {Object.keys(debugInfo).length > 0 && (
          <div>
            <h2>Debug Information</h2>
            <pre style={{
              fontSize: '12px',
              overflow: 'auto',
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        {/* Quick Test Videos */}
        <div style={{ marginTop: '30px' }}>
          <h2>Quick Test with Public Video</h2>
          <p>Test with a known working video to verify player functionality:</p>
          
          <video 
            controls 
            style={{ width: '100%', maxWidth: '600px' }}
            crossOrigin="anonymous"
            preload="metadata"
          >
            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Instructions */}
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3>How to use this tool:</h3>
          <ol>
            <li>Enter a class ID in the input field above</li>
            <li>Click "Run Tests" to check all video endpoints</li>
            <li>Review the test results to identify issues</li>
            <li>Use the "Test Video Playback" buttons to verify video loading</li>
            <li>Check the Debug Information for detailed logs</li>
          </ol>
          
          <h4>Common Issues:</h4>
          <ul>
            <li><strong>404 errors:</strong> Class not found or video not uploaded</li>
            <li><strong>401/403 errors:</strong> Authentication or permission issues</li>
            <li><strong>CORS errors:</strong> Cross-origin request blocked</li>
            <li><strong>Video errors:</strong> Invalid video format or corrupted file</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default VideoDebugPage; 