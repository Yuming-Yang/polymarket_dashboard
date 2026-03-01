import { Nav } from "@/components/Nav";
import { Providers } from "./providers";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </Providers>
  );
}
