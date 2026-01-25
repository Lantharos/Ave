import { mount } from "svelte";
import "./app.css";

// Simple hash-based routing
const routes = {
  "/": () => import("./App.svelte"),
  "/callback": () => import("./pages/Callback.svelte"),
};

async function router() {
  const path = window.location.pathname;
  const loader = routes[path] || routes["/"];
  const module = await loader();
  
  // Clear existing content
  const target = document.getElementById("app");
  target.innerHTML = "";
  
  mount(module.default, { target });
}

// Handle initial route
router();

// Handle navigation (for SPA behavior if needed)
window.addEventListener("popstate", router);
