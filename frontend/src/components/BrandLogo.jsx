import { HeartPulse, Plus } from 'lucide-react';

export default function BrandLogo({ compact = false, showTagline = true }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-green-600 to-lime-500 shadow-[0_14px_34px_rgba(22,101,52,0.35)]">
          <Plus className="absolute h-7 w-7 text-white/90" strokeWidth={2.8} />
          <HeartPulse className="relative h-4 w-4 text-amber-50" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-[0.18em] text-slate-900">BHAGYA MEDICALS</p>
          {showTagline ? (
            <p className="truncate text-[11px] uppercase tracking-[0.3em] text-emerald-800/80">Care. Clarity. Trust.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-emerald-700 via-green-600 to-lime-500 shadow-[0_20px_50px_rgba(22,101,52,0.35)]">
        <Plus className="absolute h-10 w-10 text-white/90" strokeWidth={2.7} />
        <HeartPulse className="relative h-6 w-6 text-amber-50" strokeWidth={2.6} />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-emerald-800">Bhagya</p>
        <h1 className="text-2xl font-semibold tracking-[0.14em] text-slate-950">MEDICALS</h1>
      
      </div>
    </div>
  );
}
