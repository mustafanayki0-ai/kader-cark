"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ==========================================
// OYUN AYARLARI VE SABİTLERİ
// ==========================================
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.25;
const JUMP_STRENGTH = -4.5;
const PIPE_SPEED = 2;
const PIPE_SPAWN_RATE = 120; // Kare sayısı (Frame)
const PIPE_GAP = 150; 
const BIRD_SIZE = 24;
const PIPE_WIDTH = 52;

export default function FlappyEtkaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Kuşun konumu ve hızı (Ref ile performans optimizasyonu)
  const birdY = useRef(CANVAS_HEIGHT / 2);
  const birdVelocity = useRef(0);
  
  const pipes = useRef<{ x: number; topHeight: number; passed: boolean }[]>([]);
  const frameCount = useRef(0);
  const gameRunning = useRef(false);

  // ==========================================
  // OYUN FONKSİYONLARI
  // ==========================================

  const startGame = () => {
    if (gameRunning.current) return;
    
    birdY.current = CANVAS_HEIGHT / 2;
    birdVelocity.current = 0;
    pipes.current = [];
    frameCount.current = 0;
    setScore(0);
    setIsGameOver(false);
    gameRunning.current = true;

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const jump = () => {
    if (!gameRunning.current || isGameOver) return;
    birdVelocity.current = JUMP_STRENGTH;
  };

  const gameOver = () => {
    gameRunning.current = false;
    setIsGameOver(true);
    if (score > highScore) {
      setHighScore(score);
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  };

  // ==========================================
  // OYUN DÖNGÜSÜ (GAME LOOP)
  // ==========================================
  const gameLoop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    frameCount.current++;

    // --- FİZİK HESAPLAMALARI ---
    
    // Yerçekimi
    birdVelocity.current += GRAVITY;
    birdY.current += birdVelocity.current;

    // Zemin ve Tavan Kontrolü
    if (birdY.current + BIRD_SIZE / 2 >= CANVAS_HEIGHT || birdY.current - BIRD_SIZE / 2 <= 0) {
      gameOver();
      return;
    }

    // Boru Ekleme
    if (frameCount.current % PIPE_SPAWN_RATE === 0) {
      const minTop = 50;
      const maxTop = CANVAS_HEIGHT - PIPE_GAP - 50;
      const randHeight = Math.floor(Math.random() * (maxTop - minTop + 1) + minTop);
      
      pipes.current.push({ x: CANVAS_WIDTH, topHeight: randHeight, passed: false });
    }

    // Boru Hareketi ve Çarpışma
    pipes.current.forEach((pipe, index) => {
      pipe.x -= PIPE_SPEED;

      // Ekrandan çıkanı sil
      if (pipe.x + PIPE_WIDTH < 0) pipes.current.splice(index, 1);

      // Hitbox (Çarpışma Kutusu)
      const bLeft = 50 - BIRD_SIZE / 2;
      const bRight = 50 + BIRD_SIZE / 2;
      const bTop = birdY.current - BIRD_SIZE / 2;
      const bBottom = birdY.current + BIRD_SIZE / 2;

      const pLeft = pipe.x;
      const pRight = pipe.x + PIPE_WIDTH;
      const topLimit = pipe.topHeight;
      const bottomLimit = pipe.topHeight + PIPE_GAP;

      // Çarpışma var mı?
      if (bRight > pLeft && bLeft < pRight) {
        if (bTop < topLimit || bBottom > bottomLimit) {
          gameOver();
          return;
        }
      }

      // Skor
      if (!pipe.passed && bLeft > pRight) {
        setScore(prev => prev + 1);
        pipe.passed = true;
      }
    });

    // --- ÇİZİM İŞLEMLERİ ---

    // Temizle
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Arka Plan
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, "#4ade80"); 
    grad.addColorStop(1, "#60a5fa");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Borular
    ctx.fillStyle = "#166534";
    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 2;
    
    pipes.current.forEach(pipe => {
        // Üst
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        // Alt
        ctx.fillRect(pipe.x, pipe.topHeight + PIPE_GAP, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.topHeight + PIPE_GAP));
        ctx.strokeRect(pipe.x, pipe.topHeight + PIPE_GAP, PIPE_WIDTH, CANVAS_HEIGHT - (pipe.topHeight + PIPE_GAP));
    });

    // Etka Kuşu (Kare şeklinde)
    ctx.save();
    ctx.translate(50, birdY.current);
    const rot = Math.min(Math.max(birdVelocity.current * 0.1, -0.5), 0.5);
    ctx.rotate(rot);

    ctx.fillStyle = "#fbbf24"; // Sarı
    ctx.fillRect(-BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
    
    ctx.strokeStyle = "#b45309";
    ctx.strokeRect(-BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
    
    // Göz ve Gaga
    ctx.fillStyle = "white"; ctx.fillRect(4, -6, 8, 8);
    ctx.fillStyle = "black"; ctx.fillRect(8, -4, 4, 4);
    ctx.fillStyle = "#ea580c"; ctx.fillRect(BIRD_SIZE/2 - 2, 0, 8, 6);

    ctx.restore();

    // Skor Yazısı
    ctx.fillStyle = "white";
    ctx.font = "bold 40px sans-serif";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.strokeText(score.toString(), CANVAS_WIDTH / 2 - 15, 80);
    ctx.fillText(score.toString(), CANVAS_WIDTH / 2 - 15, 80);

    if (gameRunning.current) {
        requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  // --- KONTROLLER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        (!gameRunning.current && !isGameOver) ? startGame() : jump();
      }
    };
    const handleTouch = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        (!gameRunning.current && !isGameOver) ? startGame() : jump();
    };

    window.addEventListener("keydown", handleKeyDown);
    // Mouse ve Touch olaylarını canvas'a bağla
    if(canvasRef.current) {
        canvasRef.current.addEventListener("mousedown", handleTouch as any);
        canvasRef.current.addEventListener("touchstart", handleTouch as any, { passive: false });
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if(canvasRef.current) {
          canvasRef.current.removeEventListener("mousedown", handleTouch as any);
          canvasRef.current.removeEventListener("touchstart", handleTouch as any);
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isGameOver]);

  // İlk Ekran Çizimi
  useEffect(() => {
    if (!gameRunning.current && !isGameOver) {
        const ctx = canvasRef.current?.getContext("2d");
        if(ctx) {
            ctx.fillStyle = "#60a5fa"; ctx.fillRect(0,0,CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = "white"; ctx.font = "bold 20px sans-serif";
            ctx.fillText("Başlamak için Tıkla", 100, CANVAS_HEIGHT/2);
        }
    }
  }, [isGameOver]);

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Geri Dön Butonu */}
      <div className="absolute top-5 left-5 z-20">
         <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
           <span>⬅️</span> Ana Sayfa
         </Link>
      </div>

      <div className="text-center mb-4 z-10">
        <h1 className="text-5xl font-black text-yellow-400 drop-shadow-lg tracking-tighter">
          FLAPPY ETKA
        </h1>
      </div>

      <div className="relative group shadow-2xl rounded-xl overflow-hidden border-4 border-slate-700">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-slate-800 cursor-pointer block"
          style={{ maxWidth: '100%', height: 'auto' }}
        ></canvas>

        {isGameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center animate-in zoom-in-95">
            <h2 className="text-4xl font-bold text-red-500 mb-4">OYUN BİTTİ</h2>
            <div className="bg-slate-800 p-6 rounded-lg text-center border border-slate-600 mb-6">
               <p className="text-slate-400 text-sm">SKOR</p>
               <p className="text-4xl font-bold text-yellow-400">{score}</p>
               <hr className="my-2 border-slate-600"/>
               <p className="text-slate-400 text-sm">REKOR</p>
               <p className="text-2xl font-bold text-green-400">{highScore}</p>
            </div>
            <button
              onClick={startGame}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full transition transform hover:scale-105"
            >
              TEKRAR OYNA
            </button>
          </div>
        )}
      </div>
      
      <p className="text-slate-500 mt-4 text-sm">Zıplamak için ekrana dokun veya Boşluk tuşuna bas.</p>
    </main>
  );
}