import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout";
import { EmptyState } from "./components/notice";
import { CrawlsPage } from "./pages/crawls-page";
import { MajorsPage } from "./pages/majors-page";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MajorsPage />} />
        <Route path="crawls" element={<CrawlsPage />} />
        <Route
          path="*"
          element={
            <div className="page">
              <EmptyState title="Page not found" />
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
