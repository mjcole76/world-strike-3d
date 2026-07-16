import type { Team } from './gameCore';

export interface RadarDot { x: number; z: number; team: Team; controlled: boolean }

export interface Radar {
  draw(dots: RadarDot[], ball: { x: number; z: number }, homeCss: string, awayCss: string): void;
}

const HALF_W = 32;
const HALF_L = 52;

export function createRadar(canvas: HTMLCanvasElement): Radar {
  const ctx = canvas.getContext('2d');
  const margin = 6;

  const toX = (x: number): number => margin + ((x + HALF_W) / (HALF_W * 2)) * (canvas.width - margin * 2);
  const toY = (z: number): number => margin + ((z + HALF_L) / (HALF_L * 2)) * (canvas.height - margin * 2);

  return {
    draw(dots, ball, homeCss, awayCss): void {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
      ctx.beginPath();
      ctx.moveTo(margin, canvas.height / 2);
      ctx.lineTo(canvas.width - margin, canvas.height / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 9, 0, Math.PI * 2);
      ctx.stroke();

      for (const dot of dots) {
        ctx.fillStyle = dot.team === 'home' ? homeCss : awayCss;
        ctx.beginPath();
        ctx.arc(toX(dot.x), toY(dot.z), dot.controlled ? 3.4 : 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (dot.controlled) {
          ctx.strokeStyle = '#f5ca52';
          ctx.beginPath();
          ctx.arc(toX(dot.x), toY(dot.z), 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(toX(ball.x), toY(ball.z), 2, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}
