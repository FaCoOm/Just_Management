import React from "react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RouterProvider } from "@tanstack/react-router"

import "./index.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { createAppQueryClient } from "@/lib/query-client"
import { router } from "./router"

const queryClient = createAppQueryClient()

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red'}}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error?.toString()}</pre>
        <pre>{this.state.error?.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
          <Toaster />
          {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          )}
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
