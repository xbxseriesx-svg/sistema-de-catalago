import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const element = document.getElementById("root");
if (!element) throw new Error("Elemento #root ausente");

const router = getRouter();
createRoot(element).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
