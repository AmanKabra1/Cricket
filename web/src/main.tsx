import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { store } from "@/store";
import { ThemeProvider } from "@/theme/ThemeContext";
import { initSentry } from "@/sentry";
import App from "./App";
import "./index.css";

initSentry(); // no-op unless VITE_SENTRY_DSN is set

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Free-tier backend can cold-start (~30–60s); retry with backoff so the
      // first load rides out the wake instead of showing an error.
      retry: 4,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      // Refresh when the tab/app regains focus or network reconnects — handy on
      // mobile where you switch apps and come back.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
);
