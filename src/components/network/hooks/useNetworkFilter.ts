// useNetworkFilter.ts - Data filtering utilities

import { useCallback } from "react"
import { Node, Link, NetworkData } from "@/src/components/feedback-data-context"

export function useNetworkFilter() {
  const getFilteredNetworkData = useCallback((
    networkData: NetworkData | null,
    selectedQuestions: string[],
    showTranscriptLinks: boolean,
    selectedTranscriptIds: string[] = []
  ) => {
    if (!networkData) {
      console.log("No network data available for filtering")
      return { nodes: [], links: [] }
    }

    console.log("Filtering network data for questions:", selectedQuestions)
    console.log("Filtering network data for transcript IDs:", selectedTranscriptIds)
    console.log("Available nodes:", networkData.nodes.length)

    // Helper function to check if node matches transcript filter
    const matchesTranscriptFilter = (node: any): boolean => {
      if (selectedTranscriptIds.length === 0) return true
      
      if (!node.transcript_id) return false
      
      // Handle pipe-separated transcript IDs (e.g., "1|2|3|4")
      const nodeTranscriptIds = String(node.transcript_id)
        .split('|')
        .map(id => id.trim())
        .filter(id => id.length > 0)
      
      // Check if any of the node's transcript IDs match selected ones
      return nodeTranscriptIds.some(id => selectedTranscriptIds.includes(id))
    }

    // Pre-filter all nodes by transcript IDs if transcript filtering is active
    const transcriptFilteredNodes = selectedTranscriptIds.length > 0 
      ? networkData.nodes.filter(matchesTranscriptFilter)
      : networkData.nodes

    console.log("Nodes after transcript filtering:", transcriptFilteredNodes.length)

    if (selectedQuestions.length === 0) {
      // If no specific questions are selected, return transcript-filtered nodes and links
      const transcriptFilteredNodeIds = new Set(transcriptFilteredNodes.map(node => node.id))
      
      const filteredLinks = networkData.links.filter((link: any) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id
        const targetId = typeof link.target === "string" ? link.target : link.target.id
        
        // Keep links where both nodes pass transcript filter
        const keepLink = transcriptFilteredNodeIds.has(sourceId) && transcriptFilteredNodeIds.has(targetId)
        
        // Also respect showTranscriptLinks toggle
        if (!showTranscriptLinks && (link.type === "same_transcript_answer" || link.type === "same_transcript_reason")) {
          return false
        }
        
        return keepLink
      })
      
      return { nodes: transcriptFilteredNodes, links: filteredLinks }
    }

    // When both questions and transcript filtering are active, work with transcript-filtered dataset
    const workingNodes = transcriptFilteredNodes
    const workingNodeIds = new Set(workingNodes.map(node => node.id))
    
    let connectedNodeIds = new Set<string>()
    let relevantLinks: Link[] = []
    let questionAnswerMap = new Map<string, Set<string>>() // Track which answers belong to which questions

    // --- Phase 1: Build the core subgraph based on selected questions and their direct answers ---
    // Now working with transcript-filtered dataset
    let initialChanged = true
    while (initialChanged) {
      initialChanged = false
      const currentSize = connectedNodeIds.size

      // Add selected questions if not already present AND they pass transcript filter
      selectedQuestions.forEach(qId => {
        if (!connectedNodeIds.has(qId) && workingNodeIds.has(qId)) {
          connectedNodeIds.add(qId)
          initialChanged = true
        }
      })

      // Iterate over links to find Q->A connections from currently connected questions
      networkData.links.forEach((link: any) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id
        const targetId = typeof link.target === "string" ? link.target : link.target.id

        // Only consider "question_to_answer" links for this phase
        if (link.type === "question_to_answer") {
          // If the source (question) is connected, and the target (answer) is not, add the target and the link
          // BUT only if both nodes pass transcript filter
          if (connectedNodeIds.has(sourceId) && !connectedNodeIds.has(targetId) && 
              workingNodeIds.has(sourceId) && workingNodeIds.has(targetId)) {
            connectedNodeIds.add(targetId)
            if (!relevantLinks.includes(link)) {
              relevantLinks.push(link)
            }
            
            // Track which answers belong to which questions
            if (!questionAnswerMap.has(sourceId)) {
              questionAnswerMap.set(sourceId, new Set())
            }
            questionAnswerMap.get(sourceId)!.add(targetId)
            
            initialChanged = true
          }
          // If both source and target are already connected AND pass transcript filter, ensure the link is added
          else if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId) && 
                   workingNodeIds.has(sourceId) && workingNodeIds.has(targetId)) {
            if (!relevantLinks.includes(link)) {
              relevantLinks.push(link)
            }
          }
        }
      })

      // If no new nodes were added in this iteration, stop.
      if (connectedNodeIds.size === currentSize) {
        initialChanged = false
      }
    }

    // --- Extract question_ids from selected question nodes ---
    const selectedQuestionIds = new Set<string>()
    selectedQuestions.forEach(questionNodeId => {
      const questionNode = workingNodes.find((node: any) => node.id === questionNodeId && node.type === "question")
      if (questionNode && questionNode.question_ids) {
        // Handle both string and array formats for question_ids
        const questionQIDs = Array.isArray(questionNode.question_ids)
          ? questionNode.question_ids
          : String(questionNode.question_ids).split('|').filter((id: string) => id.trim() !== '')
        
        questionQIDs.forEach(qid => selectedQuestionIds.add(qid))
      }
    })

    console.log("Selected question IDs for reason filtering:", Array.from(selectedQuestionIds))

    // --- Phase 2: Add reasons ONLY for answers that belong to selected questions AND share question IDs ---
    networkData.links.forEach((link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id
      const targetId = typeof link.target === "string" ? link.target : link.target.id

      if (link.type === "answer_to_reason") {
        // Only add reason if the source (answer) belongs to one of our selected questions
        const answerBelongsToSelectedQuestion = Array.from(questionAnswerMap.values())
          .some(answerSet => answerSet.has(sourceId))
        
        if (answerBelongsToSelectedQuestion && !connectedNodeIds.has(targetId) && workingNodeIds.has(targetId)) {
          // Get the reason node to check its question_ids
          const reasonNode = workingNodes.find((node: any) => node.id === targetId)
          if (reasonNode && reasonNode.question_ids) {
            // reasonNode.question_ids can be a string (from CSV) or an array
            const reasonQIDs = Array.isArray(reasonNode.question_ids)
              ? reasonNode.question_ids
              : String(reasonNode.question_ids).split('|').filter((id: string) => id.trim() !== '')
            
            // Check if the reason shares any question IDs with the selected question IDs
            const hasSharedQuestionId = reasonQIDs.some(reasonQId => 
              selectedQuestionIds.has(reasonQId)
            )
            
            if (hasSharedQuestionId) {
              connectedNodeIds.add(targetId)
              if (!relevantLinks.includes(link)) {
                relevantLinks.push(link)
              }
            }
          }
        }
        // If both source and target are already connected, ensure the link is added
        else if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
          if (!relevantLinks.includes(link)) {
            relevantLinks.push(link)
          }
        }
      }
    })

    // --- Phase 3: Conditionally add "same_transcript" links *only* between *already connected* nodes ---
    // This phase ensures constraint #2: same_transcript links act as bridges only.
    if (showTranscriptLinks) {
      // Iterate over relevant links to find if any 'same_transcript' connections exist
      // between the nodes we've already identified as 'connectedNodeIds'.
      networkData.links.forEach((link: any) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id
        const targetId = typeof link.target === "string" ? link.target : link.target.id

        const isTranscriptLink =
          link.type === "same_transcript_answer" ||
          link.type === "same_transcript_reason"

        if (isTranscriptLink) {
          // Only add the transcript link if BOTH source and target are ALREADY in connectedNodeIds
          if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
            if (!relevantLinks.includes(link)) {
              relevantLinks.push(link)
            }
          }
        }
      })
    }

    // Final filtering based on the accumulated connectedNodeIds and relevantLinks
    // Only include nodes that both pass transcript filter AND are in the connected set
    const filteredNodes = workingNodes.filter((node: any) =>
      connectedNodeIds.has(node.id)
    )

    const finalFilteredLinks = relevantLinks.filter((link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id
      const targetId = typeof link.target === "string" ? link.target : link.target.id
      // Ensure both source and target are in our final set of connected nodes
      return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)
    })

    console.log("Filtered nodes (final):", filteredNodes.length)
    console.log("Filtered links (final):", finalFilteredLinks.length)
    console.log("Question-Answer mapping:", Object.fromEntries(
      Array.from(questionAnswerMap.entries()).map(([q, answers]) => [q, Array.from(answers)])
    ))

    console.log("Filtered links by type (final):")
    const linkTypeCounts = finalFilteredLinks.reduce((acc, link) => {
      acc[link.type || "unknown"] = (acc[link.type || "unknown"] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(linkTypeCounts)

    return { nodes: filteredNodes, links: finalFilteredLinks }
  }, [])

  return { getFilteredNetworkData }
}