import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import logoUrl from "./public/handshake-logo.svg";
import { initializeTheme } from "./theme.js";

initializeTheme();

const favicon =
  document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/svg+xml";
favicon.href = logoUrl;
document.head.appendChild(favicon);

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
