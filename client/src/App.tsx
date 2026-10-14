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
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import Insights from "./pages/Insights";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Progress from "./pages/Progress";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ResetPassword from "./pages/ResetPassword";
import Symptoms from "./pages/Symptoms";

const AUTH_ROUTE = "/auth";
const PROTECTED_PATHS = new Set(["/", "/food", "/symptoms", "/insights", "/progress", "/profile"]);
const PUBLIC_INFO_PATHS = new Set(["/privacy"]);

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
  const isAuthPage = location === AUTH_ROUTE || location === "/forgot-password" || location === "/reset-password";
  const isPublicInfoPage = PUBLIC_INFO_PATHS.has(location);
  const showBottomNav = !isAuthPage && !isPublicInfoPage;

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
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/" component={Home} />
        <Route path="/food" component={FoodLog} />
        <Route path="/symptoms" component={Symptoms} />
        <Route path="/insights" component={Insights} />
        <Route path="/progress" component={Progress} />
        <Route path="/profile" component={Profile} />
        <Route path="/privacy" component={PrivacyPolicy} />
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
  const [location] = useLocation();
  const isAuthFlow = location === AUTH_ROUTE || location === "/forgot-password" || location === "/reset-password";
  const isPublicInfoFlow = PUBLIC_INFO_PATHS.has(location);

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
          {showOnboarding && !isAuthFlow && !isPublicInfoFlow ? (
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
