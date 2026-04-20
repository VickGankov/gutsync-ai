import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect, useMemo, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import BottomNav from "./components/BottomNav";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EmailAuth from "./pages/EmailAuth";
import FoodLog from "./pages/FoodLog";
import Home from "./pages/Home";
import Insights from "./pages/Insights";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Symptoms from "./pages/Symptoms";

const AUTH_ROUTE = "/auth";
const PROTECTED_PATHS = new Set(["/", "/food", "/symptoms", "/insights", "/profile"]);

function buildAuthPath(pathname: string) {
  return pathname && pathname !== "/"
    ? `${AUTH_ROUTE}?next=${encodeURIComponent(pathname)}`
    : AUTH_ROUTE;
}

function Router() {
  const { isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const isProtectedPath = useMemo(() => PROTECTED_PATHS.has(location), [location]);
  const authSearchParams =
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const isAuthActionRoute =
    authSearchParams.get("mode") === "reset" || authSearchParams.has("verify");
  const showBottomNav = location !== AUTH_ROUTE;

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated && isProtectedPath) {
      setLocation(buildAuthPath(location));
      return;
    }

    if (
      !isAuthenticated ||
      location !== AUTH_ROUTE ||
      isAuthActionRoute ||
      typeof window === "undefined"
    ) {
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    setLocation(next || "/");
  }, [isAuthenticated, isAuthActionRoute, isProtectedPath, loading, location, setLocation]);

  if (loading && isProtectedPath) {
    return null;
  }

  if (!isAuthenticated && isProtectedPath) {
    return null;
  }

  if (isAuthenticated && location === AUTH_ROUTE && !isAuthActionRoute) {
    return null;
  }

  return (
    <>
      <Switch>
        <Route path={AUTH_ROUTE} component={EmailAuth} />
        <Route path="/" component={Home} />
        <Route path="/food" component={FoodLog} />
        <Route path="/symptoms" component={Symptoms} />
        <Route path="/insights" component={Insights} />
        <Route path="/profile" component={Profile} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      {showBottomNav ? <BottomNav /> : null}
    </>
  );
}

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem("gutsync_onboarded");
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
    setLoaded(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("gutsync_onboarded", "true");
    setShowOnboarding(false);
  };

  if (!loaded) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "oklch(0.99 0.003 80)",
                border: "1px solid oklch(0.9 0.01 80)",
                color: "oklch(0.25 0.01 60)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              },
            }}
          />
          {showOnboarding ? (
            <Onboarding onComplete={handleOnboardingComplete} />
          ) : (
            <div className="min-h-screen bg-background pb-24">
              <Router />
            </div>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
