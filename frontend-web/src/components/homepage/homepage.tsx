"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  BookOpen, Brain, Users, Map, Award, CalendarCheck, ArrowRight, Briefcase,
  Sparkles, GraduationCap, BarChart3, CheckCircle2, Zap, Globe,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import LandingNavbar from "./landing-navbar";
import AuroraBg from "./aurora-bg";
import SpotlightCard from "./spotlight-card";
import { homepageApi, HomepageContentOut, HomepageStats } from "@/lib/api";

import BlurText from "@/components/ui/blur-text";
import GradientText from "@/components/ui/gradient-text";
import ShinyText from "@/components/ui/shiny-text";
import CountUp from "@/components/ui/count-up";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";

function FadeInSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const features = [
  {
    icon: Map,
    title: "Interactive Mind Maps",
    description: "Create beautiful, collaborative mind maps with our drag-and-drop editor powered by React Flow.",
    color: "from-[#1B2A80] to-[#2E4DA7]",
    spotlight: "rgba(27, 42, 128, 0.25)",
  },
  {
    icon: Users,
    title: "Real-Time Collaboration",
    description: "Work together with classmates in real-time. Share maps, discuss ideas, and learn as a team.",
    color: "from-[#2E4DA7] to-[#5B9BD5]",
    spotlight: "rgba(46, 77, 167, 0.25)",
  },
  {
    icon: Brain,
    title: "AI Study Companion",
    description: "SmartBuddy learns your study style and recommends personalized strategies to boost your learning.",
    color: "from-[#5B9BD5] to-[#7BB3E0]",
    spotlight: "rgba(91, 155, 213, 0.25)",
  },
  {
    icon: GraduationCap,
    title: "Course Management",
    description: "Lecturers can create courses, share resources, manage assignments, and track student progress.",
    color: "from-[#1B2A80] to-[#5B9BD5]",
    spotlight: "rgba(27, 42, 128, 0.2)",
  },
  {
    icon: Award,
    title: "Achievements & Badges",
    description: "Earn badges and track your streaks. Gamification keeps you motivated on your learning journey.",
    color: "from-amber-500 to-orange-600",
    spotlight: "rgba(245, 158, 11, 0.2)",
  },
  {
    icon: CalendarCheck,
    title: "Smart Planner",
    description: "Stay organized with built-in task planner, reminders, and deadline tracking for all your courses.",
    color: "from-emerald-500 to-green-600",
    spotlight: "rgba(16, 185, 129, 0.2)",
  },
];

const steps = [
  { step: "01", title: "Sign Up & Join", description: "Create your account and join courses using a simple code from your lecturer.", icon: Zap },
  { step: "02", title: "Create Mind Maps", description: "Build visual mind maps with our intuitive editor. Choose from templates or start from scratch.", icon: Map },
  { step: "03", title: "Collaborate & Learn", description: "Share your maps, collaborate in real-time, and submit assignments directly through the platform.", icon: Globe },
];

/* ── Sliding Poster Carousel ── */
function PosterCarousel({ posters, backendUrl }: { posters: HomepageContentOut[]; backendUrl: string }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % posters.length), [posters.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + posters.length) % posters.length), [posters.length]);

  // Auto-advance every 5s
  useEffect(() => {
    timerRef.current = setInterval(next, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 5000);
  }, [next]);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="relative h-80 sm:h-[28rem]">
        <AnimatePresence mode="wait">
          {posters.map((poster, i) =>
            i === current ? (
              <motion.div
                key={poster.id}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <SpotlightCard className="h-full homepage-feature-card overflow-hidden" spotlightColor="rgba(46, 77, 167, 0.2)">
                  <div className="flex flex-col md:flex-row h-full">
                    {poster.imageUrl && (
                      <div className="md:w-1/2 h-56 md:h-full flex-shrink-0">
                        <img
                          src={poster.imageUrl.startsWith("/") ? `${backendUrl}${poster.imageUrl}` : poster.imageUrl}
                          alt={poster.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                    <div className={`flex-1 p-6 md:p-8 flex flex-col justify-center ${!poster.imageUrl ? "text-center" : ""}`}>
                      <h3 className="text-xl sm:text-2xl font-bold homepage-heading mb-3">{poster.title}</h3>
                      {poster.content && (
                        <p className="text-sm sm:text-base leading-relaxed homepage-card-text">{poster.content}</p>
                      )}
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {posters.length > 1 && (
        <>
          <button
            onClick={() => { prev(); resetTimer(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => { next(); resetTimer(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {posters.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {posters.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); resetTimer(); }}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-white w-6" : "bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Homepage() {
  const [dynamicContent, setDynamicContent] = useState<HomepageContentOut[]>([]);
  const [stats, setStats] = useState<HomepageStats | null>(null);

  useEffect(() => {
    homepageApi.getContent().then(setDynamicContent).catch(err => console.error("[Homepage] getContent failed:", err));
    homepageApi.getStats().then(setStats).catch(err => console.error("[Homepage] getStats failed:", err));
  }, []);

  const newsItems = dynamicContent.filter(c => c.type === "news");
  const posterItems = dynamicContent.filter(c => c.type === "poster");

  return (
    <div className="min-h-screen homepage-wrapper">
      <AuroraBg />
      <LandingNavbar />

      {/* ═══════════ Hero Section ═══════════ */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo + Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4 mb-10"
          >
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-ipg-navy/30 to-ipg-sky/20 blur-xl" />
              <div className="absolute -inset-3 rounded-full hero-logo-circle" />
              <Image
                src="/logo.png"
                alt="IPG Logo"
                width={80}
                height={80}
                className="relative drop-shadow-2xl"
              />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full ipg-pill"
            >
              <Sparkles className="w-4 h-4 text-ipg-sky" />
              <ShinyText
                text="Institut Pendidikan Guru"
                className="text-sm font-semibold"
                color="#5B9BD5"
                shineColor="#ffffff"
                speed={4}
              />
            </motion.div>
          </motion.div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-8 homepage-heading">
            <BlurText
              text="Visualize Your"
              className="justify-center text-5xl sm:text-6xl lg:text-7xl font-extrabold"
              delay={60}
              animateBy="words"
              direction="bottom"
            />
            <span className="block mt-3">
              <GradientText
                colors={["#1B2A80", "#2E4DA7", "#5B9BD5", "#7BB3E0", "#2E4DA7"]}
                animationSpeed={6}
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold"
              >
                Learning Journey
              </GradientText>
            </span>
          </h1>

          {/* Subtitle */}
          <div className="max-w-2xl mx-auto mb-12">
            <BlurText
              text="Create interactive mind maps, collaborate with peers, and master your courses with smart study tools."
              className="text-lg sm:text-xl homepage-subtitle justify-center"
              delay={50}
              animateBy="words"
              direction="top"
            />
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="group flex items-center gap-2 px-8 py-4 rounded-xl btn-gradient text-white font-semibold text-base relative shadow-lg shadow-ipg-navy/30 hover:shadow-ipg-navy/50 transition-shadow"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base homepage-secondary-btn transition-all backdrop-blur-sm"
            >
              <BookOpen className="w-4 h-4" />
              Log In
            </Link>
          </motion.div>

          {/* ═══════════ Dynamic News & Posters — Sliding Carousel ═══════════ */}
          <div className="mt-16 max-w-4xl mx-auto">
            <FadeInSection className="text-center mb-8">
              <ShinyText
                text="LATEST UPDATES"
                className="text-sm font-bold uppercase tracking-[0.2em] mb-4 block"
                color="#2E4DA7"
                shineColor="#5B9BD5"
                speed={5}
              />
              <h2 className="text-3xl sm:text-4xl font-bold homepage-heading">
                News &{" "}
                <GradientText
                  colors={["#1B2A80", "#5B9BD5", "#1B2A80"]}
                  className="text-3xl sm:text-4xl font-bold"
                >
                  Announcements
                </GradientText>
              </h2>
            </FadeInSection>

            {/* Poster Carousel */}
            {posterItems.length > 0 && (
              <FadeInSection className="mb-10">
                <PosterCarousel posters={posterItems} backendUrl={BACKEND_URL} />
              </FadeInSection>
            )}

            {/* News items or empty placeholder */}
            {newsItems.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsItems.map((news, i) => (
                  <FadeInSection key={news.id} delay={i * 0.1}>
                    <SpotlightCard className="h-full homepage-feature-card" spotlightColor="rgba(91, 155, 213, 0.2)">
                      <div className="p-6">
                        {news.imageUrl && (
                          <img
                            src={news.imageUrl.startsWith("/") ? `${BACKEND_URL}${news.imageUrl}` : news.imageUrl}
                            alt={news.title}
                            className="w-full h-48 object-cover rounded-xl mb-4"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        )}
                        <h3 className="text-lg font-semibold mb-2 homepage-heading">{news.title}</h3>
                        {news.content && <p className="text-sm leading-relaxed homepage-card-text">{news.content}</p>}
                      </div>
                    </SpotlightCard>
                  </FadeInSection>
                ))}
              </div>
            ) : (
              <FadeInSection>
                <SpotlightCard className="homepage-feature-card" spotlightColor="rgba(91, 155, 213, 0.15)">
                  <div className="p-10 text-center">
                    <Sparkles className="w-10 h-10 mx-auto mb-4 text-ipg-sky opacity-40" />
                    <h3 className="text-lg font-semibold homepage-heading mb-2">News Today</h3>
                    <p className="text-sm homepage-card-text">No announcements yet. Check back soon for the latest updates!</p>
                  </div>
                </SpotlightCard>
              </FadeInSection>
            )}
          </div>

          {/* Hero Visual — Platform Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="mt-20 relative"
          >
            <div className="relative mx-auto max-w-5xl">
              {/* Glow effect behind card */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-ipg-navy/20 via-ipg-royal/15 to-ipg-sky/20 blur-2xl" />

              <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  {
                    icon: Map,
                    title: "Mind Map Editor",
                    desc: "Drag-and-drop nodes, custom shapes, real-time collaboration, and export to PDF or PNG.",
                    gradient: "from-ipg-navy to-ipg-royal",
                    delay: 1.4,
                  },
                  {
                    icon: GraduationCap,
                    title: "Course Dashboard",
                    desc: "Assignments, quizzes, grades, discussions, and resources — all in one place.",
                    gradient: "from-ipg-royal to-ipg-sky",
                    delay: 1.55,
                  },
                  {
                    icon: Brain,
                    title: "AI SmartBuddy",
                    desc: "Get personalized study plans, instant explanations, and smart recommendations powered by AI.",
                    gradient: "from-ipg-sky to-ipg-light",
                    delay: 1.7,
                  },
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: card.delay, type: "spring" }}
                  >
                    <SpotlightCard className="h-full homepage-feature-card" spotlightColor="rgba(46, 77, 167, 0.2)">
                      <div className="p-6 text-center">
                        <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                          <card.icon className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-base font-bold homepage-heading mb-2">{card.title}</h3>
                        <p className="text-xs leading-relaxed homepage-card-text">{card.desc}</p>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ Features ═══════════ */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeInSection className="text-center mb-16">
            <ShinyText
              text="FEATURES"
              className="text-sm font-bold uppercase tracking-[0.2em] mb-4 block"
              color="#2E4DA7"
              shineColor="#5B9BD5"
              speed={5}
            />
            <h2 className="text-3xl sm:text-4xl font-bold homepage-heading">
              Everything You Need to{" "}
              <GradientText
                colors={["#1B2A80", "#2E4DA7", "#5B9BD5", "#2E4DA7"]}
                className="text-3xl sm:text-4xl font-bold"
              >
                Study Smarter
              </GradientText>
            </h2>
            <p className="mt-4 max-w-xl mx-auto homepage-subtitle">
              Powerful tools designed to transform the way you learn, collaborate, and succeed.
            </p>
          </FadeInSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FadeInSection key={i} delay={i * 0.1}>
                <SpotlightCard className="group h-full homepage-feature-card" spotlightColor={feature.spotlight}>
                  <div className="p-7">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 homepage-heading">{feature.title}</h3>
                    <p className="text-sm leading-relaxed homepage-card-text">{feature.description}</p>
                  </div>
                </SpotlightCard>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ How It Works ═══════════ */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeInSection className="text-center mb-16">
            <ShinyText
              text="HOW IT WORKS"
              className="text-sm font-bold uppercase tracking-[0.2em] mb-4 block"
              color="#5B9BD5"
              shineColor="#ffffff"
              speed={5}
            />
            <h2 className="text-3xl sm:text-4xl font-bold homepage-heading">
              Get Started in{" "}
              <GradientText
                colors={["#1B2A80", "#5B9BD5", "#1B2A80"]}
                className="text-3xl sm:text-4xl font-bold"
              >
                3 Simple Steps
              </GradientText>
            </h2>
          </FadeInSection>

          <div className="space-y-6">
            {steps.map((step, i) => (
              <FadeInSection key={i} delay={i * 0.15}>
                <SpotlightCard className="homepage-feature-card" spotlightColor="rgba(46, 77, 167, 0.15)">
                  <div className="flex gap-6 items-center p-6">
                    <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-ipg-navy to-ipg-royal flex items-center justify-center shadow-lg">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-bold text-ipg-sky tracking-wider">STEP {step.step}</span>
                      </div>
                      <h3 className="text-xl font-semibold homepage-heading">{step.title}</h3>
                      <p className="homepage-card-text mt-1">{step.description}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Platform Stats (Live Data) ═══════════ */}
      <section id="stats" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <SpotlightCard className="p-10 sm:p-16 text-center homepage-stats-card" spotlightColor="rgba(27, 42, 128, 0.2)">
              <h2 className="text-3xl sm:text-4xl font-bold mb-14 homepage-heading">
                Our{" "}
                <GradientText
                  colors={["#1B2A80", "#2E4DA7", "#5B9BD5", "#2E4DA7"]}
                  className="text-3xl sm:text-4xl font-bold"
                >
                  Growing Community
                </GradientText>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { value: stats?.students ?? 0, suffix: "", label: "Students", icon: GraduationCap },
                  { value: stats?.lecturers ?? 0, suffix: "", label: "Lecturers", icon: Briefcase },
                  { value: stats?.maps ?? 0, suffix: "", label: "Mind Maps", icon: Map },
                  { value: stats?.courses ?? 0, suffix: "", label: "Courses", icon: BookOpen },
                ].map((stat, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-center mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ipg-navy/20 to-ipg-sky/20 flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-ipg-royal" />
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-gradient mb-1">
                      <CountUp to={stat.value} duration={2} separator="," />
                      {stat.suffix && <span>{stat.suffix}</span>}
                    </div>
                    <p className="text-sm homepage-card-text">{stat.label}</p>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════ Roles ═══════════ */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeInSection className="text-center mb-16">
            <ShinyText
              text="FOR EVERYONE"
              className="text-sm font-bold uppercase tracking-[0.2em] mb-4 block"
              color="#5B9BD5"
              shineColor="#ffffff"
              speed={5}
            />
            <h2 className="text-3xl sm:text-4xl font-bold homepage-heading">
              Built for{" "}
              <GradientText
                colors={["#1B2A80", "#2E4DA7", "#5B9BD5", "#2E4DA7"]}
                className="text-3xl sm:text-4xl font-bold"
              >
                Students & Lecturers
              </GradientText>
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-8">
            <FadeInSection delay={0.1}>
              <SpotlightCard className="h-full homepage-feature-card" spotlightColor="rgba(27, 42, 128, 0.25)">
                <div className="p-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ipg-navy to-ipg-royal flex items-center justify-center mb-5 shadow-lg">
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 homepage-heading">For Students</h3>
                  <ul className="space-y-3">
                    {["Create & share mind maps", "Join courses with a code", "Submit assignments visually", "Track achievements & streaks", "AI-powered study recommendations"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm homepage-card-text">
                        <CheckCircle2 className="w-4 h-4 text-ipg-royal flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </FadeInSection>

            <FadeInSection delay={0.2}>
              <SpotlightCard className="h-full homepage-feature-card" spotlightColor="rgba(91, 155, 213, 0.25)">
                <div className="p-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-ipg-royal to-ipg-sky flex items-center justify-center mb-5 shadow-lg">
                    <BarChart3 className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 homepage-heading">For Lecturers</h3>
                  <ul className="space-y-3">
                    {["Manage courses & students", "Create assignments & deadlines", "Review student mind maps", "Award badges & track progress", "Analytics & grading dashboard"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm homepage-card-text">
                        <CheckCircle2 className="w-4 h-4 text-ipg-sky flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ═══════════ Final CTA ═══════════ */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5 homepage-heading">
              Ready to{" "}
              <GradientText
                colors={["#1B2A80", "#5B9BD5", "#1B2A80"]}
                className="text-3xl sm:text-4xl font-bold"
              >
                Transform
              </GradientText>{" "}
              Your Learning?
            </h2>
            <p className="mb-10 text-lg homepage-subtitle">
              Join thousands of students and educators already using MySmartStudy.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 px-10 py-4 rounded-xl btn-gradient text-white font-semibold text-lg relative shadow-lg shadow-ipg-navy/30 hover:shadow-ipg-navy/50 transition-shadow"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Learning Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <footer className="border-t py-8 px-6 homepage-footer-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 relative">
            <div className="absolute -inset-x-3 -inset-y-1.5 rounded-full landing-logo-pill" />
            <Image src="/logo.png" alt="MySmartStudy" width={28} height={28} className="relative" />
            <GradientText colors={["#1B2A80", "#5B9BD5"]} className="relative text-sm font-bold">
              MySmartStudy
            </GradientText>
          </div>
          <p className="text-xs homepage-footer-text">
            &copy; {new Date().getFullYear()} MySmartStudy — Institut Pendidikan Guru. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
