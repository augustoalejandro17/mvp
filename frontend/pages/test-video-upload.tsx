import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import VideoUploadWithStatus from '../components/VideoUploadWithStatus';
import { getToken } from '../utils/auth';

const TestVideoUpload: React.FC = () => {
  const router = useRouter();
  const [classId, setClassId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [isCreatingTestClass, setIsCreatingTestClass] = useState(false);
  const [testClassCreated, setTestClassCreated] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Check for authentication token on mount
  useEffect(() => {
    const token = getToken(); // This checks expiration automatically
    setAuthToken(token);
    
    // Debug info
    const cookieToken = document.cookie.split(';').find(c => c.trim().startsWith('token='));
    const localToken = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');
    
    const debug = `
Token check:
- Cookie token: ${cookieToken ? 'Found' : 'Not found'}
- LocalStorage token: ${localToken ? 'Found' : 'Not found'} 
- SessionStorage token: ${sessionToken ? 'Found' : 'Not found'}
- Final token (after expiration check): ${token ? 'Available' : 'Not available'}
- Token valid: ${token ? 'Yes' : 'No'}
- Manual mode: ${manualMode ? 'Yes' : 'No'}
- Should show create button: ${!manualMode && token ? 'Yes' : 'No'}
    `.trim();
    
    setDebugInfo(debug);
    console.log('🔍 Auth Debug:', debug);
    console.log('🔍 Token value:', token ? token.substring(0, 50) + '...' : 'null');
    console.log('🔍 Manual mode:', manualMode);
    console.log('🔍 Should show create button:', !manualMode && token);
    
    if (token) {
      console.log('✅ Valid authentication token found');
    } else {
      console.log('❌ No valid authentication token found');
    }
  }, [manualMode]);

  // Create a test class for video upload
  const createTestClass = async () => {
    try {
      setIsCreatingTestClass(true);
      const token = authToken;
      
      if (!token) {
        alert('No authentication token found. Please login first or use manual mode.');
        setManualMode(true);
        return;
      }
      
      console.log('🚀 Creating test class with token:', token.substring(0, 20) + '...');
      
      const response = await fetch('/api/videos/create-test-class', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolId: schoolId || undefined
        })
      });

      console.log('📡 Response status:', response.status);
      const responseText = await response.text();
      console.log('📡 Response body:', responseText);
      
      if (response.ok) {
        const result = JSON.parse(responseText);
        console.log('✅ Test class created successfully:', result);
        
        setClassId(result.classId);
        setSchoolId(result.schoolId || schoolId);
        setTestClassCreated(true);
        
        // Wait a moment for the database to be consistent
        setTimeout(() => {
          console.log('✅ Test class ready for video upload');
        }, 1000);
        
      } else {
        console.error('❌ Failed to create test class. Status:', response.status);
        console.error('❌ Response:', responseText);
        
        try {
          const error = JSON.parse(responseText);
          alert(`Failed to create test class: ${error.message}. Try manual mode instead.`);
        } catch (e) {
          alert(`Failed to create test class: ${responseText}. Try manual mode instead.`);
        }
        setManualMode(true);
      }
    } catch (error) {
      console.error('❌ Failed to create test class:', error);
      alert('Failed to create test class. Try manual mode instead.');
      setManualMode(true);
    } finally {
      setIsCreatingTestClass(false);
    }
  };

  // Generate a valid ObjectId manually
  const generateTestIds = () => {
    const generateObjectId = () => {
      const timestamp = Math.floor(Date.now() / 1000).toString(16);
      const randomBytes = Array.from({length: 16}, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      return timestamp + randomBytes;
    };

    const newClassId = generateObjectId();
    const newSchoolId = generateObjectId();
    
    setClassId(newClassId);
    setSchoolId(newSchoolId);
    setTestClassCreated(true);
    console.log('✅ Generated test IDs:', { classId: newClassId, schoolId: newSchoolId });
  };

  const handleUploadComplete = (videoUrl: string) => {
    console.log('✅ Video upload completed:', videoUrl);
    alert(`Video ready! URL: ${videoUrl}`);
  };

  const handleStatusChange = (status: string) => {
    console.log('📊 Status changed:', status);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🎬 Video Upload Test
            </h1>
            <p className="text-gray-600">
              Test the video processing pipeline with direct S3 upload and FFmpeg processing
            </p>
          </div>

          {/* Debug Info */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              🔍 Debug Info:
            </h3>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
              {debugInfo}
            </pre>
            <div className="mt-2">
              <span className={`inline-block px-2 py-1 rounded text-xs ${
                authToken ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {authToken ? '✅ Authenticated' : '❌ Not Authenticated'}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">
                🔧 Test Setup:
              </h3>
              
              <div className="space-y-4">
                {/* Always show mode selector first */}
                <div className="bg-white border border-blue-300 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Mode Selection:</h4>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setManualMode(false)}
                      disabled={!authToken}
                      className={`px-4 py-2 rounded transition-colors ${
                        !manualMode && authToken
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      } ${!authToken ? 'cursor-not-allowed' : 'hover:bg-green-700'}`}
                    >
                      🎯 Auto Mode {!authToken ? '(Login Required)' : ''}
                    </button>
                    <button
                      onClick={() => setManualMode(true)}
                      className={`px-4 py-2 rounded transition-colors ${
                        manualMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-300 text-gray-600 hover:bg-purple-700 hover:text-white'
                      }`}
                    >
                      📝 Manual Mode
                    </button>
                  </div>
                  
                  <p className="text-sm text-blue-700">
                    {!manualMode && authToken && '🎯 Auto Mode: Creates real test classes in database'}
                    {!manualMode && !authToken && '⚠️ Auto Mode requires authentication'}
                    {manualMode && '📝 Manual Mode: Generate fake IDs for testing upload flow'}
                  </p>
                </div>

                {/* Auto Mode Section */}
                {!manualMode && authToken && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-3">🎯 Auto Mode - Create Real Test Class:</h4>
                    
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        School ID (optional):
                      </label>
                      <input
                        type="text"
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="Leave empty to auto-generate"
                      />
                    </div>

                    <button
                      onClick={createTestClass}
                      disabled={isCreatingTestClass}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
                    >
                      {isCreatingTestClass ? '⏳ Creating Test Class...' : '🎯 Create Test Class'}
                    </button>
                  </div>
                )}

                {/* Manual Mode Section */}
                {manualMode && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-3">📝 Manual Mode - Generate Test IDs:</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Class ID:
                        </label>
                        <input
                          type="text"
                          value={classId}
                          onChange={(e) => setClassId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                          placeholder="Enter or generate class ID"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          School ID:
                        </label>
                        <input
                          type="text"
                          value={schoolId}
                          onChange={(e) => setSchoolId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                          placeholder="Enter or generate school ID"
                        />
                      </div>
                    </div>

                    <button
                      onClick={generateTestIds}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      🎲 Generate Test IDs
                    </button>
                  </div>
                )}

                {testClassCreated && classId && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">✅ Ready for Testing!</h4>
                    <p className="text-xs text-green-600 font-mono">
                      Class ID: {classId}
                    </p>
                    <p className="text-xs text-green-600 font-mono">
                      School ID: {schoolId}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {classId && (
            <div className="mb-8">
              <VideoUploadWithStatus
                classId={classId}
                schoolId={schoolId || 'test-school'}
                onUploadComplete={handleUploadComplete}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              📋 Testing Steps:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Choose Auto Mode (creates real classes) or Manual Mode (fake IDs)</li>
              <li>Create/Generate test class and IDs</li>
              <li>Select a video file (MP4, MOV, etc.)</li>
              <li>Click "Subir Video" to start upload</li>
              <li>Watch status change: UPLOADING → PROCESSING → READY</li>
              <li>Check worker logs for FFmpeg processing</li>
              <li>Verify final video in S3 final bucket</li>
            </ol>
          </div>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              ⚠️ Prerequisites:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
              <li>Backend running on localhost:4000</li>
              <li>Worker running and processing temp bucket</li>
              <li>AWS credentials configured</li>
              <li>S3 buckets created and accessible</li>
              <li>Valid authentication token (for auto mode)</li>
            </ul>
          </div>

          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">
              🚨 Note about Manual Mode:
            </h3>
            <p className="text-sm text-red-800">
              Manual mode generates fake IDs for testing the upload flow. The worker may fail 
              when trying to update non-existent classes, but you can still test the S3 upload 
              and FFmpeg processing parts of the pipeline.
            </p>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestVideoUpload; 