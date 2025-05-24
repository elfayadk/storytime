import React, { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Box, useTheme } from '@mui/material';
import type { TimelineEvent, NetworkNode, NetworkLink } from '../types';

interface NetworkGraphProps {
  events: TimelineEvent[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({
  events,
  width = 800,
  height = 600,
  onNodeClick
}) => {
  const theme = useTheme();

  // Build graph data from events
  const { nodes, links } = useMemo(() => {
    const nodesMap = new Map<string, NetworkNode>();
    const linksMap = new Map<string, NetworkLink>();

    // Add users as nodes
    events.forEach(event => {
      // Add event creator
      if (!nodesMap.has(event.username)) {
        nodesMap.set(event.username, {
          id: event.username,
          label: event.username,
          name: event.username,
          type: 'user',
          value: 1,
          platform: event.platform
        });
      } else {
        const node = nodesMap.get(event.username)!;
        node.value++;
      }

      // Add mentioned users and create links
      event.entities?.forEach(entity => {
        if (entity.type === 'mention' || entity.type === 'person') {
          const targetId = entity.text.replace('@', '');
          
          // Add mentioned user node
          if (!nodesMap.has(targetId)) {
            nodesMap.set(targetId, {
              id: targetId,
              label: targetId,
              name: targetId,
              type: 'user',
              value: 1
            });
          }

          // Add interaction link
          const linkId = `${event.username}-${targetId}`;
          if (!linksMap.has(linkId)) {
            linksMap.set(linkId, {
              source: event.username,
              target: targetId,
              type: 'mention',
              value: 1
            });
          } else {
            linksMap.get(linkId)!.value++;
          }
        }
      });

      // Add topics as nodes and create links
      event.topics?.forEach(topic => {
        const topicId = `topic-${topic}`;
        
        // Add topic node
        if (!nodesMap.has(topicId)) {
          nodesMap.set(topicId, {
            id: topicId,
            name: topic,
            type: 'topic',
            value: 1
          });
        } else {
          nodesMap.get(topicId)!.value++;
        }

        // Add topic link
        const linkId = `${event.username}-${topicId}`;
        if (!linksMap.has(linkId)) {
          linksMap.set(linkId, {
            source: event.username,
            target: topicId,
            type: 'topic',
            value: 1
          });
        } else {
          linksMap.get(linkId)!.value++;
        }
      });

      // Add entity nodes and links
      event.entities?.forEach(entity => {
        if (entity.type === 'organization' || entity.type === 'location') {
          const entityId = `entity-${entity.type}-${entity.text}`;
          
          // Add entity node
          if (!nodesMap.has(entityId)) {
            nodesMap.set(entityId, {
              id: entityId,
              label: entity.text,
              name: entity.text,
              type: 'entity',
              value: 1
            });
          } else {
            nodesMap.get(entityId)!.value++;
          }

          // Add entity link
          const linkId = `${event.username}-${entityId}`;
          if (!linksMap.has(linkId)) {
            linksMap.set(linkId, {
              source: event.username,
              target: entityId,
              type: entity.type,
              value: 1
            });
          } else {
            linksMap.get(linkId)!.value++;
          }
        }
      });
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links: Array.from(linksMap.values())
    };
  }, [events]);

  const getNodeColor = (node: NetworkNode) => {
    switch (node.type) {
      case 'user':
        switch (node.platform) {
          case 'github':
            return theme.palette.secondary.main;
          case 'twitter':
            return theme.palette.info.main;
          case 'reddit':
            return theme.palette.error.main;
          default:
            return theme.palette.primary.main;
        }
      case 'topic':
        return theme.palette.success.main;
      case 'entity':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getLinkColor = (link: NetworkLink) => {
    switch (link.type) {
      case 'mention':
        return theme.palette.primary.light;
      case 'topic':
        return theme.palette.success.light;
      case 'organization':
        return theme.palette.warning.light;
      case 'location':
        return theme.palette.info.light;
      default:
        return theme.palette.grey[300];
    }
  };

  return (
    <Box sx={{ width, height }}>
      <ForceGraph2D
        graphData={{ nodes, links }}
        nodeLabel={node => `${(node as NetworkNode).label}`}
        nodeColor={node => getNodeColor(node as NetworkNode)}
        nodeRelSize={6}
        nodeVal={node => Math.sqrt((node as NetworkNode).value * 100)}
        linkColor={link => getLinkColor(link as NetworkLink)}
        linkWidth={link => Math.sqrt((link as NetworkLink).value)}
        linkDirectionalParticles={3}
        linkDirectionalParticleWidth={link => Math.sqrt((link as NetworkLink).value)}
        onNodeClick={(node) => onNodeClick?.(node as NetworkNode)}
        cooldownTicks={100}
        width={width}
        height={height}
      />
    </Box>
  );
};

export default NetworkGraph; 