import { Link, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { healthLabel } from "../../domain/university";
import { HEALTH_STYLE, toneColor } from "../theme/status-style";
import { useUniversities } from "../universities-context";
import { IconList, IconRefresh } from "./icons";
import { Marker } from "./marker";

export function Sidebar() {
  const { universities } = useUniversities();
  const location = useLocation();
  const [params] = useSearchParams();

  // on the majors page one university is selected, the first one when the url doesn't say
  const onMajors = location.pathname === "/";
  const selectedId = Number(params.get("u")) || universities?.[0]?.id;

  return (
    <aside className="sidebar">
      <div className="brand">University Majors</div>

      <nav className="side-nav" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => `side-link${isActive ? " active" : ""}`}>
          <IconList />
          Majors
        </NavLink>
        <NavLink to="/crawls" className={({ isActive }) => `side-link${isActive ? " active" : ""}`}>
          <IconRefresh />
          Crawls
        </NavLink>
      </nav>

      {universities && universities.length > 0 && (
        <nav className="side-universities" aria-label="Universities">
          <div className="side-heading">Universities</div>
          {universities.map((university) => {
            const style = HEALTH_STYLE[university.health.status];
            const active = onMajors && university.id === selectedId;
            return (
              <Link
                key={university.id}
                to={`/?u=${university.id}`}
                className={`side-link side-university${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={`${university.name}: ${healthLabel(university.health.status)}`}
              >
                <Marker shape={style.shape} color={toneColor(style.tone)} />
                <span className="name">{university.name}</span>
                <span className="count">{university.activeMajors}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
