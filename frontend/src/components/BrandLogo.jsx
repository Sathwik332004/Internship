import { Plus } from 'lucide-react';

export default function BrandLogo({ compact = false, showTagline = true, dark = false }) {

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Medical cross icon */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
          }}
        >
          <Plus className="h-5 w-5 text-white" strokeWidth={3} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-wide" style={{ color: dark ? '#ffffff' : '#0f172a' }}>
            Bhagya Medicals
          </p>
          {showTagline && (
            <p className="truncate text-[10px] uppercase tracking-[0.18em]" style={{ color: dark ? 'rgba(148,163,184,0.8)' : '#64748b' }}>
              Pharmacy Management
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl shrink-0"
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          boxShadow: '0 8px 24px rgba(37,99,235,0.35)'
        }}
      >
        <Plus className="h-8 w-8 text-white" strokeWidth={3} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Bhagya</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Medicals</h1>
        <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-slate-500">Pharmacy & Wellness</p>
      </div>
    </div>
  );
}
