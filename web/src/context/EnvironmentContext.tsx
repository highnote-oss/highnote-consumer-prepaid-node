import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConfig } from "../api/client";

interface EnvironmentContextValue {
  environment: "test" | "live" | null;
  isTestEnv: boolean;
  isLoading: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextValue>({
  environment: null,
  isTestEnv: false,
  isLoading: true,
});

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
    staleTime: Infinity,
    retry: 2,
  });

  const environment = data?.environment ?? null;
  const isTestEnv = environment === "test";

  return (
    <EnvironmentContext.Provider value={{ environment, isTestEnv, isLoading }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment(): EnvironmentContextValue {
  return useContext(EnvironmentContext);
}
