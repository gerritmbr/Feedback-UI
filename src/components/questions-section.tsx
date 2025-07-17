"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Checkbox } from "@/src/components/ui/checkbox"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Badge } from "@/src/components/ui/badge"

// Import useFeedbackData and types from your feedback-data-context file
import { useFeedbackData, Node, Link } from "@/src/components/feedback-data-context"

interface Question {
  id: string
  text: string
  selected: boolean
  answers: Answer[]
  expanded: boolean
  category: string
  question_ids: string
}

interface Answer {
  id: string
  text: string
  multiplicity?: number
  reasons: Reason[]
  question_ids: string
}

interface Reason {
  id: string
  text: string
  multiplicity?: number
  question_ids: string
}

interface CategoryGroup {
  name: string
  questions: Question[]
  selected: boolean
  expanded: boolean
}

interface QuestionsSectionProps {
  onQuestionToggle: (selectedQuestionIds: string[]) => void
}

export function QuestionsSection({ onQuestionToggle }: QuestionsSectionProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])

  // Use the useFeedbackData hook to get the shared data state
  const {
    nodesData,
    edgesData,
    isLoading,
    error,
    refreshData
  } = useFeedbackData();

  // Process data from context whenever nodesData or edgesData change
  const processDataForQuestions = useCallback(() => {
    if (isLoading) {
      return;
    }

    if (error) {
      console.error("Error from DataContext:", error);
      setQuestions([]);
      setCategoryGroups([]);
      return;
    }

    // Only process if data is available and not empty
    if (!nodesData || nodesData.length === 0 || !edgesData || edgesData.length === 0) {
      setQuestions([]);
      setCategoryGroups([]);
      return;
    }

    try {
      console.log("Processing questions data from context...")

      // Ensure that node_multiplicity is parsed as a number from the string received from CSV
      const processedNodes = nodesData.map(d => ({
        id: String(d.Id),
        label: String(d.Label),
        content: String(d.content),
        type: String(d.node_type),
        color: String(d.color || ''),
        transcript_id: String(d.transcript_id || ''),
        multiplicity: d.node_multiplicity ? Number.parseInt(String(d.node_multiplicity)) : undefined,
        content_category: String(d.content_category || ''),
      })) as Node[];

      console.log("Sample processed node:", processedNodes[0]);
      console.log("Available fields in first node:", Object.keys(nodesData[0] || {}));
      console.log("Raw content_category value:", nodesData[0]?.content_category);
      console.log("All available fields in CSV:", Object.keys(nodesData[0] || {}));

      const processedEdges = edgesData.map(d => ({
        source: String(d.Source),
        target: String(d.Target),
        weight: d.edge_multiplicity ? Number.parseInt(String(d.edge_multiplicity)) : undefined,
        type: String(d.edge_type),
      })) as Link[];

      console.log("Processed nodes count from context:", processedNodes.length)
      console.log("Processed edges count from context:", processedEdges.length)

      // Filter nodes by type
      const questionNodes = processedNodes.filter((node) => node.type === "question");
      const answerNodes = processedNodes.filter((node) => node.type === "answer");

      console.log("Question nodes from context:", questionNodes.length);
      console.log("Answer nodes from context:", answerNodes.length);

      if (questionNodes.length === 0) {
        console.warn("No question nodes found in the processed data.");
        setQuestions([]);
        setCategoryGroups([]);
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
                multiplicity: edge.weight,
                reasons: [],
              };
            }
            return null;
          })
          .filter((answer) => answer !== null)
          .sort((a, b) => (b.multiplicity || 0) - (a.multiplicity || 0));

        return {
          id: questionNode.id,
          text: questionNode.content,
          selected: false,
          answers: relatedAnswers,
          expanded: false,
          category: questionNode.content_category || 'Uncategorized'
        }
      });

      console.log("Final questions with answers (from context):", questionsWithAnswers.length)
      if (questionsWithAnswers.length > 0) {
        console.log("Sample question with answers (from context):", questionsWithAnswers[0])
        console.log("Categories found:", [...new Set(questionsWithAnswers.map(q => q.category))]);
      }

      setQuestions(questionsWithAnswers);

      // Group questions by category
      const groupedByCategory = groupQuestionsByCategory(questionsWithAnswers);
      setCategoryGroups(groupedByCategory);

      // Notify parent of initial selection (empty array)
      if (onQuestionToggle) {
        const selectedQuestionIds = questionsWithAnswers.filter((q) => q.selected).map((q) => q.id)
        console.log("Notifying parent with initial selected questions (from context):", selectedQuestionIds)
        onQuestionToggle(selectedQuestionIds)
      }

    } catch (err) {
      console.error("Error processing questions data from context:", err)
      setQuestions([]);
      setCategoryGroups([]);
    }
  }, [nodesData, edgesData, isLoading, error, onQuestionToggle]);

  // Group questions by category
  const groupQuestionsByCategory = (questions: Question[]): CategoryGroup[] => {
    const categoryMap = new Map<string, Question[]>();
    
    questions.forEach(question => {
      const category = question.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(question);
    });

    return Array.from(categoryMap.entries()).map(([name, questions]) => ({
      name,
      questions,
      selected: false,
      expanded: true
    }));
  };

  // Trigger data processing when context data changes
  useEffect(() => {
    processDataForQuestions();
  }, [processDataForQuestions]);

  const toggleQuestion = (id: string) => {
    const updatedQuestions = questions.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    setQuestions(updatedQuestions)

    // Update category groups to keep them in sync
    const updatedGroups = categoryGroups.map(group => ({
      ...group,
      questions: group.questions.map(q => q.id === id ? { ...q, selected: !q.selected } : q)
    }));
    setCategoryGroups(updatedGroups);

    if (onQuestionToggle) {
      const selectedQuestionIds = updatedQuestions.filter((q) => q.selected).map((q) => q.id)
      console.log("Question toggled, notifying parent with:", selectedQuestionIds)
      onQuestionToggle(selectedQuestionIds)
    }
  }

  const toggleCategory = (categoryName: string) => {
    const updatedGroups = categoryGroups.map(group => {
      if (group.name === categoryName) {
        const newSelected = !group.selected;
        const updatedQuestions = group.questions.map(q => ({ ...q, selected: newSelected }));
        return { ...group, selected: newSelected, questions: updatedQuestions };
      }
      return group;
    });
    setCategoryGroups(updatedGroups);

    // Update questions state to keep them in sync
    const updatedQuestions = questions.map(q => {
      const group = updatedGroups.find(g => g.questions.some(gq => gq.id === q.id));
      return group ? { ...q, selected: group.selected } : q;
    });
    setQuestions(updatedQuestions);

    if (onQuestionToggle) {
      const selectedQuestionIds = updatedQuestions.filter((q) => q.selected).map((q) => q.id)
      onQuestionToggle(selectedQuestionIds)
    }
  }

  const toggleCategoryExpanded = (categoryName: string) => {
    setCategoryGroups(prev => prev.map(group => 
      group.name === categoryName ? { ...group, expanded: !group.expanded } : group
    ));
  }

  const toggleExpanded = (id: string) => {
    // Update both questions state and categoryGroups state to keep them in sync
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, expanded: !q.expanded } : q)))
    
    setCategoryGroups(prev => prev.map(group => ({
      ...group,
      questions: group.questions.map(q => q.id === id ? { ...q, expanded: !q.expanded } : q)
    })));
  }

  const selectAll = () => {
    const updatedQuestions = questions.map((q) => ({ ...q, selected: true }))
    setQuestions(updatedQuestions)

    const updatedGroups = categoryGroups.map(group => ({
      ...group,
      selected: true,
      questions: group.questions.map(q => ({ ...q, selected: true }))
    }));
    setCategoryGroups(updatedGroups);

    if (onQuestionToggle) {
      const selectedQuestionIds = updatedQuestions.map((q) => q.id)
      onQuestionToggle(selectedQuestionIds)
    }
  }

  const selectNone = () => {
    const updatedQuestions = questions.map((q) => ({ ...q, selected: false }))
    setQuestions(updatedQuestions)

    const updatedGroups = categoryGroups.map(group => ({
      ...group,
      selected: false,
      questions: group.questions.map(q => ({ ...q, selected: false }))
    }));
    setCategoryGroups(updatedGroups);

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
            <Button size="sm" onClick={refreshData}>
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
            onClick={refreshData}
            title="Refresh Questions"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-y-auto">
        {categoryGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-sm">No questions found</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-4">
            {categoryGroups.map((categoryGroup) => (
              <div key={categoryGroup.name} className="border rounded-lg bg-white">
                {/* Category Header */}
                <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`category-${categoryGroup.name}`}
                      checked={categoryGroup.selected}
                      onCheckedChange={() => toggleCategory(categoryGroup.name)}
                      className="flex-shrink-0"
                    />
                    <label
                      htmlFor={`category-${categoryGroup.name}`}
                      className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                    >
                      {categoryGroup.name} ({categoryGroup.questions.length})
                    </label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCategoryExpanded(categoryGroup.name)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    {categoryGroup.expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* Questions in Category */}
                {categoryGroup.expanded && (
                  <div className="p-3 space-y-3">
                    {categoryGroup.questions.map((question) => {
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}