'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

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

interface Cloud {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export default function FlappyEtkaFixed() {
  // --- STATE (Sadece Görüntü/UI için) ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showMenu, setShowMenu] = useState(true); // Menü kontrolü
  const [isGameOver, setIsGameOver] = useState(false);

  // --- REFS (Oyun Motoru için - Anlık Veri) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const gameStateRef = useRef<'START' | 'PLAYING' | 'GAMEOVER'>('START'); // State yerine Ref kullanıyoruz!

  // Oyun Objeleri
  const bird = useRef<Bird>({ x: 50, y: 150, velocity: 0, width: 34, height: 28, rotation: 0 });
  const pipes = useRef<Pipe[]>([]);
  const particles = useRef<Particle[]>([]);
  const clouds = useRef<Cloud[]>([]);
  
  // Değişkenler
  const frames = useRef(0);
  const scoreRef = useRef(0);

  // --- AYARLAR ---
  const GRAVITY = 0.25;
  const JUMP_STRENGTH = 4.6;
  const PIPE_WIDTH = 52;
  const PIPE_GAP = 140;
  const BASE_SPEED = 2.2;
  const SCREEN_WIDTH = 360;
  const SCREEN_HEIGHT = 600;

  // --- GÜVENLİ SES MOTORU ---
  const playSound = useCallback((type: 'jump' | 'score' | 'hit') => {
    // Tarayıcıda çalışmıyorsa veya hata verirse oyunu bozma
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
    } catch (e) {
      // Ses hatası olursa yoksay
      console.log("Ses çalınamadı");
    }
  }, []);

  // --- BAŞLANGIÇ ---
  useEffect(() => {
    const saved = localStorage.getItem('flappyHighScore');
    if (saved) setHighScore(parseInt(saved));

    // İlk bulutları oluştur
    for(let i=0; i<5; i++) clouds.current.push(createCloud(true));
    
    // Döngüyü başlat (Sadece çizim yapar, oyun başlamaz)
    if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(loop);
    }

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- YARDIMCI FONKSİYONLAR ---
  const createCloud = (randomX = false): Cloud => ({
    x: randomX ? Math.random() * SCREEN_WIDTH : SCREEN_WIDTH + 50,
    y: Math.random() * (SCREEN_HEIGHT / 2),
    speed: 0.5 + Math.random() * 0.5,
    size: 20 + Math.random() * 30
  });

  const resetGame = () => {
    bird.current = { x: 60, y: SCREEN_HEIGHT / 2, velocity: 0, width: 34, height: 28, rotation: 0 };
    pipes.current = [];
    particles.current = [];
    scoreRef.current = 0;
    frames.current = 0;
    
    setScore(0);
    setIsGameOver(false);
    setShowMenu(false);
    
    // Kritik Düzeltme: State yerine Ref güncelliyoruz
    gameStateRef.current = 'PLAYING';
    
    // Döngü durmuşsa yeniden başlat
    if (!requestRef.current) {
        loop();
    }
    
    jump(); // Başlar başlamaz zıpla
  };

  const jump = () => {
    if (gameStateRef.current !== 'PLAYING') return;
    
    bird.current.velocity = -JUMP_STRENGTH;
    bird.current.rotation = -25 * Math.PI / 180;
    playSound('jump');
    
    // Toz efekti
    for (let i = 0; i < 5; i++) {
        particles.current.push({
            x: bird.current.x,
            y: bird.current.y + bird.current.height,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 2,
            life: 0.8,
            color: 'rgba(255,255,255,0.6)',
            size: Math.random() * 3
        });
    }
  };

  // --- OYUN DÖNGÜSÜ (ANA MOTOR) ---
  const loop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx) {
        // Fizik güncelleme (Sadece oyun oynanıyorsa)
        if (gameStateRef.current === 'PLAYING') {
            update(canvas);
        } else {
            // Arkaplan animasyonu (oyun dursa bile bulutlar aksın)
            updateBackground();
        }
        
        // Çizim (Her zaman)
        draw(ctx);
    }

    requestRef.current = requestAnimationFrame(loop);
  };

  const updateBackground = () => {
     clouds.current.forEach(c => c.x -= c.speed);
     clouds.current = clouds.current.filter(c => c.x + c.size > -50);
     if (Math.random() < 0.01) clouds.current.push(createCloud());
  };

  const update = (canvas: HTMLCanvasElement) => {
    frames.current++;
    const speed = BASE_SPEED + (scoreRef.current * 0.05);

    // 1. Kuş
    bird.current.velocity += GRAVITY;
    bird.current.y += bird.current.velocity;
    if (bird.current.velocity > 0) {
        bird.current.rotation = Math.min(bird.current.rotation + 0.05, 1.5);
    }

    // Zemin Çarpması
    if (bird.current.y + bird.current.height >= SCREEN_HEIGHT - 20) {
        handleGameOver();
    }

    // 2. Borular
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
        ) {
            handleGameOver();
        }

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

    updateBackground();
    
    // 3. Partiküller
    for (let i = 0; i < particles.current.length; i++) {
        let pt = particles.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.02;
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

  // --- ÇİZİM ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    // Arkaplan
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Bulutlar
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    clouds.current.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Borular
    pipes.current.forEach(p => {
        const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        grad.addColorStop(0, '#43a047');
        grad.addColorStop(0.5, '#66bb6a');
        grad.addColorStop(1, '#2e7d32');
        ctx.fillStyle = grad;
        
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.y); // Üst
        ctx.fillRect(p.x - 2, p.y - 20, PIPE_WIDTH + 4, 20); // Üst Başlık
        
        ctx.fillRect(p.x, p.y + PIPE_GAP, PIPE_WIDTH, SCREEN_HEIGHT); // Alt
        ctx.fillRect(p.x - 2, p.y + PIPE_GAP, PIPE_WIDTH + 4, 20); // Alt Başlık
    });

    // Zemin
    ctx.fillStyle = '#d84315';
    ctx.fillRect(0, SCREEN_HEIGHT - 20, SCREEN_WIDTH, 20);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, SCREEN_HEIGHT - 25, SCREEN_WIDTH, 5);

    // Kuş
    if (gameStateRef.current !== 'GAMEOVER' || frames.current % 10 < 5) { // Yanınca yanıp sönme
        ctx.save();
        ctx.translate(bird.current.x + bird.current.width/2, bird.current.y + bird.current.height/2);
        ctx.rotate(bird.current.rotation);
        
        ctx.fillStyle = '#fdd835'; // Sarı gövde
        ctx.fillRect(-bird.current.width/2, -bird.current.height/2, bird.current.width, bird.current.height);
        
        ctx.fillStyle = '#fff'; // Göz
        ctx.fillRect(6, -10, 10, 10);
        ctx.fillStyle = '#000'; // Göz bebeği
        ctx.fillRect(12, -8, 4, 4);
        
        ctx.fillStyle = '#f57c00'; // Gaga
        ctx.fillRect(10, 2, 12, 8);
        
        ctx.restore();
    }

    // Partiküller
    particles.current.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.globalAlpha = 1.0;
    });
  };

  // --- KONTROLLER ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameStateRef.current === 'START' || gameStateRef.current === 'GAMEOVER') {
                resetGame();
            } else {
                jump();
            }
        }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#222',
        fontFamily: 'sans-serif'
    }}>
        <div style={{ position: 'relative', width: SCREEN_WIDTH, height: SCREEN_HEIGHT, overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.5)', borderRadius: '10px' }}>
            
            {/* OYUN ALANI */}
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

            {/* SKOR */}
            <div style={{ position: 'absolute', top: 20, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: '50px', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 0 #000' }}>{score}</span>
            </div>

            {/* MENÜLER */}
            {(showMenu || isGameOver) && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: 'white'
                }}>
                    {isGameOver ? (
                        <>
                            <h1 style={{ color: '#ff5252', fontSize: '48px', margin: 0 }}>YANDIN!</h1>
                            <p style={{ fontSize: '24px' }}>Skor: {score}</p>
                            <p style={{ color: '#ffd600' }}>En Yüksek: {highScore}</p>
                        </>
                    ) : (
                        <>
                            <h1 style={{ color: '#ffd600', fontSize: '40px', margin: 0 }}>FLAPPY ETKA</h1>
                            <p>Başlamak için tıkla</p>
                        </>
                    )}
                    
                    <button 
                        onClick={resetGame}
                        style={{
                            marginTop: '20px', padding: '15px 40px', fontSize: '20px', fontWeight: 'bold',
                            backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '30px',
                            cursor: 'pointer', boxShadow: '0 4px 0 #2e7d32'
                        }}
                    >
                        {isGameOver ? 'TEKRAR OYNA' : 'BAŞLA'}
                    </button>
                </div>
            )}
        </div>
    </div>
  );
}