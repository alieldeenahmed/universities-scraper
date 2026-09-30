import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <span className="brand">University Majors</span>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>
              Majors
            </NavLink>
            <NavLink to="/crawls">Crawls</NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
