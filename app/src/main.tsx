import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "nprogress/nprogress.css";

createRoot(document.getElementById("root")!).render(<App />);
