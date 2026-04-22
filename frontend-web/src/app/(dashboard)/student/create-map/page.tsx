"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/ui/loading-spinner";

const MapEditor = dynamic(() => import("@/components/map-editor/map-editor"), { ssr: false });

function CreateMapContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const mapId = searchParams.get("id");
  const template = searchParams.get("template");

  if (!user) return <LoadingSpinner message="Loading..." />;

  return (
    <div className="-m-6">
      <MapEditor mapId={mapId} ownerId={user.uid} ownerEmail={user.email || ""} initialTemplate={template} />
    </div>
  );
}

export default function CreateMapPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
      <CreateMapContent />
    </Suspense>
  );
}
