'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// --- TİP TANIMLAMALARI ---

// Kuş (Etka) Objesi
interface Bird {
  x: number;
  y: number;
  velocity: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
}

// Boru Objesi
interface Pipe {
  x: number;
  y: number; // Üst borunun bitiş noktası
  passed: boolean; // Skor alındı mı?
}

// Partikül (Efektler için)
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // Ömür (0-1 arası)
  color: string;
  size: number;
}

// Bulut (Arkaplan)
interface Cloud {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export default function FlappyEtkaUltimate() {
  // --- STATE YÖNETİMİ (UI) ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [flash, setFlash] = useState(false); // Skor alınca ekran parlaması

  // --- REF YÖNETİMİ (OYUN MOTORU) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // HATA DÜZELTME: Başlangıç değeri null verildi
  const requestRef = useRef<number | null>(null);
  
  // Oyun Verileri
  const bird = useRef<Bird>({ 
    x: 50, y: 150, velocity: 0, width: 34, height: 28, rotation: 0, color: '#f1c40f' 
  });
  const pipes = useRef<Pipe[]>([]);
  const particles = useRef<Particle[]>([]);
  const clouds = useRef<Cloud[]>([]);
  
  // Sayaçlar ve Zorluk
  const frames = useRef(0);
  const scoreRef = useRef(0);
  const difficultyMultiplier = useRef(1); // Oyun hızlandıkça artar

  // --- SABİTLER ---
  const GRAVITY = 0.25;
  const JUMP_STRENGTH = 4.6;
  const PIPE_WIDTH = 52;
  const PIPE_GAP = 140; // Boru aralığı
  const BASE_SPEED = 2.2;
  const SCREEN_WIDTH = 360; // Canvas genişliği
  const SCREEN_HEIGHT = 600; // Canvas yüksekliği

  // --- SES MOTORU (Web Audio API) ---
  // Dosya yüklemeye gerek kalmadan ses üretir
  const playSound = useCallback((type: 'jump' | 'score' | 'hit') => {
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'score') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.error("Ses hatası:", e);
    }
  }, []);

  // --- BAŞLANGIÇ AYARLARI ---
  useEffect(() => {
    // LocalStorage'dan en yüksek skoru çek
    const savedScore = localStorage.getItem('flappyEtkaHighScore');
    if (savedScore) {
      setHighScore(parseInt(savedScore));
    }

    // Başlangıç bulutlarını oluştur
    for(let i=0; i<5; i++) {
        clouds.current.push(createCloud(true));
    }
  }, []);

  // --- YARDIMCI FONKSİYONLAR ---

  // Rastgele Bulut Üretici
  const createCloud = (randomX: boolean = false): Cloud => {
    return {
        x: randomX ? Math.random() * SCREEN_WIDTH : SCREEN_WIDTH + 50,
        y: Math.random() * (SCREEN_HEIGHT / 2),
        speed: 0.5 + Math.random() * 0.5,
        size: 20 + Math.random() * 30
    };
  };

  // Patlama Efekti (Partikül Üretici)
  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      particles.current.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  };

  // Zıplama Efekti (Toz)
  const createJumpDust = (x: number, y: number) => {
    for (let i = 0; i < 5; i++) {
        particles.current.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 2, // Aşağı doğru
            life: 0.8,
            color: 'rgba(255, 255, 255, 0.6)',
            size: Math.random() * 3
        });
    }
  };

  // Oyunu Sıfırla
  const resetGame = () => {
    bird.current = { x: 60, y: SCREEN_HEIGHT / 2, velocity: 0, width: 34, height: 28, rotation: 0, color: '#f1c40f' };
    pipes.current = [];
    particles.current = [];
    scoreRef.current = 0;
    frames.current = 0;
    difficultyMultiplier.current = 1;
    setScore(0);
    setGameState('PLAYING');
    
    // Döngüyü başlat
    if (!requestRef.current) {
        loop(); 
    }
  };

  // Zıplama Aksiyonu
  const jump = useCallback(() => {
    if (gameState === 'GAMEOVER') return;
    if (gameState === 'START') {
        resetGame();
        return;
    }

    bird.current.velocity = -JUMP_STRENGTH;
    bird.current.rotation = -25 * Math.PI / 180;
    createJumpDust(bird.current.x, bird.current.y + bird.current.height);
    playSound('jump');
  }, [gameState, playSound]);

  // --- OYUN DÖNGÜSÜ (LOOP) ---
  const loop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Eğer oyun bitmediyse güncelle
    if (gameState === 'PLAYING') {
      updatePhysics();
    }
    
    // Her zaman çiz (Game Over olsa bile son kareyi görelim)
    draw(ctx);

    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(loop);
    } else {
        requestRef.current = null; // Döngüyü durdur
    }
  };

  // --- FİZİK MOTORU ---
  const updatePhysics = () => {
    frames.current++;
    
    // Zorluk Artışı: Her 5 puanda bir hız %5 artar
    const speed = BASE_SPEED * (1 + Math.floor(scoreRef.current / 5) * 0.05);

    // 1. KUŞ FİZİĞİ
    bird.current.velocity += GRAVITY;
    bird.current.y += bird.current.velocity;

    // Dönüş (Rotation) hesaplama
    if (bird.current.velocity > 0) { // Düşerken
        bird.current.rotation += 3 * Math.PI / 180;
        if (bird.current.rotation > 90 * Math.PI / 180) bird.current.rotation = 90 * Math.PI / 180;
    }

    // Zemin ve Tavan Kontrolü
    if (bird.current.y + bird.current.height >= SCREEN_HEIGHT - 20 || bird.current.y < 0) {
        handleGameOver();
    }

    // 2. BORU YÖNETİMİ
    // Boru ekleme sıklığı da hıza göre ayarlanır
    const pipeInterval = Math.floor(120 / (1 + Math.floor(scoreRef.current / 10) * 0.1));
    
    if (frames.current % pipeInterval === 0) {
        const minPipeY = 50;
        const maxPipeY = SCREEN_HEIGHT - PIPE_GAP - 100;
        const pipeY = Math.floor(Math.random() * (maxPipeY - minPipeY + 1)) + minPipeY;
        
        pipes.current.push({
            x: SCREEN_WIDTH,
            y: pipeY,
            passed: false
        });
    }

    for (let i = 0; i < pipes.current.length; i++) {
        let p = pipes.current[i];
        p.x -= speed;

        // Çarpışma Kontrolü (Hitbox biraz daha affedici yapıldı)
        const birdHitbox = {
            x: bird.current.x + 4,
            y: bird.current.y + 4,
            w: bird.current.width - 8,
            h: bird.current.height - 8
        };

        // X ekseninde çakışma
        if (birdHitbox.x + birdHitbox.w > p.x && birdHitbox.x < p.x + PIPE_WIDTH) {
            // Y ekseninde çakışma (Üst boru veya Alt boru)
            if (birdHitbox.y < p.y || birdHitbox.y + birdHitbox.h > p.y + PIPE_GAP) {
                handleGameOver();
            }
        }

        // Skor Alma
        if (p.x + PIPE_WIDTH < bird.current.x && !p.passed) {
            scoreRef.current += 1;
            setScore(scoreRef.current);
            setFlash(true); // Flash efekti
            setTimeout(() => setFlash(false), 100);
            playSound('score');
            p.passed = true;
        }

        // Ekran dışına çıkanları sil
        if (p.x + PIPE_WIDTH <= 0) {
            pipes.current.shift();
            i--;
        }
    }

    // 3. BULUT FİZİĞİ (Parallax)
    clouds.current.forEach(c => {
        c.x -= c.speed;
    });
    // Ekrandan çıkan bulutları başa al
    clouds.current = clouds.current.filter(c => c.x + c.size > -50);
    if(frames.current % 100 === 0) {
        clouds.current.push(createCloud());
    }

    // 4. PARTİKÜL FİZİĞİ
    for (let i = 0; i < particles.current.length; i++) {
        let pt = particles.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.1; // Partiküller de düşer
        pt.life -= 0.02;

        if (pt.life <= 0) {
            particles.current.splice(i, 1);
            i--;
        }
    }
  };

  // --- OYUN BİTİŞİ ---
  const handleGameOver = () => {
    if (gameState === 'GAMEOVER') return; // Zaten bittiyse tekrar tetikleme
    
    setGameState('GAMEOVER');
    playSound('hit');
    createExplosion(bird.current.x, bird.current.y, '#e74c3c');
    
    // Yüksek Skor Kaydı
    if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current);
        localStorage.setItem('flappyEtkaHighScore', scoreRef.current.toString());
    }
  };

  // --- ÇİZİM MOTORU (RENDER) ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    // 1. Arkaplan (Günün saatine göre değişebilir - şimdilik sabit mavi)
    // Skor arttıkça gökyüzü kararabilir
    const skyColor = scoreRef.current > 10 ? '#2c3e50' : '#70c5ce';
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 2. Bulutlar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    clouds.current.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.arc(c.x + c.size * 0.5, c.y - c.size * 0.2, c.size * 0.8, 0, Math.PI * 2);
        ctx.arc(c.x - c.size * 0.5, c.y - c.size * 0.2, c.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3. Borular
    pipes.current.forEach(p => {
        // Boru Gövdesi
        const gradient = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        gradient.addColorStop(0, '#2ecc71');
        gradient.addColorStop(0.5, '#5cdb95'); // Parlama
        gradient.addColorStop(1, '#27ae60');

        ctx.fillStyle = gradient;
        
        // Üst Boru
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.y);
        // Boru Kafası (Üst)
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(p.x - 2, p.y - 20, PIPE_WIDTH + 4, 20);

        // Alt Boru
        ctx.fillStyle = gradient;
        ctx.fillRect(p.x, p.y + PIPE_GAP, PIPE_WIDTH, SCREEN_HEIGHT - (p.y + PIPE_GAP));
        // Boru Kafası (Alt)
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(p.x - 2, p.y + PIPE_GAP, PIPE_WIDTH + 4, 20);
    });

    // 4. Zemin Şeridi
    ctx.fillStyle = '#d35400';
    ctx.fillRect(0, SCREEN_HEIGHT - 20, SCREEN_WIDTH, 20);
    // Zemin Çimenleri
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(0, SCREEN_HEIGHT - 25, SCREEN_WIDTH, 5);

    // 5. Partiküller
    particles.current.forEach(pt => {
        ctx.save();
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.restore();
    });

    // 6. ETKA (Kuş)
    if (gameState !== 'GAMEOVER' || particles.current.length > 0) {
        ctx.save();
        ctx.translate(bird.current.x + bird.current.width / 2, bird.current.y + bird.current.height / 2);
        ctx.rotate(bird.current.rotation);
        
        // Gövde (Yuvarlak Kare)
        ctx.fillStyle = bird.current.color;
        // Basit bir gölge efekti
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        ctx.fillRect(-bird.current.width / 2, -bird.current.height / 2, bird.current.width, bird.current.height);
        ctx.shadowBlur = 0; // Gölgeyi kapat

        // Göz (Beyaz + Siyah Bebek)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(8, -8, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000'; // Göz Bebeği
        ctx.beginPath();
        ctx.arc(10, -8, 3, 0, Math.PI * 2);
        ctx.fill();

        // Gaga
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(22, 5);
        ctx.lineTo(10, 10);
        ctx.fill();

        // Kanat (Basit bir elips, animasyonlu)
        ctx.fillStyle = '#f39c12';
        const wingY = Math.sin(frames.current * 0.5) * 5;
        ctx.beginPath();
        ctx.ellipse(-5, 5 + wingY, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
    
    // 7. Flash Efekti
    if (flash) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
  };

  // --- EVENT LISTENER (Klavye & Touch) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault(); // Scroll engelle
            jump();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#1a1a1a',
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        touchAction: 'none' // Mobilde zoom/scroll engelleme
    }}>
      <h1 style={{ 
          color: '#f1c40f', 
          marginBottom: '10px', 
          textTransform: 'uppercase', 
          letterSpacing: '3px',
          textShadow: '0 4px 0 #d35400' 
      }}>
          Flappy Etka <span style={{fontSize:'0.6em', color:'#fff'}}>Ultimate</span>
      </h1>
      
      <div style={{ 
          position: 'relative', 
          width: SCREEN_WIDTH + 'px', 
          height: SCREEN_HEIGHT + 'px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          borderRadius: '12px',
          overflow: 'hidden'
      }}>
        
        {/* SKOR TABLOSU */}
        <div style={{
            position: 'absolute',
            top: '20px',
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
            pointerEvents: 'none'
        }}>
            <div style={{
                fontSize: '56px',
                fontWeight: '900',
                color: 'white',
                textShadow: '3px 3px 0 #000, -1px -1px 0 #000'
            }}>{score}</div>
            
            <div style={{
                fontSize: '16px',
                color: '#f1c40f',
                background: 'rgba(0,0,0,0.5)',
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '20px',
                marginTop: '5px'
            }}>En Yüksek: {highScore}</div>
        </div>

        {/* OYUN ALANI */}
        <canvas
            ref={canvasRef}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            onClick={jump}
            style={{ 
                display: 'block', 
                cursor: 'pointer',
                imageRendering: 'pixelated' // Daha keskin çizimler
            }}
        />

        {/* BAŞLANGIÇ EKRANI */}
        {gameState === 'START' && (
             <div style={overlayStyle}>
                <div style={cardStyle}>
                    <h2 style={{color: '#2ecc71', margin:0}}>Hazır mısın?</h2>
                    <p style={{color: '#666', margin:'10px 0'}}>Başlamak için tıkla veya<br/>BOŞLUK tuşuna bas</p>
                    <div style={{fontSize: '40px'}}>👆</div>
                </div>
            </div>
        )}

        {/* GAME OVER EKRANI */}
        {gameState === 'GAMEOVER' && (
            <div style={overlayStyle}>
                <div style={cardStyle}>
                    <h2 style={{color: '#e74c3c', fontSize: '32px', margin:0}}>YANDIN!</h2>
                    
                    <div style={{margin: '20px 0'}}>
                        <div style={{fontSize: '14px', color:'#999'}}>SKORUN</div>
                        <div style={{fontSize: '48px', fontWeight:'bold', color:'#333'}}>{score}</div>
                    </div>

                    {score >= highScore && score > 0 && (
                        <div style={{
                            color: '#f39c12', 
                            fontWeight:'bold', 
                            marginBottom:'15px',
                            animation: 'pulse 1s infinite'
                        }}>✨ YENİ REKOR! ✨</div>
                    )}

                    <button 
                        onClick={resetGame}
                        style={{
                            background: '#2ecc71',
                            color: 'white',
                            border: 'none',
                            padding: '12px 30px',
                            fontSize: '18px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 0 #27ae60',
                            transition: 'all 0.1s'
                        }}
                    >
                        TEKRAR OYNA
                    </button>
                </div>
            </div>
        )}
      </div>

      <div style={{marginTop: '20px', color: '#666', fontSize: '12px'}}>
          v2.0 Ultimate Edition • Next.js + Canvas
      </div>
    </div>
  );
}

// --- CSS STYLES (Inline objects for simplicity) ---
const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    backdropFilter: 'blur(2px)'
};

const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    width: '80%',
    maxWidth: '300px',
    animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
};