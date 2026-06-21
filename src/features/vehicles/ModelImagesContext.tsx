import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useModelImages } from "./hooks";

/** model key → public image URL. Default {} so <VehicleImage> works without a provider (tests). */
export const ModelImagesContext = createContext<Record<string, string>>({});

export const useModelImageMap = () => useContext(ModelImagesContext);

/** Fetches the admin-uploaded model images once and shares them app-wide. */
export function ModelImagesProvider({ children }: { children: ReactNode }) {
  const { data } = useModelImages();
  return (
    <ModelImagesContext.Provider value={data ?? {}}>{children}</ModelImagesContext.Provider>
  );
}
