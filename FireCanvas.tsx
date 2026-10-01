import React, { useEffect, useRef } from 'react';

interface FireCanvasProps {
  fireIntensity?: 'normal' | 'intense';
  interactive?: boolean;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  pulseSpeed: number;
}

export const FireCanvas: React.FC<FireCanvasProps> = ({
  fireIntensity = 'normal',
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('resize', handleResize);

    // Stars
    let stars: Star[] = [];
    const initStars = () => {
      stars = [];
      const starCount = Math.floor((width * height) / 10000);
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.8 + 0.5,
          alpha: Math.random() * 0.7 + 0.2,
          pulseSpeed: (Math.random() * 0.03 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
        });
      }
    };
    initStars();

    // Embers
    const embers: Ember[] = [];
    const isIntense = fireIntensity === 'intense';
    const maxEmbers = isIntense ? 120 : 60;

    const colors = [
      '#f97316', // orange
      '#f59e0b', // amber
      '#ef4444', // red
      '#fbbf24', // yellow
      '#06b6d4', // cyan sparks
    ];

    const createEmber = (originX?: number, originY?: number, burst = false): Ember => {
      const x = originX !== undefined ? originX : Math.random() * width;
      const y = originY !== undefined ? originY : height + 10;
      const vx = burst ? (Math.random() - 0.5) * 6 : (Math.random() - 0.5) * 1.8;
      const vy = burst ? (Math.random() - 0.8) * 6 : -(Math.random() * 2.2 + 1.2);
      const size = Math.random() * 3.5 + 1.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const maxLife = burst ? Math.floor(Math.random() * 50 + 30) : Math.floor(Math.random() * 100 + 70);

      return {
        x,
        y,
        vx,
        vy,
        size,
        color,
        alpha: 0.9,
        maxLife,
        life: 0,
      };
    };

    // Pre-populate some embers
    for (let i = 0; i < maxEmbers; i++) {
      const e = createEmber();
      e.y = Math.random() * height;
      e.life = Math.floor(Math.random() * e.maxLife);
      embers.push(e);
    }

    // Pointer burst
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!interactive) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (embers.length < maxEmbers + 40 && Math.random() > 0.4) {
        embers.push(createEmber(clientX, clientY, true));
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // Click explosion
    const handleClick = (e: MouseEvent) => {
      if (!interactive) return;
      for (let i = 0; i < (isIntense ? 25 : 12); i++) {
        embers.push(createEmber(e.clientX, e.clientY, true));
      }
    };
    window.addEventListener('click', handleClick);

    // Main render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render Stars
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        s.alpha += s.pulseSpeed;
        if (s.alpha > 0.85 || s.alpha < 0.15) {
          s.pulseSpeed = -s.pulseSpeed;
        }
        ctx.globalAlpha = Math.max(0.1, Math.min(1, s.alpha));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Embers
      ctx.globalCompositeOperation = 'lighter';
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life++;
        e.x += e.vx;
        e.y += e.vy;

        // Turbulence
        e.vx += (Math.random() - 0.5) * 0.1;

        const progress = e.life / e.maxLife;
        const currentAlpha = (1 - progress) * e.alpha;

        if (progress >= 1 || e.y < -20 || e.x < -20 || e.x > width + 20) {
          embers.splice(i, 1);
          if (embers.length < maxEmbers) {
            embers.push(createEmber());
          }
          continue;
        }

        ctx.globalAlpha = Math.max(0, currentAlpha);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = isIntense ? 16 : 8;

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (1 - progress * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('click', handleClick);
    };
  }, [fireIntensity, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 opacity-70"
    />
  );
};
