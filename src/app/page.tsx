"use client"

import { useState, useCallback} from "react"
import { QuestionsSection } from "@/src/components/questions-section"
import { NetworkSection} from "@/src/components/network-section"
import { DataProvider} from "@/src/components/data-context"
import { StatisticsSection } from "@/src/components/statistics-section"
import Header from "@/src/components/dashboard-header"

export default function Dashboard() { // <-- START Dashboard FUNCTION
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(["1", "2", "3", "4"])

  const handleQuestionToggle = useCallback((questionIds: string[]) => { // <-- START handleQuestionToggle CALLBACK
    console.log("Dashboard received question toggle:", questionIds)
    setSelectedQuestions(questionIds)
  }, []) // <-- END handleQuestionToggle CALLBACK

  const handleDataUploaded = useCallback(() => { // <-- START handleDataUploaded CALLBACK
    console.log('Data uploaded - refresh your visualizations or data state');
  }, []); // <-- END handleDataUploaded CALLBACK

  return ( // <-- START Dashboard's JSX RETURN
    <DataProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <Header onDataUploaded={handleDataUploaded} />

        {/* Main Content */}
        <div className="flex-1 py-6 px-6 flex flex-col gap-6 overflow-auto">
          {/* Top Sections: Network and Questions */}
          <div className="flex flex-col lg:flex-row gap-6 flex-1">
            {/* Network Section - Now takes 2/3 width on large screens */}
            <div className="flex-1 lg:flex-[2] min-h-[300px] max-h-[90vh]">
              <NetworkSection selectedQuestions={selectedQuestions} />
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
        </div>
      </div>
    </DataProvider>
  ); // <-- END Dashboard's JSX RETURN
} // <-- END Dashboard FUNCTION (this is the crucial one that was missing or misplaced last time)