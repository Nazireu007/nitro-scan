import { CircuitBoard, RotateCcw, ShieldCheck } from 'lucide-react';

type NitroTopBarProps = {
  onNewAnalysis: () => void;
};

export function NitroTopBar({ onNewAnalysis }: NitroTopBarProps) {
  return (
    <header className="nitro-topbar">
      <div className="nitro-brand-lockup">
        <span className="nitro-brand-mark" aria-hidden="true">
          <CircuitBoard />
        </span>
        <div>
          <strong>NITRO SCAN</strong>
          <span>Scanner comportamental offline</span>
        </div>
      </div>

      <div className="nitro-topbar-actions">
        <span className="nitro-online-state">
          <ShieldCheck aria-hidden="true" />
          Núcleo online
        </span>
        <button className="nitro-button nitro-button-quiet" type="button" onClick={onNewAnalysis}>
          <RotateCcw aria-hidden="true" />
          Nova análise
        </button>
      </div>
    </header>
  );
}

