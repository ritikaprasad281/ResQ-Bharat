import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import Navbar from "./components/Navbar";

// Route-level code splitting: only the landing page is in the main bundle; the
// other pages (and their heavy deps like the map/charts) load on demand, so the
// first paint ships far less JavaScript.
const HomePage = lazy(() => import("./pages/HomePage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const GrowthPage = lazy(() => import("./pages/GrowthPage"));
const AgriLossPage = lazy(() => import("./pages/AgriLossPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const AiHelpPage = lazy(() => import("./pages/AiHelpPage"));
const FloodSafetyPage = lazy(() => import("./pages/FloodSafetyPage"));

/** Keep old /growth links working — redirect to /floodplain, preserving query. */
function GrowthRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/floodplain${search}`} replace />;
}

function RouteFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-10 text-slate-400">
      <div className="animate-pulse text-sm">Loading…</div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col min-h-0">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/floodplain" element={<GrowthPage />} />
            <Route path="/agriculture" element={<AgriLossPage />} />
            <Route path="/growth" element={<GrowthRedirect />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/ai-help" element={<AiHelpPage />} />
            <Route path="/flood-safety" element={<FloodSafetyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
