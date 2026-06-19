import { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import type { ConfirmationState } from '../types/measurements';

type WaveScopeProps = {
  state: ConfirmationState;
  signalLabel: string;
};

type ScopePalette = {
  primary: string;
  return: string;
};

type WaveConfig = {
  color: string;
  centerRatio: number;
  amplitudeRatio: number;
  frequency: number;
  phaseSpeed: number;
  phaseOffset: number;
  lineWidth: number;
  glow: number;
  alpha: number;
  dashed?: boolean;
};

const scopePalettes: Record<ConfirmationState, ScopePalette> = {
  detected: { primary: '#22dfff', return: '#ff2bd6' },
  correlated: { primary: '#22dfff', return: '#ff2bd6' },
  strong_indication: { primary: '#f5bd52', return: '#ff2bd6' },
  confirmed: { primary: '#74f7b0', return: '#22dfff' },
};

function drawLiveWave(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seconds: number,
  config: WaveConfig,
) {
  const centerY = height * config.centerRatio;
  const baseAmplitude = Math.max(10, height * config.amplitudeRatio);
  const phase = seconds * config.phaseSpeed + config.phaseOffset;
  const step = Math.max(2.5, Math.min(5, width / 220));

  context.beginPath();

  for (let x = -step; x <= width + step; x += step) {
    const envelope =
      0.94 +
      Math.sin(x * 0.010 - phase * 0.55) * 0.16 +
      Math.sin(x * 0.022 + phase * 0.22) * 0.08;
    const carrier = Math.sin(x * config.frequency + phase);
    const harmonic = Math.sin(x * config.frequency * 1.92 - phase * 1.38) * 0.28;
    const ripple = Math.sin(x * config.frequency * 3.55 + phase * 2.15) * 0.08;
    const peakShape = Math.sin(x * config.frequency * 0.52 + phase * 0.78);
    const sharperPeaks = Math.sign(peakShape) * Math.pow(Math.abs(peakShape), 5) * 0.16;
    const y = centerY + (carrier + harmonic + ripple + sharperPeaks) * baseAmplitude * envelope;

    if (x === -step) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.globalAlpha = config.alpha;
  context.lineWidth = config.lineWidth;
  context.strokeStyle = config.color;
  context.shadowColor = config.color;
  context.shadowBlur = config.glow;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.setLineDash(config.dashed ? [7, 7] : []);
  context.stroke();

  context.globalAlpha = Math.min(config.alpha + 0.12, 0.9);
  context.lineWidth = Math.max(1, config.lineWidth * 0.48);
  context.shadowBlur = 0;
  context.stroke();
}

export function WaveScope({ state, signalLabel }: WaveScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;

    if (!canvasElement) {
      return undefined;
    }

    const canvasContext = canvasElement.getContext('2d', { alpha: true });

    if (!canvasContext) {
      return undefined;
    }

    const canvas = canvasElement;
    const context = canvasContext;
    const palette = scopePalettes[state];
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let pixelRatio = 1;
    let isReducedMotion = motionQuery.matches;

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(bounds.width));
      const nextHeight = Math.max(1, Math.floor(bounds.height));
      const nextPixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      if (nextWidth === canvasWidth && nextHeight === canvasHeight && nextPixelRatio === pixelRatio) {
        return;
      }

      canvasWidth = nextWidth;
      canvasHeight = nextHeight;
      pixelRatio = nextPixelRatio;
      canvas.width = Math.floor(canvasWidth * pixelRatio);
      canvas.height = Math.floor(canvasHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function drawFrame(timestamp = 0) {
      resizeCanvas();
      const seconds = isReducedMotion ? 0 : timestamp * 0.001;

      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.globalCompositeOperation = 'source-over';

      drawLiveWave(context, canvasWidth, canvasHeight, seconds, {
        color: palette.return,
        centerRatio: 0.56,
        amplitudeRatio: 0.105,
        frequency: 0.030,
        phaseSpeed: 2.15,
        phaseOffset: 1.55,
        lineWidth: 1.45,
        glow: 9,
        alpha: 0.46,
        dashed: true,
      });

      drawLiveWave(context, canvasWidth, canvasHeight, seconds, {
        color: palette.primary,
        centerRatio: 0.49,
        amplitudeRatio: 0.215,
        frequency: 0.038,
        phaseSpeed: 2.75,
        phaseOffset: 0,
        lineWidth: 2.1,
        glow: 12,
        alpha: 0.76,
      });

      context.globalAlpha = 1;
      context.setLineDash([]);
    }

    function tick(timestamp: number) {
      drawFrame(timestamp);
      if (!isReducedMotion) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    }

    function startAnimation() {
      window.cancelAnimationFrame(animationFrame);
      drawFrame();

      if (!isReducedMotion) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    }

    function handleMotionChange(event: MediaQueryListEvent) {
      isReducedMotion = event.matches;
      startAnimation();
    }

    const resizeObserver = new ResizeObserver(() => startAnimation());
    resizeObserver.observe(canvas);
    motionQuery.addEventListener('change', handleMotionChange);
    startAnimation();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [state]);

  return (
    <section className={`wave-scope wave-scope-${state}`} aria-label="Telemetria de sinal e resposta">
      <header className="wave-scope-header">
        <div>
          <Activity aria-hidden="true" />
          <span>Telemetria offline</span>
        </div>
        <strong>{signalLabel}</strong>
      </header>

      <div className="wave-scope-grid" aria-hidden="true">
        <svg className="scope-frame" viewBox="0 0 720 220" preserveAspectRatio="none">
          <line className="scope-baseline" x1="0" y1="110" x2="720" y2="110" />
          <line className="scope-guide scope-guide-high" x1="0" y1="70" x2="720" y2="70" />
          <line className="scope-guide scope-guide-low" x1="0" y1="150" x2="720" y2="150" />
        </svg>

        <canvas ref={canvasRef} className="scope-wave-canvas" />

        <span className="scope-cursor" />
      </div>

      <footer className="wave-scope-footer">
        <span><i className="scope-key scope-key-primary" />Sinal injetado</span>
        <span><i className="scope-key scope-key-return" />Resposta capturada</span>
        <b>CH A / CH B</b>
      </footer>
    </section>
  );
}
