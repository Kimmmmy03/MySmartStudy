"use client";

import Aurora from "@/components/ui/aurora";
import Particles from "@/components/ui/particles";

export default function AuroraBg() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 aurora-bg-base" style={{ backgroundColor: "var(--color-dark-900)" }} />
      <div className="absolute inset-0 opacity-50">
        <Aurora
          colorStops={["#1B2A80", "#2E4DA7", "#5B9BD5"]}
          amplitude={1.2}
          blend={0.6}
          speed={0.5}
        />
      </div>
      <div className="absolute inset-0 opacity-30">
        <Particles
          particleCount={100}
          particleSpread={14}
          speed={0.04}
          particleColors={["#5B9BD5", "#2E4DA7", "#7BB3E0", "#1B2A80"]}
          alphaParticles
          particleBaseSize={90}
          sizeRandomness={0.7}
          cameraDistance={22}
          moveParticlesOnHover
          particleHoverFactor={0.3}
        />
      </div>
    </div>
  );
}
