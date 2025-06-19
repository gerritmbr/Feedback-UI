import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

const statistics = [
  {
    label: "Unique Questions",
    value: "39",
    description: "Total number of unique questions",
  },
  {
    label: "Transcripts Parsed",
    value: "12",
    description: "Successfully processed transcripts",
  },
  {
    label: "Avg Answers per Transcript",
    value: "15.3",
    description: "Average responses per transcript",
  },
];

export function StatisticsSection() {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Statistics</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-auto"> {/* Changed: overflow-hidden to overflow-auto */}
        {/* Removed flex items-center justify-center from CardContent for vertical expansion */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 w-full">
          {statistics.map((stat, index) => (
            <div key={index} className="text-center space-y-1">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm font-medium">{stat.label}</div>
              <div className="text-xs text-muted-foreground leading-tight">{stat.description}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}