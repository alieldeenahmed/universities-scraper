import { useEffect } from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found";
  }, []);

  return (
    <div className="page">
      <div className="state-card">
        <div className="big" aria-hidden="true">
          404
        </div>
        <h2>Page not found</h2>
        <p>That address doesn't match a page here.</p>
        <div className="actions">
          <Link to="/" className="btn">
            Go to Majors
          </Link>
        </div>
      </div>
    </div>
  );
}
