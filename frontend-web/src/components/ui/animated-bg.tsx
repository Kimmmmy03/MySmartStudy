"use client";

export default function AnimatedBg() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-dark-900 aurora-bg-base" />
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30 aurora-blob"
        style={{
          background: "radial-gradient(circle, rgba(27,42,128,0.15), transparent 70%)",
          animation: "float 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 aurora-blob"
        style={{
          background: "radial-gradient(circle, rgba(46,77,167,0.15), transparent 70%)",
          animation: "float 10s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-15 aurora-blob"
        style={{
          background: "radial-gradient(circle, rgba(91,155,213,0.15), transparent 70%)",
          animation: "float 12s ease-in-out infinite 2s",
        }}
      />
    </div>
  );
}
