import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  Settings, 
  History, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  Check, 
  FileImage, 
  Info,
  Calendar,
  Layers,
  HeartPulse
} from 'lucide-react';
import CameraScanner from './components/CameraScanner';

// Skin mapping data from user prompt
const adviceMap = {
  "carcinoma": {
    key: "carcinoma",
    name: "Potential Sun Damage Spot / Congestion",
    routine: "Focus on a strong Niacinamide serum to support your skin barrier and calm irritation.",
    healthTip: "Always wear high SPF sunscreen. Traditional face mapping suggests chronic cheek spots can link to gut health or long-term UV exposure."
  },
  "nevus": {
    key: "nevus",
    name: "Mole / Normal Pigmentation Accent",
    routine: "Keep the area moisturized using a gentle Ceramides cream.",
    healthTip: "Normal pigmentation changes over time, but stay hydrated (2-3L of water) to maintain cell health!"
  },
  "keratosis": {
    key: "keratosis",
    name: "Rough Surface Texture / Scaling",
    routine: "Incorporate a mild exfoliating active like Salicylic Acid (BHA) to smooth skin texture.",
    healthTip: "Forehead or cheek bumps are often exacerbated by poor digestion. Try keeping a clean diet for a week."
  },
  "Default": {
    key: "Default",
    name: "General Skin Irritation",
    routine: "Stick to a minimalist Hydrating Cleanser + Calming Aloe Gel routine.",
    healthTip: "Ensure you are getting 7-8 hours of deep sleep to lower cortisol stress levels affecting your skin."
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'upload'
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBytes, setImageBytes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userResult, setUserResult] = useState(null);
  const [hfToken, setHfToken] = useState(() => {
    // Initial load from localStorage
    return localStorage.getItem('dermaiq_hf_token') || '';
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dermaiq_history')) || [];
    } catch {
      return [];
    }
  });

  // Automatically save history to localstorage
  useEffect(() => {
    localStorage.setItem('dermaiq_history', JSON.stringify(history));
  }, [history]);

  // Read environment variable if available
  const getApiToken = () => {
    const envToken = import.meta.env?.VITE_HF_TOKEN || 
                     import.meta.env?.NEXT_PUBLIC_HF_TOKEN || 
                     (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_HF_TOKEN : null);
    return hfToken || envToken || '';
  };

  const hasEnvToken = !!(import.meta.env?.VITE_HF_TOKEN || 
                         import.meta.env?.NEXT_PUBLIC_HF_TOKEN || 
                         (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_HF_TOKEN : null));

  // Settings gear is visible only in local development, or if no environment token is defined.
  // Once deployed with VITE_HF_TOKEN, visitors will not see the settings panel.
  const showSettingsOption = !hasEnvToken || !!import.meta.env?.DEV;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    setImagePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBytes(reader.result);
      setUserResult(null); // Clear previous result
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  // Snap from CameraScanner component
  const handleCameraSnap = ({ bytes, previewUrl }) => {
    setImageBytes(bytes);
    setImagePreview(previewUrl);
    setUserResult(null);
    
    // Automatically trigger analysis on snap!
    // Check if token exists; if not, use mock mode so the app remains fully responsive
    const token = getApiToken();
    const useMock = !token;
    runAnalysis(useMock, bytes);
  };

  const runAnalysis = async (mock = false, bytesOverride = null) => {
    const targetBytes = bytesOverride || imageBytes;
    if (!targetBytes) return;
    setLoading(true);
    setUserResult(null);

    // Mock analysis option (great UX fallback for users without tokens)
    if (mock) {
      setTimeout(() => {
        const keys = ["carcinoma", "nevus", "keratosis", "Default"];
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const result = adviceMap[randomKey];
        setUserResult(result);
        addToHistory(result);
        setLoading(false);
      }, 2000);
      return;
    }

    const token = getApiToken();
    if (!token) {
      setLoading(false);
      alert('Please enter a Hugging Face API Token in Settings to query the live AI model.');
      setShowSettings(true);
      return;
    }

    try {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/Anwarkh1/Skin_Cancer-Image_Classification",
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "x-wait-for-model": "true"
          },
          method: "POST",
          body: targetBytes,
        }
      );
      
      const rawApiData = await response.json();
      console.log("AI Raw Predictions:", rawApiData);

      // Check if Hugging Face returned an API-level error object (e.g. Model is loading, or unauthorized)
      if (rawApiData && rawApiData.error) {
        throw new Error(rawApiData.error);
      }

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const topCondition = Array.isArray(rawApiData) && rawApiData[0] ? rawApiData[0].label : "Default";
      const cleanCondition = topCondition.toLowerCase();
      
      // Match clinical terms into friendly groups
      let key = "Default";
      if (cleanCondition.includes("carcinoma") || cleanCondition.includes("bcc") || cleanCondition.includes("melanoma") || cleanCondition.includes("mel")) {
        key = "carcinoma";
      } else if (cleanCondition.includes("nevus") || cleanCondition.includes("nevi") || cleanCondition.includes("nv")) {
        key = "nevus";
      } else if (cleanCondition.includes("keratosis") || cleanCondition.includes("keratoses") || cleanCondition.includes("akiec") || cleanCondition.includes("bkl")) {
        key = "keratosis";
      }

      const result = adviceMap[key];
      setUserResult(result);
      addToHistory(result);

    } catch (error) {
      console.error('API analysis failed:', error);
      let friendlyMessage = error.message || 'Unknown network error';
      if (friendlyMessage.toLowerCase().includes('failed to fetch')) {
        friendlyMessage = 'Failed to fetch (This usually happens if an Ad-Blocker, Brave Shield, or Privacy extension is blocking requests to Hugging Face, or if your network blocks it)';
      }
      alert(`AI API Request Failed: ${friendlyMessage}.\n\nFalling back to lifestyle analysis preview...`);
      // Fallback on error to default advice
      setUserResult(adviceMap["Default"]);
      addToHistory(adviceMap["Default"]);
    } finally {
      setLoading(false);
    }
  };

  const addToHistory = (result) => {
    const newItem = {
      id: Date.now(),
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      name: result.name,
      key: result.key,
      image: imagePreview // Save local blob url (will work during active tab session)
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const deleteHistoryItem = (id, e) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear your tracking history?')) {
      setHistory([]);
    }
  };

  const saveTokenSetting = (val) => {
    setHfToken(val);
    localStorage.setItem('dermaiq_hf_token', val);
  };

  const handleApplyHistory = (item) => {
    setImagePreview(item.image);
    setUserResult(adviceMap[item.key]);
  };

  const resultClass = userResult ? `result-${userResult.key.toLowerCase()}` : '';

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', padding: '30px 15px' }} className="flex-center">
      {/* Background ambient glowing details */}
      <div className="ambient-glow ambient-glow-1"></div>
      <div className="ambient-glow ambient-glow-2"></div>

      <div style={{ width: '100%', maxWidth: '850px', display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
        {/* Header grid */}
        <header style={{ textAlign: 'center', marginBottom: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h1 className="title-main">DermaIQ</h1>
          </div>
          <p className="subtitle-main" style={{ maxWidth: '480px' }}>
            Scan your skin layout for holistic routines, nutritional insights & wellness tracking.
          </p>
        </header>

        {/* Layout Grid: Main Control & Sidebar History */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }} className="main-app-grid">
          
          {/* Main Scanner Card */}
          <main className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Header controls inside card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => { setActiveTab('camera'); setImagePreview(null); setImageBytes(null); setUserResult(null); }}
                  className={`btn-secondary ${activeTab === 'camera' ? 'active-tab' : ''}`}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '13px',
                    borderColor: activeTab === 'camera' ? 'var(--color-accent)' : 'rgba(27, 94, 58, 0.1)',
                    background: activeTab === 'camera' ? 'var(--color-accent-glow)' : 'rgba(27, 94, 58, 0.02)'
                  }}
                >
                  📹 Live Camera
                </button>
                <button 
                  onClick={() => { setActiveTab('upload'); setImagePreview(null); setImageBytes(null); setUserResult(null); }}
                  className={`btn-secondary ${activeTab === 'upload' ? 'active-tab' : ''}`}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '13px',
                    borderColor: activeTab === 'upload' ? 'var(--color-accent)' : 'rgba(27, 94, 58, 0.1)',
                    background: activeTab === 'upload' ? 'var(--color-accent-glow)' : 'rgba(27, 94, 58, 0.02)'
                  }}
                >
                  📁 Upload Photo
                </button>
              </div>

              {/* Settings Toggle (Hidden in production if env token exists) */}
              {showSettingsOption && (
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="btn-secondary"
                  aria-label="Toggle Settings"
                  style={{ padding: '8px', borderRadius: '50%' }}
                >
                  <Settings style={{ width: '18px', height: '18px', color: showSettings ? 'var(--color-coral)' : 'inherit' }} />
                </button>
              )}
            </div>

            {/* Token settings pane */}
            {showSettings && showSettingsOption && (
              <div 
                style={{ 
                  background: 'rgba(27, 94, 58, 0.02)', 
                  border: '1px solid rgba(27, 94, 58, 0.08)',
                  padding: '16px', 
                  borderRadius: '16px', 
                  marginBottom: '20px'
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings style={{ width: '14px', height: '14px' }} />
                  Hugging Face Integration Setup
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                  This app calls the <code>skin-disease-detector-ai</code> model. 
                  Provide a Hugging Face API Token (e.g., Read access) to perform real-time model requests.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="password"
                    placeholder="paste hf_... API Token"
                    value={hfToken}
                    onChange={(e) => saveTokenSetting(e.target.value)}
                    style={{
                      flex: 1,
                      background: '#ffffff',
                      border: '1px solid rgba(27, 94, 58, 0.2)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px'
                    }}
                  />
                  {getApiToken() && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-result-default-accent)', borderRadius: '8px', fontSize: '12px', gap: '4px' }}>
                      <Check style={{ width: '14px', height: '14px' }} /> Active
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scanner Area */}
            <div style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              
              {activeTab === 'camera' ? (
                <CameraScanner onCapture={handleCameraSnap} isAnalyzing={loading} />
              ) : (
                /* Upload Tab */
                <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                  {!imagePreview ? (
                    <label 
                      className="upload-area"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <UploadCloud style={{ width: '48px', height: '48px', color: '#a8a2b3', marginBottom: '12px' }} />
                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#fcfbfa', textAlign: 'center' }}>
                        Drag & Drop or Choose Image
                      </span>
                      <span style={{ fontSize: '12px', color: '#a8a2b3', marginTop: '6px' }}>
                        Supports JPG, PNG, WebP
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange} 
                        className="visually-hidden" 
                      />
                    </label>
                  ) : (
                    /* Image preview framed matching circular scanner */
                    <div style={{ position: 'relative' }}>
                      <div className="camera-view-container" style={{ borderStyle: 'solid', borderColor: 'var(--color-accent)' }}>
                        <img 
                          src={imagePreview} 
                          alt="Face Preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        {loading && <div className="scanning-beam"></div>}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '15px' }}>
                        {!userResult && (
                          <button 
                            onClick={() => { setImagePreview(null); setImageBytes(null); setUserResult(null); }}
                            className="btn-secondary"
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                            disabled={loading}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons Trigger */}
              {imagePreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '25px', maxWidth: '320px', width: '100%', margin: '25px auto 0 auto' }}>
                  {userResult ? (
                    <button 
                      onClick={() => { setImagePreview(null); setImageBytes(null); setUserResult(null); }}
                      className="btn-primary"
                      style={{ width: '100%' }}
                    >
                      🔄 Scan New Photo / Rescan
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => runAnalysis(false)} 
                        disabled={loading} 
                        className="btn-primary"
                        style={{ width: '100%' }}
                      >
                        {loading ? 'Analyzing Skin Patterns...' : '✨ Run Live AI Scan'}
                      </button>
                      
                      {!getApiToken() && (
                        <button 
                          onClick={() => runAnalysis(true)} 
                          disabled={loading}
                          className="btn-secondary"
                          style={{ 
                            width: '100%', 
                            border: '1px dashed rgba(27, 94, 58, 0.3)',
                            color: 'var(--color-accent)' 
                          }}
                        >
                          🧪 Run Fallback Mock Scan (No Token Required)
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Results Details Card */}
            {userResult && (
              <div className={`result-card ${resultClass}`} style={{ transitionDelay: '0.1s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  <div>
                    <span className="result-tag" style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Detection Result
                    </span>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      {userResult.name}
                    </h2>
                  </div>
                </div>

                {/* suggested routine block */}
                <div className="divider" style={{ borderTop: '1px solid', padding: '12px 0', margin: '8px 0' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                    <Layers style={{ width: '14px', height: '14px', color: 'inherit' }} />
                    SUGGESTED ROUTINE
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                    {userResult.routine}
                  </p>
                </div>

                {/* wellness tip block */}
                <div style={{ margin: '8px 0 16px 0' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                    <HeartPulse style={{ width: '14px', height: '14px', color: 'inherit' }} />
                    HOLISTIC WELLNESS TRACKER
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                    {userResult.healthTip}
                  </p>
                </div>

                {/* disclaimer */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(27, 94, 58, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(27, 94, 58, 0.06)' }}>
                  <ShieldAlert style={{ width: '16px', height: '16px', color: 'var(--color-result-carcinoma-accent)', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    <strong>Screening Disclaimer:</strong> Face mapping and AI scanning offer lifestyle screening support. This app does not provide medical diagnostics. Consult a dermatologist for persistent skin concerns.
                  </p>
                </div>
              </div>
            )}
          </main>

          {/* Skin Tracking History Sidebar */}
          <aside className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit, sans-serif', color: 'var(--color-accent)' }}>
                <History style={{ width: '18px', height: '18px', color: 'var(--color-accent)' }} />
                Skin Tracking Log
              </h2>
              {history.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--color-result-carcinoma-accent)', borderColor: 'var(--color-result-carcinoma-border)', background: 'rgba(220, 38, 38, 0.02)' }}
                >
                  <Trash2 style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <Info style={{ width: '32px', height: '32px', margin: '0 auto 10px auto', opacity: 0.5 }} />
                <p style={{ fontSize: '13px' }}>No previous logs found.</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Scan your skin patterns to begin tracking changes.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {history.map((item) => {
                  const tagColorMap = {
                    carcinoma: 'var(--color-result-carcinoma-accent)',
                    nevus: 'var(--color-result-nevus-accent)',
                    keratosis: 'var(--color-result-keratosis-accent)',
                    Default: 'var(--color-result-default-accent)'
                  };
                  const color = tagColorMap[item.key] || 'var(--color-result-default-accent)';

                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleApplyHistory(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px',
                        background: 'rgba(27, 94, 58, 0.02)',
                        border: '1px solid rgba(27, 94, 58, 0.05)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      className="history-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt="" 
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${color}` }} 
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(27,94,58,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileImage style={{ width: '16px', height: '16px', color: 'var(--color-text-secondary)' }} />
                          </div>
                        )}
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                            {item.name}
                          </p>
                          <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar style={{ width: '10px', height: '10px' }} />
                            {item.date}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)' }}
                        className="history-delete-btn"
                        aria-label="Delete entry"
                      >
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

        </div>
      </div>
    </div>
  );
}
