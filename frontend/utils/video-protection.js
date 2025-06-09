// Video Download Protection Utilities

/**
 * Initializes video download protection for the current page
 */
export const initVideoProtection = () => {
  // Disable right-click context menu on video elements
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'VIDEO' || e.target.closest('.video-protected')) {
      e.preventDefault();
      return false;
    }
  });

  // Disable keyboard shortcuts that could be used to download or inspect
  document.addEventListener('keydown', (e) => {
    // Check if we're in a video-protected area
    if (e.target.closest('.video-protected')) {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J, Ctrl+S
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'S')
      ) {
        e.preventDefault();
        return false;
      }
    }
  });

  // Clear console periodically to remove any logged URLs
  setInterval(() => {
    if (document.querySelector('.video-protected')) {
      console.clear();
    }
  }, 5000);
};

/**
 * Applies protection to a specific video element
 */
export const protectVideoElement = (videoElement) => {
  if (!videoElement || videoElement.tagName !== 'VIDEO') {
    return;
  }

  // Set security attributes (allow fullscreen and PiP for better UX)
  videoElement.setAttribute('controlsList', 'nodownload noremoteplayback');
  videoElement.setAttribute('disablePictureInPicture', 'false');
  videoElement.setAttribute('disableRemotePlayback', 'true');
  videoElement.setAttribute('draggable', 'false');

  // Add protection class
  videoElement.classList.add('video-protected');
}; 