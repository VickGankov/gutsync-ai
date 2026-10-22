// Triggerplate — Onboarding Flow
// Design: Organic Minimalism — warm, calming, step-by-step introduction

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Camera, Activity, Sparkles, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

// Hero is the app icon; the other steps show real screenshots served from /landing (no third-party image hosts).
const HERO_IMG: string | null = null;
const FOOD_SCAN_IMG = "/landing/scan.webp";
const INSIGHTS_IMG = "/landing/today.webp";
const WELLNESS_IMG = "/landing/triggers.webp";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    image: HERO_IMG,
    icon: Leaf,
    title: "Welcome to Triggerplate",
    subtitle: "Your personal protocol tracker",
    description: "Log meals, doses, supplements, symptoms, weight and labs in one place, then see what lines up with how you feel.",
  },
  {
    image: FOOD_SCAN_IMG,
    icon: Camera,
    title: "Snap, Don't Type",
    subtitle: "Photo-based food logging",
    description: "Just take a photo of your meal. We help identify ingredients — including hidden ones like garlic powder in that restaurant sauce. You always confirm what you ate.",
  },
  {
    image: INSIGHTS_IMG,
    icon: Activity,
    title: "Track Everything In One Place",
    subtitle: "Symptoms, doses, body and labs",
    description: "Log symptoms with a single tap, plus doses, supplements, weight, strength and lab results. Everything sits on one timeline.",
  },
  {
    image: WELLNESS_IMG,
    icon: Sparkles,
    title: "Discover Your Patterns",
    subtitle: "Possible triggers, not guesses",
    description: "Once a food has shown up in at least 5 meals over 4 days, Triggerplate flags it as a possible trigger. A reintroduction test is what confirms it.",
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Desktop: the picture gets its own half of the screen */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-background p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center"
          >
            {step.image ? (
              <img
                src={step.image}
                alt={step.title}
                className="max-h-[78vh] w-auto max-w-[440px] rounded-3xl border border-border/40 bg-card shadow-2xl object-contain"
              />
            ) : (
              <img src="/icon-512.png" alt="Triggerplate" className="w-44 h-44 rounded-[2.5rem] shadow-xl" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex-1 flex flex-col lg:w-1/2 lg:items-center lg:justify-center">
        <div className="w-full max-w-md lg:max-w-lg flex-1 lg:flex-none flex flex-col mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="flex-1 lg:flex-none flex flex-col"
            >
              {/* Phone: picture on top */}
              <div className="lg:hidden relative h-[45vh] max-h-[400px] overflow-hidden bg-gradient-to-b from-primary/15 to-background">
                {step.image ? (
                  <img src={step.image} alt={step.title} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <img src="/icon-512.png" alt="Triggerplate" className="w-28 h-28 rounded-3xl shadow-lg" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
              </div>

              {/* Content */}
              <div className="flex-1 lg:flex-none px-6 lg:px-0 -mt-8 lg:mt-0 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl lg:text-4xl tracking-tight mb-1 lg:mb-2">{step.title}</h1>
                <p className="text-sm lg:text-base font-medium text-primary mb-3">{step.subtitle}</p>
                <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom controls */}
          <div className="px-6 lg:px-0 pb-8 lg:pb-0 pt-4 lg:pt-10">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {!isLast && (
                <Button variant="outline" className="rounded-xl h-12 px-6" onClick={onComplete}>
                  Skip
                </Button>
              )}
              <Button
                className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/90 gap-2"
                onClick={handleNext}
              >
                {isLast ? "Get Started" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
