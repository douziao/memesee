import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/app.css";

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);

if (globalThis.__renderSmokeRoute) {
  window.__memeseeRoot = root;
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
