import LinkedInSessionButton from "./LinkedInSessionButton";

export default function TopNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between bg-surface bg-white/80 px-margin-mobile py-sm border-b border-outline-variant backdrop-blur-md md:px-margin-desktop lg:static lg:ml-64 lg:bg-transparent lg:border-none">
      <h1 className="lg:hidden font-headline-md text-headline-md font-bold text-primary">
        Trackly
      </h1>
      <div className="hidden md:flex flex-1 items-center gap-md mx-lg max-w-[32rem]">
        <div className="flex-1 relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-secondary/60"
            placeholder="Search roles, companies..."
            type="text"
          />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
        <LinkedInSessionButton />
      </div>
    </header>
  );
}
