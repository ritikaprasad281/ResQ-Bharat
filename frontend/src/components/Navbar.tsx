import { NavLink, Link } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

const links = [
  { to: "/", key: "home", end: true },
  { to: "/explore", key: "floodIntelligence" },
  { to: "/floodplain", key: "floodplainDevelopment" },
  { to: "/agriculture", key: "agriLoss" },
  { to: "/report", key: "report" },
  { to: "/ai-help", key: "aiHelp" },
  { to: "/flood-safety", key: "floodSafety" },
  { to: "/about", key: "about" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <header className="glass sticky top-0 z-30 border-b border-white/5">
      <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 via-sky-500 to-blue-700">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight">
              ResQ&nbsp;Bharat
            </div>
            <div className="text-[10px] text-slate-400 -mt-0.5">
              {t("app.tagline")}
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-6">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-lg text-[13px] transition ${
                  isActive
                    ? "bg-ink-600 text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-ink-800/60"
                }`
              }
            >
              {t(`nav.${l.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden xl:flex text-[11px] text-slate-400 items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {t("nav.liveMonitoring")}
          </span>
          <LanguageSwitcher />
          <Link
            to="/report"
            className="hidden sm:inline-flex rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white transition"
          >
            {t("nav.reportHazard")}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden grid place-items-center h-9 w-9 rounded-lg bg-ink-800/60"
            aria-label={t("nav.menu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden px-4 pb-3 flex flex-col gap-1 border-t border-white/5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-ink-600 text-white font-medium"
                    : "text-slate-300 hover:bg-ink-800/60"
                }`
              }
            >
              {t(`nav.${l.key}`)}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
