// GutSync — Onboarding Flow
// Design: Organic Minimalism — warm, calming, step-by-step introduction

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Camera, Activity, Sparkles, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-hero-Pvw9osKZy8TFVwjYfuzJB7.webp";
const FOOD_SCAN_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-food-scan-Q6qZWp7uKQBXi3HwwykjjB.webp";
const INSIGHTS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-insights-am9czTKGxiACTgufFfNQec.webp";
const WELLNESS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-wellness-Y3yqX8dgxLnj59BBic4aog.webp";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    image: HERO_IMG,
    icon: Leaf,
    title: "Welcome to GutSync",
    subtitle: "Your personal food sensitivity tracker",
    description: "Discover which foods trigger your bloating, pain, and discomfort — without keeping a tedious food diary.",
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
    title: "Your Body Talks",
    subtitle: "Simple symptom tracking",
    description: "Log symptoms with a single tap. We connect the dots between what you eat and how you feel over time.",
  },
  {
    image: WELLNESS_IMG,
    icon: Sparkles,
    title: "Discover Your Patterns",
    subtitle: "Smart correlation engine",
    description: "After a few days of tracking, GutSync finds complex trigger patterns you'd miss on your own — like 'you only bloat when combining dairy with high-fructan vegetables.'",
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
    <div className="min-h-screen bg-background flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col"
        >
          {/* Image */}
          <div className="relative h-[45vh] overflow-hidden">
            <img
              src={step.image}
              alt={step.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>

          {/* Content */}
          <div className="flex-1 px-6 -mt-8 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <step.icon className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl tracking-tight mb-1">{step.title}</h1>
            <p className="text-sm font-medium text-primary mb-3">{step.subtitle}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom controls */}
      <div className="px-6 pb-8 pt-4">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
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
            <Button
              variant="outline"
              className="rounded-xl h-12 px-6"
              onClick={onComplete}
            >
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
  );
}
