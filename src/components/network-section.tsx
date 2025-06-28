"use client"

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Button } from "@/src/components/ui/button"
import {  Check, X, ChevronDown, ChevronRight, Settings, ZoomIn, ZoomOut, Move, Hand, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/src/components/ui/dropdown-menu"
import * as d3 from "d3"
import { useData, Node, Link, NetworkData  } from "@/src/components/data-context"

// interface Node extends d3.SimulationNodeDatum {
//   id: string
//   label: string
//   content: string
//   type: "question" | "answer" | "reason"
//   color: string
//   transcript_id: string
//   multiplicity?: number
// }

// interface Link extends d3.SimulationLinkDatum<Node> {
//   source: string | Node
//   target: string | Node
//   transcript_id?: string
//   type?: "question_to_answer" | "answer_to_reason" | "same_transcript_answer" | "same_transcript_reason" 
// }


type LayoutType = "force" | "circular" | "hierarchical" | "grid" //| "tree"

// Helper function for default colors based on node type
function getDefaultColor(nodeType: string): string {
  switch (nodeType) {
    case "question":
      return "#3b82f6" // blue
    case "answer":
      return "#10b981" // green
    case "reason":
      return "#f59e0b" // amber
    default:
      return "#6b7280" // gray
  }
}

export function NetworkSection({ selectedQuestions = [] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [layout, setLayout] = useState<LayoutType>("force")
  // const [panEnabled, setPanEnabled] = useState(true)
  const [networkData, setNetworkData] = useState<NetworkData | null>(null)
  // const [loading, setLoading] = useState(true)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)
  const containerGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const [showTranscriptLinks, setShowTranscriptLinks] = useState(false);
  

  // Use data from context
  const { 
    nodesData, 
    edgesData, 
    isLoading, 
    error, 
    dataSource, 
    refreshData 
  } = useData();

  // // Load network data from CSV files
  // const loadNetworkData = useCallback(async () => {
  //   setLoading(true)
  //   setError(null)

  //   try {
  //     console.log("Loading network data from CSV files...")

  //     // Load both CSV files in parallel
  //     const [nodesData, edgesData] = await Promise.all([d3.csv("/data/nodes.csv"), d3.csv("/data/edges.csv")])

  //     console.log("Raw nodes data sample:", nodesData.slice(0, 3))
  //     console.log("Raw edges data sample:", edgesData.slice(0, 3))

  //     if (!nodesData || nodesData.length === 0) {
  //       throw new Error("No data found in nodes.csv")
  //     }

  //     if (!edgesData || edgesData.length === 0) {
  //       throw new Error("No data found in edges.csv")
  //     }

  //     // Check the actual column names in the CSV
  //     console.log("Nodes CSV columns:", Object.keys(nodesData[0]))
  //     console.log("Edges CSV columns:", Object.keys(edgesData[0]))

  //     // Process nodes data - using the correct column names from the CSV
  //     const nodes: Node[] = nodesData.map((d, index) => {
  //       const node = {
  //         id: d.Id || d.id || `node_${index}`,
  //         label: d.Label,
  //         content: d.content,
  //         type: (d.node_type || d.type || "unknown") as "question" | "answer" | "reason",
  //         color: d.color || getDefaultColor(d.node_type || d.type),
  //         transcript_id: d.transcript_id || undefined,
  //         multiplicity: d.node_multiplicity ? Number.parseInt(d.node_multiplicity) : undefined,
  //       }

  //       // Log first few nodes for debugging
  //       if (index < 3) {
  //         console.log(`Processed node ${index}:`, node)
  //       }

  //       return node
  //     })

  //     // Process edges data - using the correct column names from the CSV
  //     const links: Link[] = edgesData.map((d, index) => {
  //       const link = {
  //         source: d.Source || d.source || "",
  //         target: d.Target || d.target || "",
  //         transcript_id: d.transcript_id || undefined,
  //         type: (d.edge_type || d.type || "unknown_link_type") as "question_to_answer" | "answer_to_reason" | "same_transcript_answer" | "same_transcript_reason",
  //       }

  //       // Log first few links for debugging
  //       if (index < 3) {
  //         console.log(`Processed link ${index}:`, link)
  //       }

  //       return link
  //     })

  //     console.log("Total processed nodes:", nodes.length)
  //     console.log("Total processed links:", links.length)

  //     // Check what types we have
  //     const typeCount = nodes.reduce(
  //       (acc, node) => {
  //         acc[node.type] = (acc[node.type] || 0) + 1
  //         return acc
  //       },
  //       {} as Record<string, number>,
  //     )
  //     console.log("Node types found:", typeCount)

  //     // Filter out any invalid nodes or links
  //     const validNodes = nodes.filter((node) => node.id && node.label && node.type)
  //     const validLinks = links.filter((link) => link.source && link.target)

  //     console.log("Valid nodes:", validNodes.length)
  //     console.log("Valid links:", validLinks.length)

  //     if (validNodes.length === 0) {
  //       throw new Error("No valid nodes found after processing")
  //     }

  //     setNetworkData({ nodes: validNodes, links: validLinks })
  //   } catch (err) {
  //     console.error("Error loading network data:", err)
  //     setError(`Failed to load network data: ${err.message}`)
  //   } finally {
  //     setLoading(false)
  //   }
  // }, [])

  // // Load data on component mount
  // useEffect(() => {
  //   loadNetworkData()
  // }, [loadNetworkData])

    // Process the raw CSV data into network format
  const processNetworkData = useCallback(() => {
    
    if (isLoading || error || !nodesData.length || !edgesData.length) {
      console.log("Skipping network data processing: isLoading or error or empty data.", { isLoading, error, nodesCount: nodesData.length, edgesCount: edgesData.length });
      setNetworkData(null); // Clear previous network data if conditions for processing aren't met
      return;
    }

    if (!nodesData.length || !edgesData.length) return;

    console.log("Processing network data...")
    console.log("Raw nodes data sample:", nodesData.slice(0, 3))
    console.log("Raw edges data sample:", edgesData.slice(0, 3))
    console.log("Data source:", dataSource)
    
    // Check the actual column names in the CSV
    console.log("Nodes CSV columns:", Object.keys(nodesData[0]))
    console.log("Edges CSV columns:", Object.keys(edgesData[0]))
    
    // Process nodes data
    const nodes: Node[] = nodesData.map((d, index) => {
      const node = {
        id: d.Id || d.id || `node_${index}`,
        label: d.Label,
        content: d.content,
        type: (d.node_type || d.type || "unknown") as "question" | "answer" | "reason",
        color: d.color || getDefaultColor(d.node_type || d.type),
        transcript_id: d.transcript_id || undefined,
        multiplicity: d.node_multiplicity ? Number.parseInt(d.node_multiplicity) : undefined,
      }
      
      if (!node.id) {
        console.warn(`Node at index ${index} missing ID:`, d)
      }
      
      return node
    })

    // Process edges data
    const edges: Link[] = edgesData.map((d, index) => {
      const edge = {
        source: d.source || d.Source,
        target: d.target || d.Target,
        weight: d.weight ? Number.parseFloat(d.weight) : 1,
        type: d.type || d.edge_type || "default",
      }
      
      if (!edge.source || !edge.target) {
        console.warn(`Edge at index ${index} missing source/target:`, d)
      }
      
      return edge
    })

    console.log(`Processed ${nodes.length} nodes and ${edges.length} edges`)
    
    // Filter out any invalid nodes/edges
    const validNodes = nodes.filter(n => n.id)
    const validEdges = edges.filter(e => e.source && e.target)
    
    if (validNodes.length !== nodes.length) {
      console.warn(`Filtered out ${nodes.length - validNodes.length} invalid nodes`)
    }
    if (validEdges.length !== edges.length) {
      console.warn(`Filtered out ${edges.length - validEdges.length} invalid edges`)
    }

    const processedData: NetworkData = {
      nodes: validNodes,
      links: validEdges,
    }

    setNetworkData(processedData)
    console.log("Network data processed successfully")
  }, [nodesData, edgesData, dataSource, isLoading, error])

  // Process data when raw data changes
  useEffect(() => {
    processNetworkData()
  }, [processNetworkData])

const getFilteredNetworkData = useCallback(() => {
  if (!networkData) {
      console.log("No network data available for filtering");
      return { nodes: [], links: [] };
  }

  console.log("Filtering network data for questions:", selectedQuestions);
  console.log("Available nodes:", networkData.nodes.length);

  if (selectedQuestions.length === 0) {
      // If no specific questions are selected, return all nodes and links,
      // respecting the 'showTranscriptLinks' toggle.
      const allLinks = showTranscriptLinks
      ? networkData.links
      : networkData.links.filter((link: any) =>
      link.type !== "same_transcript_answer" && link.type !== "same_transcript_reason"
      );
      return { nodes: networkData.nodes, links: allLinks };
  }

  let connectedNodeIds = new Set<string>();
  let relevantLinks: Link[] = [];
  let questionAnswerMap = new Map<string, Set<string>>(); // Track which answers belong to which questions

  // --- Phase 1: Build the core subgraph based on selected questions and their direct answers ---
  let initialChanged = true;
  while (initialChanged) {
      initialChanged = false;
      const currentSize = connectedNodeIds.size;

      // Add selected questions if not already present
      selectedQuestions.forEach(qId => {
      if (!connectedNodeIds.has(qId)) {
      connectedNodeIds.add(qId);
      initialChanged = true;
      }
      });

      // Iterate over links to find Q->A connections from currently connected questions
      networkData.links.forEach((link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      // Only consider "question_to_answer" links for this phase
      if (link.type === "question_to_answer") {
      // If the source (question) is connected, and the target (answer) is not, add the target and the link
      if (connectedNodeIds.has(sourceId) && !connectedNodeIds.has(targetId)) {
      connectedNodeIds.add(targetId);
      if (!relevantLinks.includes(link)) {
        relevantLinks.push(link);
      }
      
      // Track which answers belong to which questions
      if (!questionAnswerMap.has(sourceId)) {
        questionAnswerMap.set(sourceId, new Set());
      }
      questionAnswerMap.get(sourceId)!.add(targetId);
      
      initialChanged = true;
      }
      // If both source and target are already connected, ensure the link is added
      else if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
      if (!relevantLinks.includes(link)) {
        relevantLinks.push(link);
      }
      }
      }
      });

      // If no new nodes were added in this iteration, stop.
      if (connectedNodeIds.size === currentSize) {
      initialChanged = false;
      }
  }

  // --- Phase 2: Add reasons ONLY for answers that belong to selected questions ---
  networkData.links.forEach((link: any) => {
    const sourceId = typeof link.source === "string" ? link.source : link.source.id;
    const targetId = typeof link.target === "string" ? link.target : link.target.id;

    if (link.type === "answer_to_reason") {
      // Only add reason if the source (answer) belongs to one of our selected questions
      const answerBelongsToSelectedQuestion = Array.from(questionAnswerMap.values())
        .some(answerSet => answerSet.has(sourceId));
      
      if (answerBelongsToSelectedQuestion && !connectedNodeIds.has(targetId)) {
        connectedNodeIds.add(targetId);
        if (!relevantLinks.includes(link)) {
          relevantLinks.push(link);
        }
      }
      // If both source and target are already connected, ensure the link is added
      else if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
        if (!relevantLinks.includes(link)) {
          relevantLinks.push(link);
        }
      }
    }
  });

  // --- Phase 3: Conditionally add "same_transcript" links *only* between *already connected* nodes ---
  // This phase ensures constraint #2: same_transcript links act as bridges only.
  if (showTranscriptLinks) {
      // Iterate over relevant links to find if any 'same_transcript' connections exist
      // between the nodes we've already identified as 'connectedNodeIds'.
      networkData.links.forEach((link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      const isTranscriptLink =
      link.type === "same_transcript_answer" ||
      link.type === "same_transcript_reason";

      if (isTranscriptLink) {
      // Only add the transcript link if BOTH source and target are ALREADY in connectedNodeIds
      if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
      if (!relevantLinks.includes(link)) {
        relevantLinks.push(link);
      }
      }
      }
      });
  }

  // Final filtering based on the accumulated connectedNodeIds and relevantLinks
  const filteredNodes = networkData.nodes.filter((node: any) =>
      connectedNodeIds.has(node.id)
  );

  const finalFilteredLinks = relevantLinks.filter((link: any) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      // Ensure both source and target are in our final set of connected nodes
      return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId);
  });

  console.log("Filtered nodes (final):", filteredNodes.length);
  console.log("Filtered links (final):", finalFilteredLinks.length);
  console.log("Question-Answer mapping:", Object.fromEntries(
    Array.from(questionAnswerMap.entries()).map(([q, answers]) => [q, Array.from(answers)])
  ));

  console.log("Filtered links by type (final):");
  const linkTypeCounts = finalFilteredLinks.reduce((acc, link) => {
      acc[link.type || "unknown"] = (acc[link.type || "unknown"] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);
  console.log(linkTypeCounts);

  return { nodes: filteredNodes, links: finalFilteredLinks };
  }, [networkData, selectedQuestions, showTranscriptLinks]);



  // Initialize SVG and zoom behavior once
  const initializeSVG = useCallback(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Clear existing content but preserve structure
    svg.selectAll("*").remove()

    // Create main group for all network elements
    const g = svg.append("g")
    containerGroupRef.current = g

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        // // Allow zoom with wheel always
        // if (event.type === "wheel") return true
        // // Allow pan only if panEnabled is true and it's not interacting with a node
        // if (event.type === "mousedown" || event.type === "touchstart") {
        //   const target = event.target as Element
        //   return panEnabled && !target.closest("circle")
        // }
        // return panEnabled
        return true;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    zoomRef.current = zoom
    svg.call(zoom)

    // Update cursor based on pan state
    // svg.style("cursor", panEnabled ? "grab" : "default")
    svg.style("cursor",  "grab")

    svg.on("mousedown", function (event) {
      // const target = event.target as Element
      // if (panEnabled && !target.closest("circle")) {
        d3.select(this).style("cursor", "grabbing")
      // }
    })

    svg.on("mouseup", function () {
      // if (panEnabled) 
      d3.select(this).style("cursor", "grab")
    })

    svg.on("mouseleave", function () {
      // if (panEnabled) 
      d3.select(this).style("cursor", "grab")
    })
  }, []) //[panEnabled])

  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1 / 1.5)
    }
  }, [])

  const handleResetView = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity)
    }
  }, [])

  // const togglePan = useCallback(() => {
  //   setPanEnabled(!panEnabled)
  // }, [panEnabled])

  // const handleRefreshData = useCallback(() => {
  //   loadNetworkData()
  // }, [loadNetworkData])

   const handleRefreshData = useCallback(() => {
    processNetworkData()
  }, [processNetworkData])


  // Apply different layout algorithms
  const applyLayout = useCallback((nodes: Node[], layoutType: LayoutType, width: number, height: number) => {
    const centerX = width / 2
    const centerY = height / 2

    switch (layoutType) {
      case "circular":
        const radius = Math.min(width, height) * 0.3
        nodes.forEach((node, i) => {
          const angle = (2 * Math.PI * i) / nodes.length
          node.x = centerX + radius * Math.cos(angle)
          node.y = centerY + radius * Math.sin(angle)
          node.fx = node.x
          node.fy = node.y
        })
        break

      case "hierarchical":
        // Group nodes by type
        const questionNodes = nodes.filter((n) => n.type === "question")
        const answerNodes = nodes.filter((n) => n.type === "answer")
        const reasonNodes = nodes.filter((n) => n.type === "reason")

        // Position questions at top
        questionNodes.forEach((node, i) => {
          node.x = (width / (questionNodes.length + 1)) * (i + 1)
          node.y = height * 0.2
          node.fx = node.x
          node.fy = node.y
        })

        // Position answers in middle
        answerNodes.forEach((node, i) => {
          node.x = (width / (answerNodes.length + 1)) * (i + 1)
          node.y = height * 0.5
          node.fx = node.x
          node.fy = node.y
        })

        // Position reasons at bottom
        reasonNodes.forEach((node, i) => {
          node.x = (width / (reasonNodes.length + 1)) * (i + 1)
          node.y = height * 0.8
          node.fx = node.x
          node.fy = node.y
        })
        break

      case "grid":
        const cols = Math.ceil(Math.sqrt(nodes.length))
        const rows = Math.ceil(nodes.length / cols)
        const cellWidth = width / cols
        const cellHeight = height / rows

        nodes.forEach((node, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          node.x = cellWidth * (col + 0.5)
          node.y = cellHeight * (row + 0.5)
          node.fx = node.x
          node.fy = node.y
        })
        break

      case "force":
      default:
        // Remove fixed positions for force layout
        nodes.forEach((node) => {
          node.fx = null
          node.fy = null
        })
        break

      // case "tree":

      //   nodes.forEach((node, i) => {
      //     node.fx = null
      //     node.fy = null
      //   })
      //   break
    }
  }, [])

  // Update network visualization
  const updateVisualization = useCallback(
    (nodes: Node[], links: Link[], layoutType: LayoutType, width: number, height: number) => {
      if (!containerGroupRef.current) {
        console.log("No container group available");
        return;
      }

      console.log("Updating visualization:", layoutType, "with", nodes.length, "nodes and", links.length, "links");

      const g = containerGroupRef.current;

      // Clear content of the main 'g' only if nodes are empty
      // Otherwise, D3's join() will handle removals, preserving existing elements
      if (nodes.length === 0) {
        console.log("No nodes to display, clearing all content.");
        g.selectAll("*").remove();
        return;
      }

      // Stop any existing simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
      }

      // Apply layout positioning
      applyLayout(nodes, layoutType, width, height);

      // --- Create/Select dedicated groups for links and nodes to control z-order ---
      // Ensure the links group is appended BEFORE the nodes group.
      // D3's 'insert' is useful here if groups might already exist but in wrong order.
      let linkGroup = g.select<SVGGElement>(".links-group");
      if (linkGroup.empty()) {
          linkGroup = g.append("g").attr("class", "links-group");
          console.log("Created links-group");
      }

      let nodeGroup = g.select<SVGGElement>(".nodes-group");
      if (nodeGroup.empty()) {
          // If nodes-group doesn't exist, append it. It will be after links-group.
          nodeGroup = g.append("g").attr("class", "nodes-group");
          console.log("Created nodes-group");
      } else {
          // IMPORTANT: Ensure nodeGroup is AFTER linkGroup in DOM order.
          // If it already exists, move it to the front (which puts it after linkGroup if linkGroup is static).
          // Or better, ensure linkGroup is always inserted before nodeGroup.
          // A simple re-append ensures it's last, but also removes children temporarily.
          // A more robust way if they already exist:
          if (nodeGroup.node()!.previousElementSibling !== linkGroup.node()) {
              linkGroup.lower(); // Ensures linkGroup is behind everything else in 'g'
              nodeGroup.raise(); // Ensures nodeGroup is in front of everything else in 'g'
              console.log("Adjusted group z-order.");
          }
      }


      // --- LINKS (handle all link types within this single link selection) ---
      const link = linkGroup // Operate on the linkGroup
        .selectAll<SVGLineElement, Link>("line")
        .data(
          links,
          (d: Link) =>
            `${typeof d.source === "string" ? d.source : d.source.id}-${typeof d.target === "string" ? d.target : d.target.id}-${d.type}`
        )
        .join(
          enter => enter.append("line")
                        .attr("stroke-width", 2)
                        .attr("stroke-dasharray", (d) => {
                            if (d.type === "same_transcript_answer") return "4 2";
                            if (d.type === "same_transcript_reason") return "2 2";
                            return "0";
                        })
                        .attr("stroke", (d) => {
                            if (d.type === "question_to_answer") return "#e5e7eb";
                            if (d.type === "same_transcript_answer") return "#a8a29e";
                            if (d.type === "same_transcript_reason") return "#ef4444";
                            return "#6b7280";
                        }),
          update => update // Update existing links
                      .attr("stroke-dasharray", (d) => {
                          if (d.type === "same_transcript_answer") return "4 2";
                          if (d.type === "same_transcript_reason") return "2 2";
                          return "0";
                      })
                      .attr("stroke", (d) => {
                          if (d.type === "question_to_answer") return "#e5e7eb";
                          if (d.type === "same_transcript_answer") return "#a8a29e";
                          if (d.type === "same_transcript_reason") return "#ef4444";
                          return "#6b7280";
                      }),
          exit => exit.remove()
        );


      // --- NODES (handle all node types within this single node selection) ---
      const node = nodeGroup // Operate on the nodeGroup
        .selectAll<SVGGElement, Node>(".node-group")
        .data(nodes, (d: Node) => d.id)
        .join(
          enter => {
            const nodeEnterGroup = enter.append("g")
                                        .attr("class", "node-group")
                                        .style("cursor", "pointer")
                                        .call(d3.drag<SVGGElement, Node>()
                                            .on("start", (event, d) => { if (!event.active) simulationRef.current?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                                            .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
                                            .on("end", (event, d) => { if (!event.active) simulationRef.current?.alphaTarget(0); }));

            // Append circle to the entering 'g' group
            nodeEnterGroup.append("circle")
                          .attr("stroke", "#fff")
                          .attr("stroke-width", 2);

            // Append text label to the entering 'g' group
            nodeEnterGroup.append("text")
                          .attr("class", "node-label")
                          .attr("text-anchor", "middle")
                          .attr("fill", "#374151")
                          .style("pointer-events", "none");

            return nodeEnterGroup;
          },
          update => update, // No structural changes to 'g' itself on update
          exit => exit.remove()
        );


      // --- Update Attributes for Circles within Node Groups ---
      node.select("circle") // Select the circle within each node group (both enter and update)
          .attr("r", (d) => {
              if (d.type === "question") return 14;
              if (d.type === "answer") {
                  const baseRadius = 10;
                  const maxRadius = 16;
                  if (d.multiplicity && d.multiplicity > 0) {
                      const answerNodes = nodes.filter((n) => n.type === "answer" && n.multiplicity && n.multiplicity > 0);
                      if (answerNodes.length > 0) {
                          const maxMultiplicity = Math.max(...answerNodes.map((n) => n.multiplicity!));
                          const scale = maxMultiplicity === 0 ? 0 : d.multiplicity / maxMultiplicity;
                          return baseRadius + (maxRadius - baseRadius) * scale;
                      }
                  }
                  return baseRadius;
              }
              return 6; // reason
          })
          .attr("fill", (d) => d.color);


      // --- Update Attributes for Labels within Node Groups ---
      node.select(".node-label") // Select the text within each node group
          .text((d) => (d.content && d.content.length > 100 ? d.content.substring(0, 100) + "..." : d.content || d.id))
          .attr("font-size", (d) => {
              if (d.type === "question") return "11px";
              if (d.type === "answer") return "9px";
              return "8px";
          })
          .attr("dy", (d) => {
              if (d.type === "question") return 28;
              if (d.type === "answer") return 22;
              return 18;
          });


      // --- Simulation setup ---
      const simulation = d3
        .forceSimulation(nodes as d3.SimulationNodeDatum[])
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

      simulationRef.current = simulation;

      // --- Tick function to update positions ---
      const ticked = () => {
        link // refers to the entire merged link selection
          .attr("x1", (d) => (d.source as Node).x || 0)
          .attr("y1", (d) => (d.source as Node).y || 0)
          .attr("x2", (d) => (d.target as Node).x || 0)
          .attr("y2", (d) => (d.target as Node).y || 0);

        node // refers to the entire merged node group selection
          .attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
      };

      simulation.on("tick", ticked);

      // Initial positioning
      ticked();

      if (layoutType !== "force") {
        simulation.alpha(0.3).restart();
        setTimeout(() => {
          simulation.stop();
          nodes.forEach(d => {
            d.fx = d.x;
            d.fy = d.y;
          });
          ticked();
        }, 500);
      } else {
        simulation.alpha(1).restart();
      }

    },
    [applyLayout /* dragstarted, dragged, dragended */]
  );


  // Initialize SVG when component mounts or panEnabled changes
  useEffect(() => {
    initializeSVG()
  }, [initializeSVG])

  // Update visualization when data or layout changes
  useEffect(() => {
    if (!networkData) {
      console.log("No network data available for visualization")
      return
    } 

    const width = 600
    const height = 400
    const { nodes, links } = getFilteredNetworkData()

    console.log("About to update visualization with:", nodes.length, "nodes")
    updateVisualization([...nodes] as Node[], [...links], layout, width, height)
  }, [layout, selectedQuestions, networkData, updateVisualization, getFilteredNetworkData])

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [])

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Feedback Network</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleRefreshData}
            disabled={isLoading}
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Layout Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLayout("force")} className={layout === "force" ? "bg-accent" : ""}>
                Force Directed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLayout("circular")}
                className={layout === "circular" ? "bg-accent" : ""}
              >
                Circular
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLayout("hierarchical")}
                className={layout === "hierarchical" ? "bg-accent" : ""}
              >
                Hierarchical
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLayout("grid")} className={layout === "grid" ? "bg-accent" : ""}>
                Grid
              </DropdownMenuItem>
              {/* <DropdownMenuItem
                onClick={() => setLayout("tree")}
                className={layout === "tree" ? "bg-accent" : ""}
              >
                tree
              </DropdownMenuItem>*/}
                <DropdownMenuSeparator />
                 <DropdownMenuLabel>Link Options</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => setShowTranscriptLinks(prev => !prev)} className="flex justify-between items-center">
                    <span>Show Transcript Links</span>
                    {showTranscriptLinks ? (
                        <Check className="h-4 w-4 text-primary" /> // Or some other checkmark/indicator
                    ) : (
                        <X className="h-4 w-4 text-muted-foreground" /> // Or some other cross/indicator
                    )}
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-hidden">
        <div className="w-full h-full bg-gray-50 rounded-lg p-4 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-20">
              <div className="flex items-center gap-2 text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading network data...</span>
                  {dataSource === 'local' && (
                    <div className="text-sm text-green-600 mb-2">
                      Using uploaded CSV data
                    </div>
                  )}
                  {dataSource === 'server' && (
                    <div className="text-sm text-blue-600 mb-2">
                      Using server CSV data
                    </div>
  )}
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-20">
              <div className="text-center text-red-600 max-w-md">
                <p className="text-sm font-medium mb-2">Error Loading Data</p>
                <p className="text-xs mb-4">{error}</p>
                <Button size="sm" onClick={handleRefreshData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && networkData && (
            <>
              {/* Control Panel */}
              <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 bg-white rounded-lg shadow-sm border p-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomOut} title="Zoom Out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleResetView} title="Reset View">
                  <Move className="h-4 w-4" />
                </Button>
 {/*               <div className="w-full h-px bg-gray-200 my-1" />
                <Button
                  variant={panEnabled ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={togglePan}
                  title={panEnabled ? "Disable Pan" : "Enable Pan"}
                >
                  <Hand className="h-4 w-4" />
                </Button> */}
              </div>

              {/* Layout Info */}
              <div className="absolute top-2 right-2 z-10 bg-white/90 rounded px-2 py-1 text-xs text-gray-600">
                {layout.charAt(0).toUpperCase() + layout.slice(1)} Layout | Nodes:{" "}
                {getFilteredNetworkData().nodes.length} | Links: {getFilteredNetworkData().links.length}
              </div>

              {/* Instructions */}
              <div className="absolute bottom-2 left-2 z-10 bg-white/90 rounded px-2 py-1 text-xs text-gray-600">
                Drag to pan • Scroll to zoom • Drag nodes to move
              </div>
            </>
          )}

          <svg
            ref={svgRef}
            viewBox="0 0 600 400"
            className="w-full h-full"
            style={{ maxHeight: "100%", maxWidth: "100%" }}
            preserveAspectRatio="none"
          />
        </div>
      </CardContent>
    </Card>
  )
}