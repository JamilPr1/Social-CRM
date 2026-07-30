export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-[var(--card)] rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-[var(--card)] rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-[var(--card)] rounded-xl" />
    </div>
  );
}
