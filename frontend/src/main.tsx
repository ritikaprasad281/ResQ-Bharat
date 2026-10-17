import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./i18n/config";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { TtsProvider } from "./i18n/TtsProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <TtsProvider>
          <App />
        </TtsProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
