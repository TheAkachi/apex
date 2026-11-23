import { useId } from 'react';
import './Hourglass.css';

interface HourglassProps {
  /** Controla se a areia está escoando e a ampulheta girando */
  running: boolean;
  /** Largura em pixels (altura proporcional) */
  size?: number;
}

export function Hourglass({ running, size = 28 }: HourglassProps) {
  const uid = useId();
  const topClipId = `hg-top-${uid}`;
  const botClipId = `hg-bot-${uid}`;
  const height = Math.round((size / 36) * 48);

  return (
    <span className="hg-wrap" aria-hidden="true">
      <svg
        className={`hg-svg ${running ? 'is-running' : ''}`}
        width={size}
        height={height}
        viewBox="0 0 36 48"
        fill="none"
      >
        <defs>
          <clipPath id={topClipId}>
            <path d="M8.5 6.5 H27.5 C27.5 14.5 22 20 18 23.2 C14 20 8.5 14.5 8.5 6.5 Z" />
          </clipPath>
          <clipPath id={botClipId}>
            <path d="M18 24.8 C22 28 27.5 33.5 27.5 41.5 H8.5 C8.5 33.5 14 28 18 24.8 Z" />
          </clipPath>
        </defs>

        {/* Tampas minimalistas preto e branco */}
        <line
          x1="6"
          y1="5"
          x2="30"
          y2="5"
          stroke="rgba(249,249,249,0.72)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="43"
          x2="30"
          y2="43"
          stroke="rgba(249,249,249,0.72)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Silhueta de vidro limpa e contínua */}
        <path
          d="M8.5 6.5 H27.5 C27.5 14.5 22 20 18 23.2 C14 20 8.5 14.5 8.5 6.5 Z"
          stroke="rgba(249,249,249,0.5)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path
          d="M18 24.8 C22 28 27.5 33.5 27.5 41.5 H8.5 C8.5 33.5 14 28 18 24.8 Z"
          stroke="rgba(249,249,249,0.5)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />

        {/* Areia superior (branca pura, escoa suavemente) */}
        <g clipPath={`url(#${topClipId})`}>
          <rect
            className="hg-top-sand"
            x="7"
            y="8.5"
            width="22"
            height="15"
            fill="#f9f9f9"
          />
        </g>

        {/* Areia inferior (branca pura, sobe suavemente) */}
        <g clipPath={`url(#${botClipId})`}>
          <rect
            className="hg-bot-sand"
            x="7"
            y="26.5"
            width="22"
            height="15.5"
            fill="#f9f9f9"
          />
        </g>

        {/* Fio delicado de areia caindo no centro */}
        <line
          className="hg-stream"
          x1="18"
          y1="23.5"
          x2="18"
          y2="41"
          stroke="#f9f9f9"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
