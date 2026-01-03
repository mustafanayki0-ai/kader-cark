'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

// --- TİP TANIMLAMALARI ---
interface Bird {
  x: number;
  y: number;
  velocity: number;
  width: number;
  height: number;
  rotation: number;
}

interface Pipe {
  x: number;
  y: number;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export default function FlappyEtkaBreakfast() {
  // --- STATE (UI) ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showMenu, setShowMenu] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);

  // --- REFS (Oyun Motoru) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START');

  // Oyun Objeleri (Peynir biraz daha geniş)
  const bird = useRef<Bird>({ x: 50, y: 150, velocity: 0, width: 44, height: 32, rotation: 0 });
  const pipes = useRef<Pipe[]>([]);
  const particles = useRef<Particle[]>([]);
  
  // Değişkenler
  const frames = useRef(0);
  const scoreRef = useRef(0);

  // --- AYARLAR ---
  const GRAVITY = 0.25;
  const JUMP_STRENGTH = 4.6;
  const PIPE_WIDTH = 55; // Ekmek dilimi genişliği
  const PIPE_GAP = 145; // Aradan geçiş boşluğu
  const BASE_SPEED = 2.2;
  const SCREEN_WIDTH = 360;
  const SCREEN_HEIGHT = 600;

  // --- SES MOTORU (Değişmedi) ---
  const playSound = useCallback((type: 'jump' | 'score' | 'hit') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'jump') {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'score') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) { console.log("Ses hatası"); }
  }, []);

  // --- BAŞLANGIÇ ---
  useEffect(() => {
    const saved = localStorage.getItem('flappyHighScore');
    if (saved) setHighScore(parseInt(saved));
    
    if (!requestRef.current) requestRef.current = requestAnimationFrame(loop);

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const resetGame = () => {
    bird.current = { x: 60, y: SCREEN_HEIGHT / 2, velocity: 0, width: 44, height: 32, rotation: 0 };
    pipes.current = [];
    particles.current = [];
    scoreRef.current = 0;
    frames.current = 0;
    
    setScore(0);
    setIsGameOver(false);
    setShowMenu(false);
    gameStateRef.current = 'PLAYING';
    
    if (!requestRef.current) loop();
    jump();
  };

  const jump = () => {
    if (gameStateRef.current !== 'PLAYING') return;
    bird.current.velocity = -JUMP_STRENGTH;
    bird.current.rotation = -25 * Math.PI / 180;
    playSound('jump');
    
    // Peynir kırıntıları
    for (let i = 0; i < 4; i++) {
        particles.current.push({
            x: bird.current.x,
            y: bird.current.y + bird.current.height,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 3,
            life: 0.8,
            color: '#fdd835',
            size: Math.random() * 4 + 2
        });
    }
  };

  // --- OYUN DÖNGÜSÜ ---
  const loop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx) {
        if (gameStateRef.current === 'PLAYING') update(canvas);
        draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  const update = (canvas: HTMLCanvasElement) => {
    frames.current++;
    const speed = BASE_SPEED + (scoreRef.current * 0.05);

    // Peynir Fiziği
    bird.current.velocity += GRAVITY;
    bird.current.y += bird.current.velocity;
    if (bird.current.velocity > 0) bird.current.rotation = Math.min(bird.current.rotation + 0.05, 1.5);

    if (bird.current.y + bird.current.height >= SCREEN_HEIGHT - 30) handleGameOver();

    // Ekmek (Boru) Mantığı
    if (frames.current % Math.floor(120 / (1 + scoreRef.current * 0.05)) === 0) {
        const pipeY = Math.random() * (SCREEN_HEIGHT - PIPE_GAP - 100) + 50;
        pipes.current.push({ x: SCREEN_WIDTH, y: pipeY, passed: false });
    }

    for (let i = 0; i < pipes.current.length; i++) {
        let p = pipes.current[i];
        p.x -= speed;

        // Çarpışma
        if (
            bird.current.x + bird.current.width > p.x &&
            bird.current.x < p.x + PIPE_WIDTH &&
            (bird.current.y < p.y || bird.current.y + bird.current.height > p.y + PIPE_GAP)
        ) handleGameOver();

        // Skor
        if (p.x + PIPE_WIDTH < bird.current.x && !p.passed) {
            scoreRef.current++;
            setScore(scoreRef.current);
            playSound('score');
            p.passed = true;
        }

        if (p.x + PIPE_WIDTH < 0) {
            pipes.current.shift();
            i--;
        }
    }
    
    // Partiküller
    for (let i = 0; i < particles.current.length; i++) {
        let pt = particles.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.03;
        if(pt.life <= 0) { particles.current.splice(i, 1); i--; }
    }
  };

  const handleGameOver = () => {
    if (gameStateRef.current === 'GAMEOVER') return;
    gameStateRef.current = 'GAMEOVER';
    setIsGameOver(true);
    playSound('hit');
    if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
        localStorage.setItem('flappyHighScore', scoreRef.current.toString());
    }
  };

  // --- ÇİZİM MOTORU (MUTFAK TEMASI) ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    // 1. Arkaplan: Mutfak Fayansları
    ctx.fillStyle = '#e3f2fd'; // Açık mavi duvar
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // Fayans Çizgileri
    ctx.strokeStyle = '#bbdefb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Dikey çizgiler
    for(let x=0; x<SCREEN_WIDTH; x+=40) {
        ctx.moveTo(x, 0); ctx.lineTo(x, SCREEN_HEIGHT);
    }
    // Yatay çizgiler
    for(let y=0; y<SCREEN_HEIGHT; y+=40) {
        ctx.moveTo(0, y); ctx.lineTo(SCREEN_WIDTH, y);
    }
    ctx.stroke();

    // 2. Ekmekler (Borular)
    pipes.current.forEach(p => {
        // Ekmek Rengi (Kızarmış)
        ctx.fillStyle = '#f5deb3'; // Ekmek içi rengi
        ctx.strokeStyle = '#8d6e63'; // Kabuk rengi
        ctx.lineWidth = 4;

        // Üst Ekmek
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.y);
        ctx.strokeRect(p.x, -5, PIPE_WIDTH, p.y + 5); // Üstten taşsın
        
        // Ekmek Dokusu (Benekler)
        ctx.fillStyle = '#d7ccc8';
        ctx.beginPath();
        ctx.arc(p.x + 10, p.y - 20, 3, 0, Math.PI*2);
        ctx.arc(p.x + 30, p.y - 60, 4, 0, Math.PI*2);
        ctx.fill();

        // Alt Ekmek
        ctx.fillStyle = '#f5deb3';
        ctx.fillRect(p.x, p.y + PIPE_GAP, PIPE_WIDTH, SCREEN_HEIGHT);
        ctx.strokeRect(p.x, p.y + PIPE_GAP, PIPE_WIDTH, SCREEN_HEIGHT);
        
        // Alt Ekmek Dokusu
        ctx.fillStyle = '#d7ccc8';
        ctx.beginPath();
        ctx.arc(p.x + 15, p.y + PIPE_GAP + 40, 3, 0, Math.PI*2);
        ctx.fill();
    });

    // 3. Zemin (Mutfak Tezgahı)
    ctx.fillStyle = '#5d4037'; // Koyu Ahşap/Mermer
    ctx.fillRect(0, SCREEN_HEIGHT - 30, SCREEN_WIDTH, 30);
    // Tezgah Parlaması
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, SCREEN_HEIGHT - 30, SCREEN_WIDTH, 5);

    // 4. PEYNİR (Karakter)
    if (gameStateRef.current !== 'GAMEOVER' || frames.current % 10 < 5) {
        ctx.save();
        ctx.translate(bird.current.x + bird.current.width/2, bird.current.y + bird.current.height/2);
        ctx.rotate(bird.current.rotation);
        
        // Peynir Üçgeni
        ctx.beginPath();
        ctx.moveTo(-bird.current.width/2, -bird.current.height/2); // Sol üst
        ctx.lineTo(bird.current.width/2, 0); // Sağ uç (Burun)
        ctx.lineTo(-bird.current.width/2, bird.current.height/2); // Sol alt
        ctx.closePath();
        
        // Peynir Rengi (Gradient)
        const cheeseGrad = ctx.createLinearGradient(-20, -20, 20, 20);
        cheeseGrad.addColorStop(0, '#fff176');
        cheeseGrad.addColorStop(1, '#fbc02d');
        ctx.fillStyle = cheeseGrad;
        ctx.fill();
        
        // Kenar Çizgisi
        ctx.strokeStyle = '#f57f17';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Peynir Delikleri
        ctx.fillStyle = '#f9a825'; // Koyu turuncu delikler
        ctx.beginPath(); ctx.arc(-5, -5, 5, 0, Math.PI*2); ctx.fill(); // Büyük delik
        ctx.beginPath(); ctx.arc(5, 5, 3, 0, Math.PI*2); ctx.fill();  // Küçük delik
        ctx.beginPath(); ctx.arc(-8, 8, 2, 0, Math.PI*2); ctx.fill(); // Minik delik

        ctx.restore();
    }

    // 5. Partiküller (Kırıntılar)
    particles.current.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
  };

  // --- KONTROLLER ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameStateRef.current === 'START' || gameStateRef.current === 'GAMEOVER') resetGame();
            else jump();
        }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
        position: 'relative',
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#3e2723', // Arka plan kahve (uygulama dışı)
        fontFamily: "'Courier New', Courier, monospace",
        touchAction: 'none'
    }}>
        {/* --- 1. ANA SAYFA BUTONU --- */}
        <Link href="/" style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 15px',
            backgroundColor: '#fff8e1',
            color: '#5d4037',
            textDecoration: 'none',
            borderRadius: '8px',
            border: '2px solid #5d4037',
            fontWeight: 'bold',
            boxShadow: '0 4px 0 #3e2723',
            zIndex: 100,
            transition: 'transform 0.1s'
        }}>
            🏠 Ana Sayfa
        </Link>

        {/* --- 2. OYUN BAŞLIĞI --- */}
        <h1 style={{
            color: '#ffecb3',
            fontSize: '48px',
            marginBottom: '20px',
            textShadow: '4px 4px 0 #3e2723, -2px -2px 0 #6d4c41',
            letterSpacing: '5px',
            fontWeight: '900',
            textAlign: 'center'
        }}>
            FLAPPY ETKA
        </h1>

        <div style={{ position: 'relative', width: SCREEN_WIDTH, height: SCREEN_HEIGHT, overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.5)', borderRadius: '12px', border: '8px solid #5d4037' }}>
            
            <canvas 
                ref={canvasRef} 
                width={SCREEN_WIDTH} 
                height={SCREEN_HEIGHT}
                onMouseDown={() => {
                    if (gameStateRef.current === 'PLAYING') jump();
                    else resetGame();
                }}
                style={{ display: 'block' }}
            />

            {/* SKOR TABELASI (Gram Kaşar) */}
            <div style={{ position: 'absolute', top: 30, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
                <span style={{ 
                    fontSize: '60px', 
                    fontWeight: '900', 
                    color: '#fff', 
                    textShadow: '3px 3px 0 #000, 0 0 10px rgba(0,0,0,0.5)',
                    display: 'block',
                    lineHeight: '1'
                }}>
                    {score}
                </span>
                <span style={{
                    fontSize: '20px',
                    color: '#fff',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0 #000',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    padding: '4px 10px',
                    borderRadius: '15px'
                }}>gr KAŞAR</span>
            </div>

            {(showMenu || isGameOver) && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: 'white'
                }}>
                    {isGameOver ? (
                        <>
                            <h2 style={{ color: '#ffab91', fontSize: '48px', margin: 0, textShadow: '2px 2px #000' }}>saclarini kes etiqa!</h2>
                            <p style={{ fontSize: '24px', marginTop: '10px' }}>Toplanan: {score} gr</p>
                            <p style={{ color: '#ffe082', fontSize: '16px' }}>En Çok: {highScore} gr</p>
                        </>
                    ) : (
                        <>
                            <h2 style={{ color: '#fff59d', fontSize: '36px', margin: '0 0 10px 0', textShadow: '3px 3px 0 #000', textAlign:'center' }}>etka saclarini kes</h2>
                            <p style={{fontSize: '16px', opacity: 0.9}}>Ekmeklere değme!</p>
                        </>
                    )}
                    
                    <button 
                        onClick={resetGame}
                        style={{
                            marginTop: '25px', padding: '15px 40px', fontSize: '20px', fontWeight: 'bold',
                            backgroundColor: '#ffb74d', color: '#3e2723', border: 'none', borderRadius: '30px',
                            cursor: 'pointer', boxShadow: '0 4px 0 #e65100', transition: 'transform 0.1s'
                        }}
                    >
                        {isGameOver ? 'TEKRAR DENE' : 'BAŞLA'}
                    </button>
                </div>
            )}
        </div>
        
        <p style={{color: '#a1887f', marginTop: '10px', fontSize: '12px'}}>v3.0 • Breakfast Edition 🧀</p>
    </div>
  );
}