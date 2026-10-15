
export default function Brand({ compact = false, light = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9A45B] text-xl font-black text-[#111C2E] shadow-sm">
        M
      </div>

      {!compact && (
        <div className="flex flex-col">
          <span
            className={`text-lg font-bold tracking-tight ${
              light ? "text-white" : "text-[#111C2E]"
            }`}
          >
            MAAX <span className="font-medium">Business</span>
          </span>

          <span
            className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${
              light ? "text-slate-300" : "text-slate-500"
            }`}
          >
            Gestion professionnelle
          </span>
        </div>
      )}
    </div>
  );
}
