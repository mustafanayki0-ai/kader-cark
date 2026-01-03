"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link"; // Link için gerekli

/**
 * ==============================================================================
 * PROJE: KADER ÇARKI (DESTINY WHEEL)
 * GELİŞTİRİCİ: MUSTAFA SİRAC NAYKİ
 * AÇIKLAMA: Supabase destekli karar çarkı + Flappy Etka Butonu Eklendi
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. SUPABASE AYARLARI
// ------------------------------------------------------------------------------
const SUPABASE_URL = "https://wqmkqyehfxxurxhblagu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxbWtxeWVoZnh4dXJ4aGJsYWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTQwNjksImV4cCI6MjA4MzAzMDA2OX0.VbEAKjzVBNUZ8f9OJz-p13rQ48J1Yb_CZ6HXGwsjg3I";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------------------------------------------------------------
// 2. TİP TANIMLAMALARI
// ------------------------------------------------------------------------------
interface Decision {
  id: number;
  user_name: string;
  result: "SAĞ" | "SOL";
  created_at: string;
}

interface Stats {
  leftCount: number;
  rightCount: number;
  total: number;
}

// ------------------------------------------------------------------------------
// 3. IKON KOMPONENTLERİ
// ------------------------------------------------------------------------------
const UserIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LeftArrowIcon = () => (
  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const RightArrowIcon = () => (
  <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

// ------------------------------------------------------------------------------
// 4. ARKA PLAN WATERMARK
// ------------------------------------------------------------------------------
const WatermarkBackground = () => {
  const rows = Array.from({ length: 20 }); 
  const cols = Array.from({ length: 10 });

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none flex flex-wrap content-start opacity-[0.03] -rotate-12 scale-150">
      {rows.map((_, r) => (
        <div key={r} className="flex w-full justify-around whitespace-nowrap">
          {cols.map((_, c) => (
            <span key={c} className="text-4xl font-black text-white p-8">
              MUSTAFA SİRAC NAYKİ
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------------------
// 5. ANA SAYFA KOMPONENTİ
// ------------------------------------------------------------------------------
export default function DecisionWheelPage() {
  const [userName, setUserName] = useState("");
  const [history, setHistory] = useState<Decision[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState<Decision | null>(null);
  const [stats, setStats] = useState<Stats>({ leftCount: 0, rightCount: 0, total: 0 });

  const inputRef = useRef<HTMLInputElement>(null);

  // Veri Çekme
  useEffect(() => {
    fetchHistoryAndStats();
    const intervalId = setInterval(fetchHistoryAndStats, 2000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchHistoryAndStats = async () => {
    const { data: historyData } = await supabase
      .from("decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (historyData) {
      setHistory(historyData as Decision[]);
      const left = historyData.filter(d => d.result === "SOL").length;
      const right = historyData.filter(d => d.result === "SAĞ").length;
      setStats({
        leftCount: left,
        rightCount: right,
        total: left + right
      });
    }
  };

  // Çark Döndürme
  const handleSpin = async () => {
    if (!userName.trim()) {
      alert("Lütfen bir isim girin! Çarkı çevirmek için kimliğinizi bilmeliyiz.");
      inputRef.current?.focus();
      return;
    }
    if (isSpinning) return;

    setIsSpinning(true);
    setShowModal(false);

    const isLeftWin = Math.random() < 0.5;
    const resultText: "SOL" | "SAĞ" = isLeftWin ? "SOL" : "SAĞ";

    const minSpins = 5;
    const baseDegrees = 360 * minSpins;
    
    let targetDegree = 0;
    const randomOffset = Math.floor(Math.random() * 140) + 20;

    if (isLeftWin) {
      targetDegree = baseDegrees + 180 + randomOffset;
    } else {
      targetDegree = baseDegrees + randomOffset;
    }

    setRotation((prev) => prev + targetDegree);

    setTimeout(async () => {
      const { data, error } = await supabase
        .from("decisions")
        .insert([{ user_name: userName, result: resultText }])
        .select()
        .single();

      if (!error && data) {
        setLastResult(data as Decision);
        setShowModal(true);
      }

      setIsSpinning(false);
      fetchHistoryAndStats();
    }, 4000);
  };

  return (
    <main className="relative min-h-screen bg-[#09090b] text-slate-200 font-sans overflow-hidden flex flex-col md:flex-row">
      
      <WatermarkBackground />

      {/* --- SOL BÖLÜM: ÇARK --- */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-800 bg-[#09090b]/80 backdrop-blur-sm">
        
        <div className="mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 bg-clip-text text-transparent drop-shadow-2xl">
            KADER ÇARKI
          </h1>
          <p className="text-slate-400 mt-2 font-medium tracking-wide">
            Sağ mı, Sol mu? Kararı evrene bırak.
          </p>
        </div>

        <div className="w-full max-w-sm mb-10 relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <UserIcon />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Adınızı giriniz..."
            disabled={isSpinning}
            className="w-full bg-slate-900/90 border-2 border-slate-700 text-white rounded-xl py-4 pl-10 pr-4 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all placeholder:text-slate-600 font-semibold text-lg"
          />
        </div>

        {/* Çark Mekanizması */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-red-600 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>

          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 drop-shadow-xl">
             <div className="w-8 h-10 bg-white clip-path-polygon"></div>
             <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-white"></div>
          </div>

          <div 
            className="relative w-[320px] h-[320px] md:w-[450px] md:h-[450px] rounded-full overflow-hidden border-8 border-slate-800 shadow-2xl z-20"
            style={{
              transform: `rotate(-${rotation}deg)`,
              transition: isSpinning ? "transform 4s cubic-bezier(0.1, 0, 0.2, 1)" : "none",
            }}
          >
            <div className="w-full h-full" style={{ background: "conic-gradient(#3b82f6 0% 50%, #ef4444 50% 100%)" }}>
              <div className="absolute w-full h-full flex flex-col justify-between items-center py-12 pointer-events-none">
                <span className="text-4xl font-black text-white drop-shadow-lg tracking-widest rotate-180 opacity-90">SOL</span>
                <span className="text-4xl font-black text-white drop-shadow-lg tracking-widest opacity-90">SAĞ</span>
              </div>
              <div className="absolute top-1/2 left-0 w-full h-2 bg-slate-800/20 -translate-y-1/2"></div>
            </div>
          </div>

          <button
            onClick={handleSpin}
            disabled={isSpinning || !userName}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full z-40 border-4 border-slate-800 shadow-xl flex items-center justify-center font-black text-xl tracking-wider transition-all duration-300
              ${!userName 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : isSpinning 
                  ? 'bg-white text-slate-900 scale-90' 
                  : 'bg-white text-slate-900 hover:scale-110 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 cursor-pointer'
              }
            `}
          >
            {isSpinning ? <span className="animate-spin text-3xl">Wait</span> : "ÇEVİR"}
          </button>
        </div>
      </section>

      {/* --- SAĞ BÖLÜM: LİSTE --- */}
      <section className="relative z-10 w-full md:w-[400px] bg-[#0c0c0e]/95 border-l border-slate-800 flex flex-col h-[50vh] md:h-screen shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <HistoryIcon />
            Canlı Sonuç Akışı
          </h2>
          <p className="text-xs text-slate-500 mt-1">Sonuçlar anlık olarak güncellenir.</p>
        </div>

        <div className="px-6 py-4 border-b border-slate-800">
          <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-wider">
            <span className="text-red-500 flex items-center"><LeftArrowIcon /> Sol (%{stats.total > 0 ? Math.round((stats.leftCount / stats.total) * 100) : 0})</span>
            <span className="text-blue-500 flex items-center">Sağ (%{stats.total > 0 ? Math.round((stats.rightCount / stats.total) * 100) : 0}) <RightArrowIcon /></span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-red-500 transition-all duration-1000" 
              style={{ width: `${stats.total > 0 ? (stats.leftCount / stats.total) * 100 : 50}%` }}
            />
            <div 
              className="h-full bg-blue-500 transition-all duration-1000" 
              style={{ width: `${stats.total > 0 ? (stats.rightCount / stats.total) * 100 : 50}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <p>Henüz veri yok.</p>
              <p className="text-sm">İlk çeviren sen ol!</p>
            </div>
          ) : (
            history.map((item, index) => (
              <div 
                key={item.id}
                className="group flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-300 animate-in slide-in-from-right-4 fade-in fill-mode-backwards"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-slate-200 group-hover:text-white transition-colors">
                    {item.user_name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(item.created_at).toLocaleTimeString("tr-TR")}
                  </span>
                </div>
                
                <div className={`px-4 py-1.5 rounded-lg text-sm font-black tracking-wide shadow-lg ${
                  item.result === "SAĞ" 
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-blue-500/10" 
                    : "bg-red-500/10 text-red-400 border border-red-500/20 shadow-red-500/10"
                }`}>
                  {item.result}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-600 font-mono">
            Powered by Supabase & Mustafa Sirac Nayki
          </p>
        </div>
      </section>

      {/* --- OYUN BUTONU (YENİ EKLENDİ) --- */}
      <div className="fixed bottom-5 right-5 z-50 animate-bounce">
        <Link 
          href="/flappy-etka" 
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 px-6 rounded-full shadow-xl border-4 border-black transition-transform hover:scale-110"
        >
          <span className="text-xl">🐦</span>
          <span>OYNA</span>
        </Link>
      </div>

      {/* --- MODAL --- */}
      {showModal && lastResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#18181b] border-2 border-slate-700 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`absolute inset-0 opacity-20 ${lastResult.result === "SAĞ" ? "bg-blue-600" : "bg-red-600"}`}></div>
            <div className="relative z-10">
              <h3 className="text-xl text-slate-400 font-medium mb-2">Kaderin Kararı:</h3>
              <div className={`text-6xl font-black mb-6 ${lastResult.result === "SAĞ" ? "text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"}`}>
                {lastResult.result}
              </div>
              <p className="text-slate-300 mb-6">
                Sayın <span className="text-white font-bold">{lastResult.user_name}</span>,<br/>
                seçimin veritabanına işlendi.
              </p>
              <button 
                onClick={() => setShowModal(false)}
                className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition"
              >
                TAMAM
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}