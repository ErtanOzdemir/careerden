export default function TopNav() {
  return (
    <header className="lg:ml-64 flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-sm bg-surface border-b border-outline-variant z-40 fixed top-0 bg-white/80 backdrop-blur-md lg:static lg:bg-transparent lg:border-none">
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
        <button className="hidden xl:flex items-center gap-1.5 px-4 py-2 bg-primary-container text-on-primary-container rounded-xl text-label-md font-bold hover:bg-primary transition-colors cursor-pointer whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">bolt</span>
          Quick Add
        </button>
      </div>
      <div className="flex items-center gap-4">
        <button className="material-symbols-outlined text-secondary hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer">
          notifications
        </button>
        <button className="material-symbols-outlined text-secondary hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer">
          settings
        </button>
        <button className="md:hidden material-symbols-outlined text-secondary p-2 cursor-pointer">
          menu
        </button>
      </div>
    </header>
  );
}
