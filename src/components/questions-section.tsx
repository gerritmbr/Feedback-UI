"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Checkbox } from "@/src/components/ui/checkbox"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Badge } from "@/src/components/ui/badge"
import * as d3 from "d3" // Keep d3 if you use d3.csvParse for local upload data processing, though context handles it now.

// Import useData and the types from your data-context file
import { useData, Node, Link, NetworkData } from "@/src/components/data-context" // Adjust path if it's in src/contexts/


interface Question {
  id: string
  text: string
  selected: boolean
  answers: Answer[]
  expanded: boolean
}

interface Answer {
  id: string
  text: string
  multiplicity?: number
  reasons: Reason[] // Reasons are not currently populated in your processing, but kept for interface consistency
}

interface Reason {
  id: string
  text: string
  multiplicity?: number
}

// These interfaces are now effectively covered by Node and Link from data-context.
// You can remove them if you consistently use Node and Link from the context.
// Leaving them here for now for minimal changes, but ideally consolidate types.
/*
interface NodeData {
  id: string
  label: string
  content: string
  type: string
  color: string
  transcript_id: string
  multiplicity: string
}

interface EdgeData {
  source: string
  target: string
  type: string
  weight: string
}
*/

export function QuestionsSection({ onQuestionToggle }) {
  const [questions, setQuestions] = useState<Question[]>([])
  // isLoading and error now come from the context
  // const [loading, setLoading] = useState(true)
  // const [error, setError] = useState<string | null>(null)

  // Use the useData hook to get the shared data state
  const {
    nodesData,
    edgesData,
    isLoading, // Get isLoading from context
    error,     // Get error from context
    refreshData // Use refreshData from context for the refresh button
  } = useData();

  // Process data from context whenever nodesData or edgesData change
  const processDataForQuestions = useCallback(() => {
    // setLoading(true); // No longer needed here, context handles it
    // setError(null);   // No longer needed here, context handles it

    if (isLoading) {
      // Data is still loading in the context, so we do nothing here yet.
      // The loading state of this component will reflect the context's loading.
      return;
    }

    if (error) {
      // An error occurred in the context, so we propagate it.
      // The error state of this component will reflect the context's error.
      console.error("Error from DataContext:", error);
      setQuestions([]); // Clear questions on context error
      return;
    }

    // Only process if data is available and not empty
    if (!nodesData || nodesData.length === 0 || !edgesData || edgesData.length === 0) {
      // This state means no data is loaded yet or it's empty,
      // but not necessarily an error if it's the initial 'none' state.
      setQuestions([]);
      return;
    }

    try {
      console.log("Processing questions data from context...")

      // Ensure that node_multiplicity is parsed as a number from the string received from CSV
      // The Node and Link interfaces from data-context should already handle this if they are correctly typed,
      // but let's re-ensure it for safety in this processing step.
      const processedNodes = nodesData.map(d => ({
        id: String(d.Id), // Ensure ID is string
        label: String(d.Label),
        content: String(d.content),
        type: String(d.node_type),
        color: String(d.color || ''), // Default if not present
        transcript_id: String(d.transcript_id || ''), // Default if not present
        multiplicity: d.node_multiplicity ? Number.parseInt(String(d.node_multiplicity)) : undefined,
      })) as Node[]; // Cast to Node for type safety

      const processedEdges = edgesData.map(d => ({
        source: String(d.Source),
        target: String(d.Target),
        weight: d.edge_multiplicity ? Number.parseInt(String(d.edge_multiplicity)) : undefined, // Parse multiplicity
        type: String(d.edge_type),
      })) as Link[]; // Cast to Link for type safety

      console.log("Processed nodes count from context:", processedNodes.length)
      console.log("Processed edges count from context:", processedEdges.length)

      // Filter nodes by type. Using the 'type' property from the processed NodeData.
      const questionNodes = processedNodes.filter((node) => node.type === "question");
      const answerNodes = processedNodes.filter((node) => node.type === "answer");

      console.log("Question nodes from context:", questionNodes.length);
      console.log("Answer nodes from context:", answerNodes.length);

      if (questionNodes.length === 0) {
        console.warn("No question nodes found in the processed data.");
        setQuestions([]); // Set to empty if no questions
        return;
      }

      // Build question-answer relationships using edges
      const questionsWithAnswers: Question[] = questionNodes.map((questionNode) => {
        const questionToAnswerEdges = processedEdges.filter(
          (edge) => String(edge.source) === String(questionNode.id) && String(edge.type) === "question_to_answer",
        )

        const relatedAnswers: Answer[] = questionToAnswerEdges
          .map((edge) => {
            const answerNode = answerNodes.find((node) => String(node.id) === String(edge.target));
            if (answerNode) {
              return {
                id: answerNode.id,
                text: answerNode.content,
                multiplicity: answerNode.multiplicity, // This should already be a number from your Node interface
                reasons: [],
              };
            }
            return null;
          })
          .filter((answer) => answer !== null) // <--- REMOVE 'as Answer[]' FROM HERE
          .sort((a, b) => (b.multiplicity || 0) - (a.multiplicity || 0));

        return {
          id: questionNode.id,
          text: questionNode.content,
          selected: false, // Default to not selected
          answers: relatedAnswers,
          expanded: false,
        }
      });

      console.log("Final questions with answers (from context):", questionsWithAnswers.length)
      if (questionsWithAnswers.length > 0) {
        console.log("Sample question with answers (from context):", questionsWithAnswers[0])
      }

      setQuestions(questionsWithAnswers);

      // Notify parent of initial selection (empty array)
      if (onQuestionToggle) {
        const selectedQuestionIds = questionsWithAnswers.filter((q) => q.selected).map((q) => q.id)
        console.log("Notifying parent with initial selected questions (from context):", selectedQuestionIds)
        onQuestionToggle(selectedQuestionIds)
      }

    } catch (err) {
      console.error("Error processing questions data from context:", err)
      // setError(`Failed to process questions data: ${err.message}`) // Context error already handled
      setQuestions([]);
    } // finally is not needed here as isLoading is handled by context
  }, [nodesData, edgesData, isLoading, error, onQuestionToggle]); // Re-run when context data or states change

  // Trigger data processing when context data changes
  useEffect(() => {
    processDataForQuestions();
  }, [processDataForQuestions]);

  const toggleQuestion = (id: string) => {
    const updatedQuestions = questions.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    setQuestions(updatedQuestions)

    if (onQuestionToggle) {
      const selectedQuestionIds = updatedQuestions.filter((q) => q.selected).map((q) => q.id)
      console.log("Question toggled, notifying parent with:", selectedQuestionIds)
      onQuestionToggle(selectedQuestionIds)
    }
  }

  const toggleExpanded = (id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, expanded: !q.expanded } : q)))
  }

  const selectAll = () => {
    const updatedQuestions = questions.map((q) => ({ ...q, selected: true }))
    setQuestions(updatedQuestions)

    if (onQuestionToggle) {
      const selectedQuestionIds = updatedQuestions.map((q) => q.id)
      onQuestionToggle(selectedQuestionIds)
    }
  }

  const selectNone = () => {
    const updatedQuestions = questions.map((q) => ({ ...q, selected: false }))
    setQuestions(updatedQuestions)

    if (onQuestionToggle) {
      onQuestionToggle([])
    }
  }

  const getMultiplicityColor = (multiplicity: number, maxMultiplicity: number) => {
    if (maxMultiplicity === 0) return "bg-gray-100 text-gray-800 border-gray-200"

    const intensity = multiplicity / maxMultiplicity
    if (intensity > 0.7) return "bg-green-100 text-green-800 border-green-200"
    if (intensity > 0.4) return "bg-yellow-100 text-yellow-800 border-yellow-200"
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  // Use isLoading and error from the context
  if (isLoading) {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading questions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Use error from the context
  if (error) {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-600 max-w-md">
            <p className="text-sm font-medium mb-2">Error Loading Questions</p>
            <p className="text-xs mb-4">{error}</p>
            <Button size="sm" onClick={refreshData}> {/* Use refreshData from context */}
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedCount = questions.filter((q) => q.selected).length

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>
          Questions ({selectedCount}/{questions.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll} title="Select All">
            All
          </Button>
          <Button variant="ghost" size="sm" onClick={selectNone} title="Select None">
            None
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={refreshData} // Use refreshData from context
            title="Refresh Questions"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-y-auto">
        {questions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-sm">No questions found</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-4">
            {questions.map((question, index) => {
              // Calculate max multiplicity for this question's answers for color coding
              const maxMultiplicity = Math.max(...question.answers.map((a) => a.multiplicity || 0))

              return (
                <div key={question.id} className="border rounded-lg p-4 bg-gray-50 flex-shrink-0">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={question.id}
                      checked={question.selected}
                      onCheckedChange={() => toggleQuestion(question.id)}
                      className="mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={question.id}
                          className="text-sm font-medium cursor-pointer hover:text-primary transition-colors pr-2"
                        >
                          {question.text}
                        </label>
                        {question.answers.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(question.id)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            {question.expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {question.expanded && question.answers.length > 0 && (
                        <div className="mt-3 pl-2 border-l-2 border-gray-200">
                          <div className="space-y-2">
                            {question.answers.map((answer, answerIndex) => (
                              <div key={answerIndex} className="flex items-center justify-between py-1">
                                <span className="text-xs text-gray-600 flex-1">• {answer.text}</span>
                                {answer.multiplicity !== undefined && (
                                  <Badge
                                    variant="outline"
                                    className={`ml-2 text-xs px-2 py-0 ${getMultiplicityColor(
                                      answer.multiplicity,
                                      maxMultiplicity,
                                    )}`}
                                  >
                                    {answer.multiplicity}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          {question.answers.length > 0 && question.answers[0].multiplicity !== undefined && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>Total responses:</span>
                                <Badge variant="secondary" className="text-xs">
                                  {question.answers.reduce((sum, answer) => sum + (answer.multiplicity || 0), 0)}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}