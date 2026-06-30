import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

export default function CameraScanner({ onCapture, isAnalyzing }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Start the camera stream
  const startCamera = async () => {
    setErrorMsg('');
    try {
      if (streamRef.current) {
        stopCamera();
      }

      let stream;
      try {
        // Try with user-facing constraints first
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 640 }
          },
          audio: false
        });
      } catch (firstErr) {
        console.warn('Initial webcam constraints failed, trying basic video fallback...', firstErr);
        // Fallback to minimal constraints (maximizes compatibility across webcams)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setHasPermission(true);
      setIsActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setIsActive(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access was denied. Please allow camera permissions in your browser address bar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('No camera hardware detected on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMsg('Camera is locked by another tab or program. Please close other apps using the webcam and refresh.');
      } else {
        setErrorMsg(`Camera error (${err.name}): ${err.message || 'Check browser security permissions.'}`);
      }
    }
  };

  // Stop the camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  // Capture current frame from video and convert to ArrayBuffer
  const captureFrame = () => {
    if (!videoRef.current || !isActive) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Use the actual resolution of the video stream
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    
    // Mirror drawing since we mirrored the video stream visually
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    // Crop video to a square centered crop
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Send ArrayBuffer and a preview URL to parent
          onCapture({
            bytes: reader.result,
            previewUrl: URL.createObjectURL(blob)
          });
        };
        reader.readAsArrayBuffer(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  // Auto clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div style={{ width: '100%' }}>
      {/* 1. Camera Placeholder (rendered when camera is not active) */}
      <div 
        onClick={startCamera}
        style={{
          width: '100%',
          aspectRatio: '1',
          maxWidth: '320px',
          margin: '0 auto 1.5rem auto',
          borderRadius: '50%',
          border: '2px dashed rgba(27, 94, 58, 0.15)',
          background: 'rgba(27, 94, 58, 0.01)',
          display: !isActive ? 'flex' : 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '20px',
          textAlign: 'center',
          transition: 'all 0.3s ease'
        }}
        className="camera-placeholder"
      >
        <Camera style={{ width: '48px', height: '48px', color: 'var(--color-text-secondary)', marginBottom: '12px' }} />
        <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
          Enable Live Camera Scanner
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
          Uses secure front-camera capture
        </span>
        
        {errorMsg && (
          <p style={{ color: 'var(--color-result-carcinoma-accent)', fontSize: '12px', marginTop: '12px', maxWidth: '80%' }}>
            {errorMsg}
          </p>
        )}
      </div>

      {/* 2. Video Player Stream (rendered when camera is active) */}
      <div style={{ display: isActive ? 'block' : 'none', position: 'relative' }}>
        <div className="camera-view-container">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="camera-video"
          />
          
          {/* Live Indicator Badge */}
          <div className="live-badge">
            <span className="live-badge-dot"></span>
            LIVE SCANNER
          </div>

          {/* Scanning Laser Beam Effect */}
          {(isAnalyzing || isActive) && <div className="scanning-beam"></div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '15px' }}>
          <button 
            onClick={captureFrame} 
            disabled={isAnalyzing}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '14px' }}
          >
            <Camera style={{ width: '16px', height: '16px' }} />
            Snap Photo
          </button>
          <button 
            onClick={stopCamera} 
            disabled={isAnalyzing}
            className="btn-secondary"
            style={{ padding: '10px 16px', fontSize: '14px' }}
          >
            <CameraOff style={{ width: '16px', height: '16px' }} />
            Disable
          </button>
        </div>
      </div>
    </div>
  );
}
