"use client"

import { useState, useCallback} from "react"
import { QuestionsSection } from "@/src/components/questions-section"
// import { NetworkSection } from "@/src/components/network-section"
import { FeedbackDataProvider} from "@/src/components/feedback-data-context"
import { ReportDataProvider } from "@/src/components/report-data-context"
import { StatisticsSection } from "@/src/components/statistics-section"
import { PersonaSection } from "@/src/components/persona-section"
import { FeedbackNetworkSection } from "@/src/components/feedback-network-section";
import Header from "@/src/components/dashboard-header"
import { SuccessBanner } from "@/src/components/success-banner"
import { useReportData } from "@/src/components/report-data-context"

function DashboardContent() {
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(["1", "2", "3", "4"])
  const { showSuccessBanner } = useReportData();

  const handleQuestionToggle = useCallback((questionIds: string[]) => { // <-- START handleQuestionToggle CALLBACK
    console.log("Dashboard received question toggle:", questionIds)
    setSelectedQuestions(questionIds)
  }, []) // <-- END handleQuestionToggle CALLBACK

  const handleDataUploaded = useCallback(() => { // <-- START handleDataUploaded CALLBACK
    console.log('Data uploaded - refresh your visualizations or data state');
  }, []); // <-- END handleDataUploaded CALLBACK

  return ( // <-- START Dashboard's JSX RETURN
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 py-6 px-6 flex flex-col gap-6 overflow-auto">
        {/* Top Sections: Network and Questions */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Network Section - Now takes 2/3 width on large screens */}
          <div className="flex-1 lg:flex-[2] min-h-[300px] max-h-[90vh]">
            <FeedbackNetworkSection selectedQuestions={selectedQuestions} />
          </div>

          {/* Questions Section - Now takes 1/3 width on large screens */}
          <div className="flex-1 lg:flex-[1] min-h-[300px] max-h-[90vh] overflow-auto">
            <QuestionsSection onQuestionToggle={handleQuestionToggle} />
          </div>
        </div>

        {/* Statistics Section */}
        <div className="w-full">
          <StatisticsSection />
        </div>

        {/* Persona section */}
        <div className="w-full">
          <PersonaSection />
        </div>
      </div>
      
      {/* Success Banner */}
      <SuccessBanner show={showSuccessBanner} />
    </div>
  ); // <-- END Dashboard's JSX RETURN
}

export default function Dashboard() {
  return (
    <FeedbackDataProvider>
      <ReportDataProvider>
        <DashboardContent />
      </ReportDataProvider>
    </FeedbackDataProvider>
  );
}