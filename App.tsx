import React, { useState } from 'react';
import { analyzeMeetingMedia, analyzeUploadedImage } from './services/geminiService';
import AnalysisDashboard from './components/AnalysisDashboard';
import { MeetingAnalysisResult, AnalysisStatus } from './types';

function App() {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisResult, setAnalysisResult] = useState<MeetingAnalysisResult | null>(null);
  const [progressText, setProgressText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setErrorMsg("");
    setAnalysisResult(null);

    // Simple image analysis mode check (if needed later), for now we focus on the Meeting Blueprint
    if (file.type.startsWith('image/')) {
        setStatus(AnalysisStatus.ANALYZING);
        setProgressText("Analyzing image...");
        try {
            // Just a demo alert for the image requirement, integrating properly requires a different UI view
            // The main requirement is the Meeting Intelligence.
            // We'll treat images as "meeting slides" context for now in a full app, 
            // but here we will just alert the analysis for simplicity or log it.
            const text = await analyzeUploadedImage(file);
            alert("Image Analysis (Gemini 3 Pro): \n" + text);
            setStatus(AnalysisStatus.IDLE);
        } catch (e) {
            console.error(e);
            setStatus(AnalysisStatus.ERROR);
        }
        return;
    }

    // Meeting media processing
    try {
      setStatus(AnalysisStatus.UPLOADING);
      // Analyze with Gemini 3 Pro (Thinking Mode)
      const result = await analyzeMeetingMedia(file, (msg) => {
        if (msg.includes("Thinking")) setStatus(AnalysisStatus.THINKING);
        setProgressText(msg);
      });
      
      setAnalysisResult(result);
      setStatus(AnalysisStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "An unknown error occurred");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  if (status === AnalysisStatus.COMPLETED && analysisResult) {
    return <AnalysisDashboard data={analysisResult} onReset={() => setStatus(AnalysisStatus.IDLE)} />;
  }

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop')] bg-cover bg-center flex items-center justify-center relative">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-2xl px-6">
        <div className="text-center mb-10">
           <div className="inline-flex items-center justify-center p-3 bg-indigo-500/20 rounded-2xl mb-4 border border-indigo-500/30">
             <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
             </svg>
           </div>
           <h1 className="text-5xl font-bold text-white tracking-tight mb-4">SmartMeet Intel</h1>
           <p className="text-lg text-slate-400 max-w-lg mx-auto">
             Upload your meeting recordings (audio or video). 
             Gemini 3 Pro will watch, listen, think, and structure your data.
           </p>
        </div>

        {status === AnalysisStatus.IDLE || status === AnalysisStatus.ERROR ? (
          <div className="bg-slate-900/80 border border-slate-700 rounded-3xl p-8 backdrop-blur-md shadow-2xl transition-all hover:border-indigo-500/50">
            <div className="border-2 border-dashed border-slate-600 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-800/50 transition-colors relative group">
              <input 
                type="file" 
                onChange={handleFileUpload} 
                accept="audio/*,video/*,image/*" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Upload Recording</h3>
              <p className="text-slate-400 text-sm">Supports large files (up to 2GB) - MP3, WAV, MP4, MOV</p>
            </div>
            {status === AnalysisStatus.ERROR && (
               <div className="mt-4 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-200 text-sm flex items-center gap-2">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 {errorMsg || "Something went wrong. Please check your API key and try again."}
               </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-700 rounded-3xl p-12 backdrop-blur-md shadow-2xl text-center">
             <div className="relative w-24 h-24 mx-auto mb-6">
               <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
               {status === AnalysisStatus.THINKING && (
                 <div className="absolute inset-0 flex items-center justify-center">
                   <span className="text-2xl">🧠</span>
                 </div>
               )}
             </div>
             <h3 className="text-2xl font-bold text-white mb-2">
               {status === AnalysisStatus.UPLOADING ? 'Uploading Media...' : 
                status === AnalysisStatus.THINKING ? 'Gemini is Thinking...' : 'Finalizing Analysis...'}
             </h3>
             <p className="text-slate-400 animate-pulse">{progressText || "Please wait while we process your meeting."}</p>
             
             {status === AnalysisStatus.THINKING && (
               <div className="mt-6 p-4 bg-indigo-900/20 rounded-xl border border-indigo-500/20">
                 <p className="text-sm text-indigo-300">
                   Using <b>Gemini 3 Pro</b> with <b>Thinking Budget (32k)</b> to perform deep reasoning on video context and speaker sentiment.
                 </p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;