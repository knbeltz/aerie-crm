export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-midnight rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-surface text-sm font-manrope font-bold">A</span>
            </div>
            <span className="font-manrope font-extrabold text-xl text-midnight tracking-tight">
              Aerie
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
