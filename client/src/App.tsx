import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import FoodLog from "./pages/FoodLog";
import Symptoms from "./pages/Symptoms";
import Insights from "./pages/Insights";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";
import BottomNav from "./components/BottomNav";
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/food"} component={FoodLog} />
      <Route path={"/symptoms"} component={Symptoms} />
      <Route path={"/insights"} component={Insights} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('gutsync_onboarded');
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
    setLoaded(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('gutsync_onboarded', 'true');
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
                background: 'oklch(0.99 0.003 80)',
                border: '1px solid oklch(0.9 0.01 80)',
                color: 'oklch(0.25 0.01 60)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              },
            }}
          />
          {showOnboarding ? (
            <Onboarding onComplete={handleOnboardingComplete} />
          ) : (
            <div className="min-h-screen bg-background pb-24">
              <Router />
              <BottomNav />
            </div>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
