"use client"

import { Button } from "@/src/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table"
import { Download } from "lucide-react"

// Define the shape of the data we expect
interface Match {
  id: string;
  [key: string]: string | number;
}

interface MatchPopupProps {
  isOpen: boolean
  onClose: () => void
  onDownload?: () => void
  data: Match[] // Update props to accept the data array
}

export function MatchPopup({ isOpen, onClose, onDownload, data }: MatchPopupProps) {

  // console.log("MatchPopup received isOpen:", isOpen);
  // console.log("MatchPopup received data:", data);
  // console.log("MatchPopup data length:", data ? data.length : "data is null/undefined");

  const handleDownload = () => {
    onDownload?.();
  };

  // Dynamically get headers from the keys of the first object in the data array
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  // Helper to capitalize header titles
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Found Matches</DialogTitle>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto my-4">
          {data.length > 0 ? (
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  {headers.map((header) => (
                    <TableHead key={header}>{capitalize(header)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((match) => (
                  <TableRow key={match.id}>
                    {headers.map((header) => (
                      <TableCell key={`${match.id}-${header}`}>
                        {String(match[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>Loading matches or none found.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={handleDownload} 
            className="flex items-center gap-2"
            disabled={data.length === 0} // Disable button if there's no data
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}