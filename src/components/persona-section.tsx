"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { PersonaDataProvider } from "@/src/components/persona-data-context";
import { PersonaNetworkSection } from "./PersonaNetworkSection";

export function PersonaSection() {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>Personas</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2 overflow-hidden">
        <PersonaDataProvider>
          <PersonaNetworkSection className="h-full" />
        </PersonaDataProvider>
      </CardContent>
    </Card>
  );
}
