/**
 * Network Analysis Module
 * Creates relationship graphs between entities and events
 */

import { TimelineEvent, Entity, Relation, NetworkConfig } from '../../types.js';

// Node in network graph
interface NetworkNode {
  id: string;
  type: 'user' | 'entity' | 'event';
  label: string;
  properties: Record<string, any>;
  weight: number;
}

// Edge in network graph
interface NetworkEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  properties: Record<string, any>;
}

// Network graph structure
export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    communities: Record<string, string[]>;
  }
}

export class NetworkAnalyzer {
  private config: NetworkConfig;
  
  constructor(config: NetworkConfig = { enabled: true }) {
    this.config = {
      enabled: true,
      relationTypes: ['mention', 'reply', 'quote', 'cooccurrence'],
      minEdgeWeight: 1,
      communityDetection: 'louvain',
      ...config
    };
  }
  
  /**
   * Generate network graph from timeline events
   */
  async buildNetworkGraph(events: TimelineEvent[]): Promise<NetworkGraph> {
    if (!this.config.enabled) {
      return { nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, density: 0, communities: {} } };
    }
    
    const nodes: Map<string, NetworkNode> = new Map();
    const edges: Map<string, NetworkEdge> = new Map();
    
    // Process events to extract nodes and edges
    await this.processEventsForNetwork(events, nodes, edges);
    
    // Filter edges by minimum weight
    const filteredEdges = Array.from(edges.values())
      .filter(edge => edge.weight >= (this.config.minEdgeWeight || 1));
    
    // Prepare final graph
    const graph: NetworkGraph = {
      nodes: Array.from(nodes.values()),
      edges: filteredEdges,
      stats: {
        nodeCount: nodes.size,
        edgeCount: filteredEdges.length,
        density: this.calculateNetworkDensity(nodes.size, filteredEdges.length),
        communities: this.detectCommunities(nodes, filteredEdges)
      }
    };
    
    return graph;
  }
  
  /**
   * Process events to build nodes and edges
   */
  private async processEventsForNetwork(
    events: TimelineEvent[], 
    nodes: Map<string, NetworkNode>,
    edges: Map<string, NetworkEdge>
  ): Promise<void> {
    // Add all users as nodes
    const userMap = new Map<string, string>();
    
    for (const event of events) {
      // Add user node if not exists
      const userId = `user:${event.username}`;
      
      if (!nodes.has(userId)) {
        nodes.set(userId, {
          id: userId,
          type: 'user',
          label: event.username,
          properties: { platform: event.platform },
          weight: 1
        });
      } else {
        // Increment user node weight
        const node = nodes.get(userId)!;
        node.weight += 1;
      }
      
      userMap.set(event.username, userId);
      
      // Add event node
      const eventId = `event:${event.id}`;
      nodes.set(eventId, {
        id: eventId,
        type: 'event',
        label: event.title,
        properties: {
          platform: event.platform,
          category: event.category,
          timestamp: event.timestamp.toISO(),
          url: event.url
        },
        weight: 1
      });
      
      // Add user-event edge
      this.addOrUpdateEdge(edges, userId, eventId, 'created', 1, {
        timestamp: event.timestamp.toISO()
      });
      
      // Process extracted entities
      if (event.entities && event.entities.length > 0) {
        this.processEntities(event, nodes, edges);
      }
      
      // Process relations
      if (event.relations && event.relations.length > 0) {
        this.processRelations(event, nodes, edges);
      }
      
      // Process mentions in content (if entities not extracted)
      if ((!event.entities || event.entities.length === 0) && event.content) {
        this.processMentionsInContent(event, nodes, edges);
      }
    }
    
    // Process co-occurrence relationships between entities
    if (this.config.relationTypes?.includes('cooccurrence')) {
      this.processEntityCooccurrences(events, nodes, edges);
    }
  }
  
  /**
   * Process entities from an event
   */
  private processEntities(
    event: TimelineEvent,
    nodes: Map<string, NetworkNode>,
    edges: Map<string, NetworkEdge>
  ): void {
    const eventId = `event:${event.id}`;
    const userId = `user:${event.username}`;
    
    if (!event.entities) return;
    
    for (const entity of event.entities) {
      // Skip low-confidence entities
      if (entity.confidence < 0.6) continue;
      
      const entityId = `entity:${entity.type}:${entity.text}`;
      
      // Add entity node if not exists
      if (!nodes.has(entityId)) {
        nodes.set(entityId, {
          id: entityId,
          type: 'entity',
          label: entity.text,
          properties: {
            type: entity.type,
            metadata: entity.metadata || {}
          },
          weight: 1
        });
      } else {
        // Increment entity node weight
        const node = nodes.get(entityId)!;
        node.weight += 1;
      }
      
      // Add event-entity edge
      this.addOrUpdateEdge(edges, eventId, entityId, 'contains', 1, {
        confidence: entity.confidence
      });
      
      // Add user-entity edge
      this.addOrUpdateEdge(edges, userId, entityId, 'mentioned', 1, {
        timestamp: event.timestamp.toISO()
      });
      
      // Special handling for mention entities
      if (entity.type === 'mention') {
        const mentionedUser = entity.text.startsWith('@') 
          ? entity.text.substring(1) 
          : entity.text;
        
        const mentionedUserId = `user:${mentionedUser}`;
        
        // Add mentioned user if not exists
        if (!nodes.has(mentionedUserId)) {
          nodes.set(mentionedUserId, {
            id: mentionedUserId,
            type: 'user',
            label: mentionedUser,
            properties: { platform: event.platform },
            weight: 1
          });
        }
        
        // Add user-user mention edge
        this.addOrUpdateEdge(edges, userId, mentionedUserId, 'mentioned', 1, {
          timestamp: event.timestamp.toISO(),
          eventId: event.id
        });
      }
    }
  }
  
  /**
   * Process explicit relations between events
   */
  private processRelations(
    event: TimelineEvent,
    nodes: Map<string, NetworkNode>,
    edges: Map<string, NetworkEdge>
  ): void {
    const eventId = `event:${event.id}`;
    
    if (!event.relations) return;
    
    for (const relation of event.relations) {
      // Only process relation types we're interested in
      const relationType = this.mapRelationType(relation.type);
      if (!this.config.relationTypes?.includes(relationType)) continue;
      
      const targetEventId = `event:${relation.targetId}`;
      
      // Add edge between events
      this.addOrUpdateEdge(edges, eventId, targetEventId, relation.type, 1, {
        context: relation.context || ''
      });
    }
  }
  
  /**
   * Extract and process mentions directly from content
   */
  private processMentionsInContent(
    event: TimelineEvent,
    nodes: Map<string, NetworkNode>,
    edges: Map<string, NetworkEdge>
  ): void {
    const eventId = `event:${event.id}`;
    const userId = `user:${event.username}`;
    
    // Find mentions (@username)
    const mentionRegex = /\B(@[a-zA-Z0-9_]+)\b/g;
    const mentionMatches = event.content.matchAll(mentionRegex);
    
    for (const match of mentionMatches) {
      const mentionedUser = match[1].substring(1); // Remove @ prefix
      const mentionedUserId = `user:${mentionedUser}`;
      
      // Add mentioned user if not exists
      if (!nodes.has(mentionedUserId)) {
        nodes.set(mentionedUserId, {
          id: mentionedUserId,
          type: 'user',
          label: mentionedUser,
          properties: { platform: event.platform },
          weight: 1
        });
      }
      
      // Add event-user edge
      this.addOrUpdateEdge(edges, eventId, mentionedUserId, 'mentions', 1, {
        timestamp: event.timestamp.toISO()
      });
      
      // Add user-user mention edge
      this.addOrUpdateEdge(edges, userId, mentionedUserId, 'mentioned', 1, {
        timestamp: event.timestamp.toISO(),
        eventId: event.id
      });
    }
    
    // Find hashtags (#tag)
    const hashtagRegex = /\B(#[a-zA-Z0-9_]+)\b/g;
    const hashtagMatches = event.content.matchAll(hashtagRegex);
    
    for (const match of hashtagMatches) {
      const hashtag = match[1];
      const hashtagId = `entity:hashtag:${hashtag}`;
      
      // Add hashtag entity if not exists
      if (!nodes.has(hashtagId)) {
        nodes.set(hashtagId, {
          id: hashtagId,
          type: 'entity',
          label: hashtag,
          properties: { type: 'hashtag' },
          weight: 1
        });
      } else {
        // Increment hashtag node weight
        const node = nodes.get(hashtagId)!;
        node.weight += 1;
      }
      
      // Add event-hashtag edge
      this.addOrUpdateEdge(edges, eventId, hashtagId, 'contains', 1, {
        timestamp: event.timestamp.toISO()
      });
      
      // Add user-hashtag edge
      this.addOrUpdateEdge(edges, userId, hashtagId, 'used', 1, {
        timestamp: event.timestamp.toISO()
      });
    }
  }
  
  /**
   * Process co-occurrence relationships between entities
   */
  private processEntityCooccurrences(
    events: TimelineEvent[],
    nodes: Map<string, NetworkNode>,
    edges: Map<string, NetworkEdge>
  ): void {
    // Map to track entities by event
    const eventEntityMap = new Map<string, Set<string>>();
    
    // First, collect all entities for each event
    for (const event of events) {
      if (!event.entities || event.entities.length === 0) continue;
      
      const entitySet = new Set<string>();
      
      for (const entity of event.entities) {
        if (entity.confidence >= 0.6) {
          entitySet.add(`entity:${entity.type}:${entity.text}`);
        }
      }
      
      if (entitySet.size > 1) {
        eventEntityMap.set(event.id, entitySet);
      }
    }
    
    // Then, create co-occurrence edges
    for (const [eventId, entitySet] of eventEntityMap.entries()) {
      const entityIds = Array.from(entitySet);
      
      // Create edges between all pairs of entities
      for (let i = 0; i < entityIds.length; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          this.addOrUpdateEdge(
            edges, 
            entityIds[i], 
            entityIds[j], 
            'cooccurs_with', 
            1, 
            { eventId }
          );
        }
      }
    }
  }
  
  /**
   * Add or update an edge in the edge collection
   */
  private addOrUpdateEdge(
    edges: Map<string, NetworkEdge>,
    source: string,
    target: string,
    type: string,
    weight: number,
    properties: Record<string, any> = {}
  ): void {
    // Create consistent edge ID (always sort source/target to avoid duplicates)
    const [sortedSource, sortedTarget] = [source, target].sort();
    const edgeId = `${sortedSource}|${type}|${sortedTarget}`;
    
    if (edges.has(edgeId)) {
      // Update existing edge
      const edge = edges.get(edgeId)!;
      edge.weight += weight;
      
      // Merge properties
      Object.entries(properties).forEach(([key, value]) => {
        if (Array.isArray(edge.properties[key])) {
          edge.properties[key].push(value);
        } else if (edge.properties[key] !== undefined) {
          edge.properties[key] = [edge.properties[key], value];
        } else {
          edge.properties[key] = value;
        }
      });
    } else {
      // Create new edge
      edges.set(edgeId, {
        source,
        target,
        type,
        weight,
        properties
      });
    }
  }
  
  /**
   * Map relation type to standard network relation type
   */
  private mapRelationType(relationType: string): string {
    switch (relationType) {
      case 'reply_to':
        return 'reply';
      case 'quote':
        return 'quote';
      case 'reference':
        return 'mention';
      case 'thread':
        return 'reply';
      default:
        return 'other';
    }
  }
  
  /**
   * Calculate network density
   */
  private calculateNetworkDensity(nodeCount: number, edgeCount: number): number {
    if (nodeCount <= 1) return 0;
    
    // For undirected graph: 2 * |E| / (|V| * (|V| - 1))
    return (2 * edgeCount) / (nodeCount * (nodeCount - 1));
  }
  
  /**
   * Detect communities in the network
   * This is a simplified implementation - a real application would use
   * more sophisticated algorithms from network analysis libraries
   */
  private detectCommunities(
    nodes: Map<string, NetworkNode>,
    edges: NetworkEdge[]
  ): Record<string, string[]> {
    // Simple community detection based on node type and connectivity
    const communities: Record<string, string[]> = {
      users: [],
      events: [],
      entities: {}
    };
    
    // Classify nodes by type
    for (const [id, node] of nodes.entries()) {
      if (node.type === 'user') {
        communities.users.push(id);
      } else if (node.type === 'event') {
        communities.events.push(id);
      } else if (node.type === 'entity') {
        const entityType = node.properties.type || 'other';
        if (!communities.entities[entityType]) {
          communities.entities[entityType] = [];
        }
        communities.entities[entityType].push(id);
      }
    }
    
    // This is a placeholder for a more sophisticated community detection algorithm
    // like Louvain or Leiden, which would analyze the graph structure
    
    return communities;
  }
  
  /**
   * Export network graph to various formats
   */
  async exportNetworkGraph(graph: NetworkGraph, format: 'json' | 'gexf' | 'graphml'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);
      
      case 'gexf':
        return this.exportToGEXF(graph);
        
      case 'graphml':
        return this.exportToGraphML(graph);
        
      default:
        return JSON.stringify(graph, null, 2);
    }
  }
  
  /**
   * Export to GEXF format (for Gephi)
   */
  private exportToGEXF(graph: NetworkGraph): string {
    // XML header
    let output = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.3" version="1.3" xmlns:viz="http://www.gexf.net/1.3/viz">
  <meta lastmodifieddate="${new Date().toISOString().split('T')[0]}">
    <creator>Timeline Builder Network Analyzer</creator>
    <description>Network graph of timeline events and entities</description>
  </meta>
  <graph mode="static" defaultedgetype="undirected">
    <attributes class="node">
      <attribute id="type" title="Type" type="string"/>
      <attribute id="weight" title="Weight" type="float"/>
    </attributes>
    <nodes>`;
    
    // Add nodes
    for (const node of graph.nodes) {
      output += `
      <node id="${this.escapeXml(node.id)}" label="${this.escapeXml(node.label)}">
        <attvalues>
          <attvalue for="type" value="${this.escapeXml(node.type)}"/>
          <attvalue for="weight" value="${node.weight}"/>
        </attvalues>
      </node>`;
    }
    
    output += `
    </nodes>
    <edges>`;
    
    // Add edges
    for (let i = 0; i < graph.edges.length; i++) {
      const edge = graph.edges[i];
      output += `
      <edge id="${i}" source="${this.escapeXml(edge.source)}" target="${this.escapeXml(edge.target)}" 
            type="${this.escapeXml(edge.type)}" weight="${edge.weight}"/>`;
    }
    
    output += `
    </edges>
  </graph>
</gexf>`;
    
    return output;
  }
  
  /**
   * Export to GraphML format
   */
  private exportToGraphML(graph: NetworkGraph): string {
    // XML header
    let output = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="nodeType" for="node" attr.name="type" attr.type="string"/>
  <key id="nodeWeight" for="node" attr.name="weight" attr.type="double"/>
  <key id="edgeType" for="edge" attr.name="type" attr.type="string"/>
  <key id="edgeWeight" for="edge" attr.name="weight" attr.type="double"/>
  <graph id="G" edgedefault="undirected">`;
    
    // Add nodes
    for (const node of graph.nodes) {
      output += `
    <node id="${this.escapeXml(node.id)}">
      <data key="nodeType">${this.escapeXml(node.type)}</data>
      <data key="nodeWeight">${node.weight}</data>
    </node>`;
    }
    
    // Add edges
    for (let i = 0; i < graph.edges.length; i++) {
      const edge = graph.edges[i];
      output += `
    <edge id="e${i}" source="${this.escapeXml(edge.source)}" target="${this.escapeXml(edge.target)}">
      <data key="edgeType">${this.escapeXml(edge.type)}</data>
      <data key="edgeWeight">${edge.weight}</data>
    </edge>`;
    }
    
    output += `
  </graph>
</graphml>`;
    
    return output;
  }
  
  /**
   * Escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}