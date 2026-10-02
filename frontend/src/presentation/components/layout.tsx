import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";

export function Layout() {
  return (
    <>
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </>
  );
}
