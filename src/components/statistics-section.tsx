"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { useFeedbackData } from "@/src/components/feedback-data-context";
import { useMemo } from "react";

export function StatisticsSection() {
  const { nodesData, edgesData, isLoading, error } = useFeedbackData();

  const statistics = useMemo(() => {
    if (isLoading || error || !nodesData || !edgesData) {
      return [
        {
          label: "Unique Questions",
          value: "0",
          description: "Total number of unique questions",
        },
        {
          label: "Transcripts Parsed",
          value: "0",
          description: "Successfully processed transcripts",
        },
        {
          label: "Avg Answers per Transcript",
          value: "0",
          description: "Average responses per transcript",
        },
      ];
    }

    // Calculate unique transcript IDs
    const extractIds = (transcriptId: string): string[] => {
      // Split by common separators: pipe, comma, semicolon, or whitespace
      const separators = /[|,;\s]+/;
      return transcriptId
        .split(separators)
        .map(id => id.trim())
        .filter(id => id !== '' && !isNaN(Number(id))) // Only keep valid numerical IDs
        .map(id => id.toString()); // Ensure consistent string format
    };

    const uniqueTranscriptIds = new Set(
      nodesData
        .map(node => node.transcript_id)
        .filter((id: string) => id && id !== '') // Filter out empty or null values
        .flatMap((transcriptId: string) => extractIds(transcriptId))
    );

    // Calculate unique questions
    const questionNodes = nodesData.filter(node => node.node_type === "question");
    const uniqueQuestions = new Set(questionNodes.map(node => node.Id));

    // Calculate total answers
    const answerNodes = nodesData.filter(node => node.node_type === "answer");
    const totalAnswers = answerNodes.length;

    // Calculate average answers per transcript
    const avgAnswersPerTranscript = uniqueTranscriptIds.size > 0 
      ? (totalAnswers / uniqueTranscriptIds.size).toFixed(1)
      : "0";

    return [
      {
        label: "Unique Questions",
        value: uniqueQuestions.size.toString(),
        description: "Total number of unique questions",
      },
      {
        label: "Transcripts Parsed",
        value: uniqueTranscriptIds.size.toString(),
        description: "Successfully processed transcripts",
      },
      {
        label: "Avg Answers per Transcript",
        value: avgAnswersPerTranscript,
        description: "Average responses per transcript",
      },
    ];
  }, [nodesData, edgesData, isLoading, error]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-auto">
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