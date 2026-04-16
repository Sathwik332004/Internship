import { Plus } from 'lucide-react';

export default function BrandLogo({ compact = false, showTagline = true }) {

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#334155] shadow-[0_18px_34px_rgba(15,23,42,0.16)]">
          <Plus className="h-6 w-6 text-[#f5fffd]" strokeWidth={2.8} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-[0.04em] text-slate-900">Bhagya Medicals</p>
          {showTagline ? (
            <p className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">Trusted Pharmacy</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[#334155] shadow-[0_18px_38px_rgba(15,23,42,0.16)]">
        <Plus className="h-8 w-8 text-[#f5fffd]" strokeWidth={2.7} />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">Bhagya</p>
        <h1 className="text-2xl font-semibold tracking-[0.03em] text-slate-950">Medicals</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">Pharmacy & Wellness</p>
      </div>
    </div>
  );
}
