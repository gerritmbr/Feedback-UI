"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Checkbox } from "@/src/components/ui/checkbox"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Badge } from "@/src/components/ui/badge"
import * as d3 from "d3"

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
  reasons: Reason[]
}

interface Reason {
  id: string
  text: string
  multiplicity?: number
}

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

export function QuestionsSection({ onQuestionToggle }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load questions data from CSV
  const loadQuestionsData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      console.log("Loading questions data from CSV...")
      const [nodesData, edgesData] = await Promise.all([d3.csv("/data/nodes.csv"), d3.csv("/data/edges.csv")])

      console.log("Raw nodes data sample:", nodesData.slice(0, 3))
      console.log("Raw edges data sample:", edgesData.slice(0, 3))

      if (!nodesData || nodesData.length === 0) {
        throw new Error("No data found in nodes.csv")
      }

      if (!edgesData || edgesData.length === 0) {
        throw new Error("No data found in edges.csv")
      }

      // Check the actual column names
      console.log("Nodes CSV columns:", Object.keys(nodesData[0]))
      console.log("Edges CSV columns:", Object.keys(edgesData[0]))

      // Process the CSV data - using the actual column names from the CSV
      const processedNodes: NodeData[] = nodesData.map((d, index) => {
        const processed = {
          id: d.Id,
          label: d.Label,
          content: d.content,
          type: d.node_type,
          color: "",
          transcript_id: d.transcript_id,
          multiplicity: d.node_multiplicity,
        }
        

        // Log first few processed items for debugging
        if (index < 3) {
          console.log(`Processed node ${index}:`, processed)
        }

        return processed
      })

      // Process edges data
      const processedEdges: EdgeData[] = edgesData.map((d, index) => ({
        source: d.Source,
        target: d.Target,
        weight: d.edge_multiplicity,
        type: d.edge_type,
      }))

      console.log("Total processed nodes:", processedNodes.length)
      console.log("Total processed edges:", processedEdges.length)

      // Check what types we have
      const typeCount = processedNodes.reduce(
        (acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )
      console.log("Node types found:", typeCount)

      // Extract questions and their answers
      const questionNodes = processedNodes.filter((node) => node.type === "question")
      const answerNodes = processedNodes.filter((node) => node.type === "answer")

      console.log("Question nodes found:", questionNodes.length)
      console.log("Answer nodes found:", answerNodes.length)

      if (questionNodes.length > 0) {
        console.log("Sample question nodes:", questionNodes.slice(0, 3))
      }

      if (questionNodes.length === 0) {
        // Let's see what we actually have
        console.log("All unique types in data:", [...new Set(processedNodes.map((n) => n.type))])
        console.log("Sample nodes:", processedNodes.slice(0, 5))
        throw new Error(`No question nodes found in the data. Found types: ${Object.keys(typeCount).join(", ")}`)
      }

      // Build question-answer relationships using edges
      const questionsWithAnswers: Question[] = questionNodes.map((questionNode, index) => {
        // Find edges where this question is the source and target is an answer
        const questionToAnswerEdges = processedEdges.filter(
          (edge) => edge.source === questionNode.id && edge.type === "question_to_answer",
        )

        // Get the answer nodes connected to this question
        const relatedAnswers: Answer[] = questionToAnswerEdges
          .map((edge) => {
            const answerNode = answerNodes.find((node) => node.id === edge.target)
            if (answerNode) {
              return {
                id: answerNode.id,
                text: answerNode.content,
                multiplicity: answerNode.multiplicity ? Number.parseInt(answerNode.multiplicity) : undefined,
              }
            }
            return null
          })
          .filter((answer) => answer !== null)
          .sort((a, b) => (b.multiplicity || 0) - (a.multiplicity || 0)) // Sort by multiplicity descending

        return {
          id: questionNode.id,
          text: questionNode.content,
          selected: false, // Default to not selected
          answers: relatedAnswers,
          expanded: false,
        }
      })

      console.log("Final questions with answers:", questionsWithAnswers.length)
      console.log("Sample question with answers:", questionsWithAnswers[0])

      setQuestions(questionsWithAnswers)

      // Notify parent of initial selection (empty array)
      if (onQuestionToggle) {
        const selectedQuestionIds = questionsWithAnswers.filter((q) => q.selected).map((q) => q.id)
        console.log("Notifying parent with selected questions:", selectedQuestionIds)
        onQuestionToggle(selectedQuestionIds)
      }
    } catch (err) {
      console.error("Error loading questions data:", err)
      setError(`Failed to load questions data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [onQuestionToggle])

  // Load data on component mount
  useEffect(() => {
    loadQuestionsData()
  }, [loadQuestionsData])

  const toggleQuestion = (id: string) => {
    const updatedQuestions = questions.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    setQuestions(updatedQuestions)

    // Call the parent callback with the updated selected question IDs
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

  if (loading) {
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
            <Button size="sm" onClick={loadQuestionsData}>
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
            onClick={loadQuestionsData}
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