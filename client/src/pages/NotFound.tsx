import { Button } from "@/components/ui/button";
import { Home, Leaf } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-volt/50 flex items-center justify-center mb-6">
        <Leaf className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-5xl font-display text-foreground mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-1">Page not found</p>
      <p className="text-sm text-muted-foreground mb-8">
        This page doesn't exist or has been moved.
      </p>
      <Button
        onClick={() => setLocation("/")}
        className="rounded-xl h-12 px-8 bg-primary hover:bg-primary/90 gap-2"
      >
        <Home className="w-4 h-4" />
        Back to Home
      </Button>
    </div>
  );
}
