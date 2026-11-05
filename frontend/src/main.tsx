import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./index.css";
import { init_theme } from "./theme";

init_theme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
