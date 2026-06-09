interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "gray";
}

const accentMap = {
  blue: "border-l-brand-blue",
  green: "border-l-brand-green",
  gray: "border-l-gray-300",
};

export default function KPICard({ label, value, sub, accent = "blue" }: KPICardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-100 border-l-4 ${accentMap[accent]} bg-white p-4 shadow-card`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
