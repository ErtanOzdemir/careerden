import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar />
      <TopNav />
      <main className="lg:ml-64 min-h-screen pt-20 lg:pt-0 px-margin-mobile md:px-margin-desktop pb-xl">
        <Outlet />
      </main>
      <button className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-container text-on-primary rounded-full shadow-2xl flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-transform cursor-pointer">
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}
