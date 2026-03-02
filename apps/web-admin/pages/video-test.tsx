import React, { useState } from 'react';
import Layout from '../components/Layout';
import VideoJSPlayer from '../components/VideoJSPlayer';
import SimpleVideoPlayer from '../components/SimpleVideoPlayer';

const VideoTestPage: React.FC = () => {
  const [useSimplePlayer, setUseSimplePlayer] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);

  // Test video URL - using a public test video
  const testVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  return (
    <Layout>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Video Player Test</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => {
              setUseSimplePlayer(false);
              setVideoLoadError(false);
            }}
            style={{
              marginRight: '10px',
              padding: '10px 20px',
              backgroundColor: useSimplePlayer ? '#6b7280' : '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            VideoJS Player
          </button>
          
          <button 
            onClick={() => {
              setUseSimplePlayer(true);
              setVideoLoadError(false);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: useSimplePlayer ? '#3182ce' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Simple Player
          </button>
        </div>

        <div style={{ 
          width: '100%', 
          minHeight: '400px', 
          backgroundColor: '#000', 
          borderRadius: '8px',
          position: 'relative'
        }}>
          {videoLoadError ? (
            <div style={{
              padding: "20px", 
              textAlign: "center",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "#000",
              minHeight: "400px"
            }}>
              <div style={{color: "#e53e3e", fontSize: "48px", marginBottom: "20px"}}>⚠️</div>
              <p style={{color: "white", marginBottom: "20px", fontSize: "18px", fontWeight: "bold"}}>Error loading video</p>
              <p style={{color: "#a0aec0", fontSize: "14px", marginBottom: "20px"}}>The video player couldn't load the video</p>
              
              <div style={{display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center"}}>
                <button 
                  onClick={() => {
                    setUseSimplePlayer(!useSimplePlayer);
                    setVideoLoadError(false);
                  }}
                  style={{
                    background: "#10b981", 
                    color: "white", 
                    padding: "10px 15px", 
                    borderRadius: "4px", 
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Try {useSimplePlayer ? 'VideoJS' : 'Simple'} Player
                </button>
                
                <button 
                  onClick={() => {
                    setVideoLoadError(false);
                  }}
                  style={{
                    background: "#3182ce", 
                    color: "white", 
                    padding: "10px 15px", 
                    borderRadius: "4px", 
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Retry
                </button>
                
                <a 
                  href={testVideoUrl} 
                  target="_blank"
                  style={{
                    background: "#6b7280", 
                    color: "white", 
                    padding: "10px 15px", 
                    borderRadius: "4px", 
                    textDecoration: "none", 
                    fontWeight: "bold"
                  }}
                >
                  Open in new tab
                </a>
              </div>
            </div>
          ) : useSimplePlayer ? (
            <div style={{position: "relative"}}>
              <SimpleVideoPlayer
                src={testVideoUrl}
                title="Test Video"
                preload="metadata"
                crossOrigin="anonymous"
                onPlay={() => {
                  console.log('Simple player: Video started playing');
                }}
                onError={(error) => {
                  console.error('Simple player: Video playback error:', error);
                  setVideoLoadError(true);
                }}
              />
              <div style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "rgba(0, 0, 0, 0.7)",
                color: "white",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px"
              }}>
                Simple Player
              </div>
            </div>
          ) : (
            <VideoJSPlayer
              src={testVideoUrl}
              title="Test Video"
              fluid={true}
              responsive={true}
              aspectRatio="16:9"
              playbackRates={[0.5, 1, 1.25, 1.5, 2]}
              enableHotkeys={true}
              enableTouchOverlay={true}
              preload="metadata"
              crossOrigin="anonymous"
              onPlay={() => {
                console.log('VideoJS: Video started playing');
              }}
              onError={(error) => {
                console.error('VideoJS: Video playback error:', error);
                setVideoLoadError(true);
              }}
            />
          )}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <h3>Debug Information</h3>
          <p><strong>Current Player:</strong> {useSimplePlayer ? 'Simple HTML5 Player' : 'VideoJS Player'}</p>
          <p><strong>Video URL:</strong> {testVideoUrl}</p>
          <p><strong>Error State:</strong> {videoLoadError ? 'Yes' : 'No'}</p>
          <p><strong>Instructions:</strong> Use the buttons above to switch between players. Check the browser console for detailed logs.</p>
        </div>
      </div>
    </Layout>
  );
};

export default VideoTestPage; 