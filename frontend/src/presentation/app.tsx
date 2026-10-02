import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout";
import { CrawlsPage } from "./pages/crawls-page";
import { MajorsPage } from "./pages/majors-page";
import { NotFoundPage } from "./pages/not-found-page";
import { UniversitiesProvider } from "./universities-context";

export function App() {
  return (
    <UniversitiesProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MajorsPage />} />
          <Route path="crawls" element={<CrawlsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </UniversitiesProvider>
  );
}
