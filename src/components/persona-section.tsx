// src/components/persona-section.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { PersonaDataProvider } from "@/src/components/persona-data-context";
import { PersonaNetworkSection } from "./PersonaNetworkSection";
import { MatchButton } from "@/src/components/match-button";
import { MatchPopup } from "@/src/components/match-popup";

interface Match {
  id: string;
  [key: string]: string | number;
}

export function PersonaSection() {
  const [isMatchPopupOpen, setIsMatchPopupOpen] = useState(false);
  const [matchData, setMatchData] = useState<Match[]>([]);

  useEffect(() => {
    console.log("PersonaSection useEffect is running!");
    const fetchMatchData = async () => {
      try {
        const response = await fetch('/data/mock_matches.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedObject = await response.json(); // Data is an object, not an array directly

        // Flatten the object into a single array of matches to allow display in the Popup
        const flatMatches: Match[] = Object.values(fetchedObject).flat() as Match[];

        // console.log("Fetched data (original object):", fetchedObject); // For debugging
        // console.log("Flattened matches for MatchPopup:", flatMatches); // For debugging
        setMatchData(flatMatches); // Set the flattened data
      } catch (error) {
        console.error("Could not fetch match data:", error);
      }
    };

    fetchMatchData();
  }, []);

  const handleFindMatches = () => {
    setIsMatchPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsMatchPopupOpen(false);
  };

  const handleDownload = () => {
    // You might want to download the original structured data, or the flattened data.
    // For now, keeping the original mock_matches.json download.
    const link = document.createElement("a");
    link.href = "/data/mock_matches.json";
    link.download = "mock_matches.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Personas</CardTitle>
          <MatchButton onClick={handleFindMatches} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-2 overflow-hidden">
        <PersonaDataProvider>
          <PersonaNetworkSection className="h-full" />
        </PersonaDataProvider>
      </CardContent>

      <MatchPopup
        isOpen={isMatchPopupOpen}
        onClose={handleClosePopup}
        onDownload={handleDownload}
        data={matchData}
      />
    </Card>
  );
}