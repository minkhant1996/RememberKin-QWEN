/**
 * Graph Service
 *
 * Handles all Neo4j graph database operations for Rememberkin.
 * This service manages:
 * - Family creation and membership
 * - Person/member management
 * - Family tree relationships (PARENT_OF, SPOUSE_OF, SIBLING_OF)
 * - Story CRUD with visibility controls
 * - Memory/fact storage linked to people
 * - Event management
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Comprehensive error handling and logging
 * - Session management for database connections
 *
 * @module services/graph.service
 */

import neo4j from 'neo4j-driver';
import { v4 as uuid } from 'uuid';
import { getSession, runQuery } from '../config/neo4j.js';
import {
  Person,
  Family,
  FamilyTree,
  FamilyInvite,
  Story,
  CreateStoryInput,
  Memory,
  Event,
} from '../models/types.js';
import { randomUUID } from 'crypto';
import {
  EpisodicMemory,
  CreateEpisodicInput,
  EpisodicQueryOptions,
  SemanticMemory,
  CreateSemanticInput,
  SemanticQueryOptions,
  ProceduralMemory,
  CreateProceduralInput,
  MemoryActivity,
  CreateActivityInput,
  EpisodicMemoryStats,
  SemanticMemoryStats,
  ProceduralMemoryStats,
} from '../models/memory-types.js';
import { logger } from '../utils/logger.js';
import { withRetry, RetryOptions } from '../utils/retry.js';
import { DatabaseError, logError } from '../utils/errors.js';

/**
 * Convert a Neo4j temporal value (DateTime/Date) to an ISO string for JSON responses.
 */
export function toISODate(value: any): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value.toStandardDate === 'function') return value.toStandardDate().toISOString();
  return String(value);
}

/**
 * Normalize raw Neo4j node properties for JSON responses: Integers become JS
 * numbers and temporal values become ISO strings, so {low, high} structs never
 * leak to the frontend.
 */
export function normalizeProps<T extends Record<string, any>>(props: T): T {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== null && typeof value === 'object' && typeof (value as any).toNumber === 'function') {
      out[key] = (value as any).toNumber();
    } else if (value !== null && typeof value === 'object' && typeof (value as any).toStandardDate === 'function') {
      out[key] = (value as any).toStandardDate().toISOString();
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Default retry options for Neo4j operations.
 */
const NEO4J_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error: Error) => {
    const message = error.message.toLowerCase();
    // Retry on connection errors, timeouts, and transient failures
    return (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('socket') ||
      message.includes('transient') ||
      message.includes('unavailable') ||
      message.includes('deadlock')
    );
  },
};

/**
 * Execute a Neo4j operation with retry logic.
 */
async function withNeo4jRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  try {
    const result = await withRetry(operation, {
      ...NEO4J_RETRY_OPTIONS,
      operationName,
      onRetry: (attempt, error, delay) => {
        logger.warn({
          operation: operationName,
          attempt,
          error: error.message,
          delay,
          ...metadata,
        }, `Neo4j operation retry: ${operationName} (attempt ${attempt})`);
      },
    });

    return result.data;
  } catch (error) {
    const dbError = new DatabaseError(`Neo4j operation failed: ${operationName}`, error as Error, {
      operation: operationName,
      metadata,
    });
    logError(dbError);
    throw dbError;
  }
}

/**
 * GraphService class for Neo4j database operations.
 *
 * @example
 * ```typescript
 * import { graphService } from './services/graph.service';
 *
 * // Create a family
 * const family = await graphService.createFamily('Smith Family', userId);
 *
 * // Get family tree
 * const tree = await graphService.getFamilyTree(familyId);
 * ```
 */
export class GraphService {
  // ============ FAMILY ============

  /**
   * Creates a new family and adds the creator as the first member.
   *
   * @param name - The name of the family (e.g., "The Smith Family")
   * @param creatorId - UUID of the person creating the family
   * @returns The created family object
   *
   * @example
   * ```typescript
   * const family = await graphService.createFamily('Smith Family', 'user-123');
   * console.log(family.id); // Generated UUID
   * ```
   */
  async createFamily(name: string, creatorId: string): Promise<Family> {
    return withNeo4jRetry('createFamily', async () => {
      const session = getSession();
      try {
        const familyId = uuid();
        const result = await session.run(
          `
          MATCH (p:Person {id: $creatorId})
          CREATE (f:Family {
            id: $familyId,
            name: $name,
            createdAt: datetime()
          })
          CREATE (p)-[:MEMBER_OF]->(f)
          RETURN f
          `,
          { familyId, name, creatorId }
        );

        if (result.records.length === 0) {
          throw new Error(`Creator user not found: ${creatorId}`);
        }

        return result.records[0].get('f').properties;
      } finally {
        await session.close();
      }
    }, { creatorId });
  }

  async getFamily(familyId: string): Promise<Family | null> {
    return withNeo4jRetry('getFamily', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})
          OPTIONAL MATCH (f)<-[:MEMBER_OF]-(m:Person)
          RETURN f, count(m) as memberCount
          `,
          { familyId }
        );

        if (result.records.length === 0) return null;

        const family = result.records[0].get('f').properties;
        family.memberCount = result.records[0].get('memberCount').toNumber();
        return family;
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  /**
   * Adds a person to a family, optionally creating a relationship to an existing member.
   *
   * @param familyId - The family to join
   * @param memberId - The person to add
   * @param relationship - Optional relationship to create with an existing family member
   * @param relationship.type - Type of relationship (PARENT_OF, SPOUSE_OF, SIBLING_OF)
   * @param relationship.relatedTo - ID of the existing family member to relate to
   * @returns True if successful, false otherwise
   *
   * @example
   * ```typescript
   * // Add member without relationship
   * await graphService.addMemberToFamily(familyId, memberId);
   *
   * // Add member as sibling of existing member
   * await graphService.addMemberToFamily(familyId, memberId, {
   *   type: 'SIBLING_OF',
   *   relatedTo: 'existing-member-id'
   * });
   * ```
   */
  async addMemberToFamily(
    familyId: string,
    memberId: string,
    relationship?: { type: 'PARENT_OF' | 'SPOUSE_OF' | 'SIBLING_OF'; relatedTo: string }
  ): Promise<boolean> {
    try {
      await withNeo4jRetry('addMemberToFamily', async () => {
        const session = getSession();
        try {
          // First, add member to family
          await session.run(
            `
            MATCH (f:Family {id: $familyId}), (p:Person {id: $memberId})
            WHERE NOT (p)-[:MEMBER_OF]->(f)
            CREATE (p)-[:MEMBER_OF]->(f)
            `,
            { familyId, memberId }
          );
        } finally {
          await session.close();
        }
      }, { familyId, memberId });

      // If relationship specified, create it
      if (relationship && relationship.relatedTo) {
        await this.addFamilyRelationship(memberId, relationship.relatedTo, relationship.type);
      }

      return true;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        familyId,
        memberId,
      }, 'Failed to add member to family');
      return false;
    }
  }

  async getFamilyTree(familyId: string): Promise<FamilyTree> {
    return withNeo4jRetry('getFamilyTree', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(p:Person)
          OPTIONAL MATCH (p)-[r:PARENT_OF|SPOUSE_OF|SIBLING_OF]-(related:Person)
          WHERE (related)-[:MEMBER_OF]->(f)
          RETURN p, collect(DISTINCT {person: related, relation: type(r), direction: startNode(r) = p}) as relations
          `,
          { familyId }
        );

        const nodesMap = new Map<string, any>();
        const edges: FamilyTree['edges'] = [];

        for (const record of result.records) {
          const person = record.get('p').properties;
          nodesMap.set(person.id, {
            id: person.id,
            name: person.name,
            nickname: person.nickname,
            birthDate: person.birthDate,
            deathDate: person.deathDate,
            isDeceased: person.isDeceased || false,
            avatar: person.avatar,
            isRegistered: person.isRegistered !== false,
          });

          const relations = record.get('relations');
          for (const rel of relations) {
            if (rel.person && rel.direction) {
              const relatedPerson = rel.person.properties;
              nodesMap.set(relatedPerson.id, {
                id: relatedPerson.id,
                name: relatedPerson.name,
                nickname: relatedPerson.nickname,
                birthDate: relatedPerson.birthDate,
                deathDate: relatedPerson.deathDate,
                isDeceased: relatedPerson.isDeceased || false,
                avatar: relatedPerson.avatar,
                isRegistered: relatedPerson.isRegistered !== false,
              });

              // Avoid duplicate edges
              const edgeKey = [person.id, relatedPerson.id].sort().join('-');
              if (!edges.find((e) => [e.from, e.to].sort().join('-') === edgeKey)) {
                edges.push({
                  from: person.id,
                  to: relatedPerson.id,
                  relationship: rel.relation,
                });
              }
            }
          }
        }

        return {
          nodes: Array.from(nodesMap.values()),
          edges,
        };
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  // ============ PERSON ============

  async createPerson(data: Partial<Person> & { email: string; passwordHash: string }): Promise<Person> {
    return withNeo4jRetry('createPerson', async () => {
      const session = getSession();
      try {
        const personId = uuid();
        const result = await session.run(
          `
          CREATE (p:Person {
            id: $personId,
            name: $name,
            email: $email,
            passwordHash: $passwordHash,
            createdAt: datetime()
          })
          RETURN p
          `,
          { personId, name: data.name, email: data.email, passwordHash: data.passwordHash }
        );

        return result.records[0].get('p').properties;
      } finally {
        await session.close();
      }
    }, { email: data.email });
  }

  /**
   * Create a family member (non-user, e.g., deceased relatives).
   * These members don't have email/password and can't login.
   */
  async createFamilyMember(data: {
    name: string;
    nickname?: string;
    birthDate?: string;
    deathDate?: string;
    isDeceased?: boolean;
    avatar?: string;
    familyId: string;
  }): Promise<Person> {
    return withNeo4jRetry('createFamilyMember', async () => {
      const session = getSession();
      try {
        const personId = uuid();
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})
          CREATE (p:Person {
            id: $personId,
            name: $name,
            nickname: $nickname,
            birthDate: $birthDate,
            deathDate: $deathDate,
            isDeceased: $isDeceased,
            avatar: $avatar,
            createdAt: datetime()
          })
          CREATE (p)-[:MEMBER_OF]->(f)
          RETURN p
          `,
          {
            personId,
            familyId: data.familyId,
            name: data.name,
            nickname: data.nickname || null,
            birthDate: data.birthDate || null,
            deathDate: data.deathDate || null,
            isDeceased: data.isDeceased || false,
            avatar: data.avatar || null,
          }
        );

        return result.records[0].get('p').properties;
      } finally {
        await session.close();
      }
    }, { familyId: data.familyId });
  }

  async getPersonByEmail(email: string): Promise<(Person & { passwordHash: string; familyId?: string }) | null> {
    return withNeo4jRetry('getPersonByEmail', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:Person {email: $email})
          OPTIONAL MATCH (p)-[:MEMBER_OF]->(f:Family)
          RETURN p, f.id as familyId
          `,
          { email }
        );

        if (result.records.length === 0) return null;

        const person = result.records[0].get('p').properties;
        person.familyId = result.records[0].get('familyId');
        return person;
      } finally {
        await session.close();
      }
    });
  }

  async getPerson(personId: string): Promise<Person | null> {
    return withNeo4jRetry('getPerson', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:Person {id: $personId})
          RETURN p
          `,
          { personId }
        );

        if (result.records.length === 0) return null;
        return result.records[0].get('p').properties;
      } finally {
        await session.close();
      }
    }, { personId });
  }

  async updatePerson(personId: string, input: Partial<Person>): Promise<Person | null> {
    return withNeo4jRetry('updatePerson', async () => {
      const session = getSession();
      try {
        const updates: string[] = [];
        const params: Record<string, any> = { personId };

        if (input.name !== undefined) {
          updates.push('p.name = $name');
          params.name = input.name;
        }
        if (input.nickname !== undefined) {
          updates.push('p.nickname = $nickname');
          params.nickname = input.nickname;
        }
        if (input.birthDate !== undefined) {
          updates.push('p.birthDate = $birthDate');
          params.birthDate = input.birthDate;
        }
        if (input.deathDate !== undefined) {
          updates.push('p.deathDate = $deathDate');
          params.deathDate = input.deathDate;
        }
        if (input.isDeceased !== undefined) {
          updates.push('p.isDeceased = $isDeceased');
          params.isDeceased = input.isDeceased;
        }
        if (input.avatar !== undefined) {
          updates.push('p.avatar = $avatar');
          params.avatar = input.avatar;
        }
        if (input.preferences !== undefined) {
          updates.push('p.preferences = $preferences');
          params.preferences = input.preferences;
        }

        if (updates.length === 0) {
          return this.getPerson(personId);
        }

        const result = await session.run(
          `
          MATCH (p:Person {id: $personId})
          SET ${updates.join(', ')}
          RETURN p
          `,
          params
        );

        if (result.records.length === 0) return null;
        return result.records[0].get('p').properties;
      } finally {
        await session.close();
      }
    }, { personId });
  }

  async getRelationshipPath(fromId: string, toId: string): Promise<{ path: string[]; relationships: string[] } | null> {
    return withNeo4jRetry('getRelationshipPath', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH path = shortestPath((from:Person {id: $fromId})-[*..10]-(to:Person {id: $toId}))
          RETURN [n IN nodes(path) | n.name] AS names,
                 [r IN relationships(path) | type(r)] AS relationships
          `,
          { fromId, toId }
        );

        if (result.records.length === 0) return null;

        return {
          path: result.records[0].get('names'),
          relationships: result.records[0].get('relationships'),
        };
      } finally {
        await session.close();
      }
    }, { fromId, toId });
  }

  async getFamilyMembers(familyId: string): Promise<Person[]> {
    return withNeo4jRetry('getFamilyMembers', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(p:Person)
          RETURN p
          ORDER BY p.name
          `,
          { familyId }
        );

        return result.records.map((r) => {
          const person = r.get('p').properties;
          return {
            ...person,
            birthDate: person.birthDate != null ? String(person.birthDate) : undefined,
            createdAt: toISODate(person.createdAt),
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async addFamilyRelationship(
    fromId: string,
    toId: string,
    relationship: 'PARENT_OF' | 'SPOUSE_OF' | 'SIBLING_OF'
  ): Promise<void> {
    await withNeo4jRetry('addFamilyRelationship', async () => {
      const session = getSession();
      try {
        await session.run(
          `
          MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
          MERGE (a)-[:${relationship}]->(b)
          `,
          { fromId, toId }
        );
      } finally {
        await session.close();
      }
    }, { fromId, toId, relationship });
  }

  // ============ STORIES ============

  async createStory(input: CreateStoryInput, summary: string, mood: string, topics: string[]): Promise<Story> {
    return withNeo4jRetry('createStory', async () => {
      const session = getSession();
      try {
        const storyId = uuid();
        const createResult = await session.run(
          `
          MATCH (author:Person {id: $authorId})
          CREATE (s:Story {
            id: $storyId,
            content: $content,
            summary: $summary,
            mood: $mood,
            topics: $topics,
            createdAt: datetime()
          })
          CREATE (author)-[:TOLD_STORY {date: datetime()}]->(s)
          RETURN s, author
          `,
          {
            storyId,
            authorId: input.authorId,
            content: input.content,
            summary,
            mood,
            topics,
          }
        );

        const story = createResult.records[0].get('s').properties;
        const author = createResult.records[0].get('author').properties;

        const allowedUsers = input.visibility?.type === 'specific'
          ? (input.visibility.allowedUsers || [])
          : [];

        if (allowedUsers.length > 0) {
          await session.run(
            `
            MATCH (s:Story {id: $storyId})
            UNWIND $allowedUsers as userId
            MATCH (p:Person)
            WHERE p.id = userId
            MERGE (s)-[:VISIBLE_TO]->(p)
            `,
            { storyId, allowedUsers }
          );
        }

        return {
          ...story,
          author: { id: author.id, name: author.name, avatar: author.avatar },
          mentions: [],
        };
      } finally {
        await session.close();
      }
    }, { authorId: input.authorId });
  }

  async addStoryMentions(storyId: string, personIds: string[]): Promise<void> {
    if (personIds.length === 0) return;

    await withNeo4jRetry('addStoryMentions', async () => {
      const session = getSession();
      try {
        await session.run(
          `
          MATCH (s:Story {id: $storyId})
          UNWIND $personIds as personId
          MATCH (p:Person {id: personId})
          MERGE (s)-[:MENTIONS]->(p)
          `,
          { storyId, personIds }
        );
      } finally {
        await session.close();
      }
    }, { storyId, mentionCount: personIds.length });
  }

  async getStories(familyId: string, userId: string, limit = 20, offset = 0): Promise<Story[]> {
    return withNeo4jRetry('getStories', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(author:Person)-[:TOLD_STORY]->(s:Story)
          WHERE NOT EXISTS((s)-[:HIDDEN_FROM]->(:Person {id: $userId}))
          AND (
            NOT EXISTS((s)-[:VISIBLE_TO]->())
            OR EXISTS((s)-[:VISIBLE_TO]->(:Person {id: $userId}))
          )
          OPTIONAL MATCH (s)-[:MENTIONS]->(mentioned:Person)
          RETURN s, author, collect(mentioned) as mentions
          ORDER BY s.createdAt DESC
          SKIP $offset
          LIMIT $limit
          `,
          { familyId, userId, limit: neo4j.int(limit), offset: neo4j.int(offset) }
        );

        return result.records.map((r) => {
          const story = r.get('s').properties;
          const author = r.get('author').properties;
          const mentions = r.get('mentions').map((m: any) =>
            m ? { id: m.properties.id, name: m.properties.name } : null
          ).filter(Boolean);

          return {
            ...story,
            createdAt: toISODate(story.createdAt),
            author: { id: author.id, name: author.name, avatar: author.avatar },
            mentions,
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId, limit, offset });
  }

  async countStories(familyId: string, userId: string): Promise<number> {
    return withNeo4jRetry('countStories', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(author:Person)-[:TOLD_STORY]->(s:Story)
          WHERE NOT EXISTS((s)-[:HIDDEN_FROM]->(:Person {id: $userId}))
          AND (
            NOT EXISTS((s)-[:VISIBLE_TO]->())
            OR EXISTS((s)-[:VISIBLE_TO]->(:Person {id: $userId}))
          )
          RETURN count(s) as total
          `,
          { familyId, userId }
        );

        return result.records[0].get('total').toNumber();
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async getStory(storyId: string, userId: string): Promise<Story | null> {
    return withNeo4jRetry('getStory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (author:Person)-[:TOLD_STORY]->(s:Story {id: $storyId})
          WHERE NOT EXISTS((s)-[:HIDDEN_FROM]->(:Person {id: $userId}))
          AND (
            NOT EXISTS((s)-[:VISIBLE_TO]->())
            OR EXISTS((s)-[:VISIBLE_TO]->(:Person {id: $userId}))
          )
          OPTIONAL MATCH (s)-[:MENTIONS]->(mentioned:Person)
          RETURN s, author, collect(mentioned) as mentions
          `,
          { storyId, userId }
        );

        if (result.records.length === 0) return null;

        const story = result.records[0].get('s').properties;
        const author = result.records[0].get('author').properties;
        const mentions = result.records[0].get('mentions').map((m: any) =>
          m ? { id: m.properties.id, name: m.properties.name } : null
        ).filter(Boolean);

        return {
          ...story,
          createdAt: toISODate(story.createdAt),
          author: { id: author.id, name: author.name, avatar: author.avatar },
          mentions,
        };
      } finally {
        await session.close();
      }
    }, { storyId });
  }

  async deleteStory(storyId: string, userId: string): Promise<boolean> {
    return withNeo4jRetry('deleteStory', async () => {
      const session = getSession();
      try {
        // Only allow author to delete
        const result = await session.run(
          `
          MATCH (author:Person {id: $userId})-[:TOLD_STORY]->(s:Story {id: $storyId})
          DETACH DELETE s
          RETURN count(s) as deleted
          `,
          { storyId, userId }
        );

        const deleted = result.records[0].get('deleted').toNumber();
        return deleted > 0;
      } finally {
        await session.close();
      }
    }, { storyId, userId });
  }

  async addReaction(storyId: string, userId: string, emoji: string): Promise<void> {
    await withNeo4jRetry('addReaction', async () => {
      const session = getSession();
      try {
        await session.run(
          `
          MATCH (p:Person {id: $userId}), (s:Story {id: $storyId})
          MERGE (p)-[r:REACTED_TO]->(s)
          SET r.emoji = $emoji, r.createdAt = datetime()
          `,
          { userId, storyId, emoji }
        );
      } finally {
        await session.close();
      }
    }, { storyId, userId, emoji });
  }

  async removeReaction(storyId: string, userId: string): Promise<void> {
    await withNeo4jRetry('removeReaction', async () => {
      const session = getSession();
      try {
        await session.run(
          `
          MATCH (p:Person {id: $userId})-[r:REACTED_TO]->(s:Story {id: $storyId})
          DELETE r
          `,
          { userId, storyId }
        );
      } finally {
        await session.close();
      }
    }, { storyId, userId });
  }

  async getReactions(storyId: string): Promise<{ userId: string; userName: string; emoji: string }[]> {
    return withNeo4jRetry('getReactions', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:Person)-[r:REACTED_TO]->(s:Story {id: $storyId})
          RETURN p.id as userId, p.name as userName, r.emoji as emoji
          `,
          { storyId }
        );

        return result.records.map((rec) => ({
          userId: rec.get('userId'),
          userName: rec.get('userName'),
          emoji: rec.get('emoji'),
        }));
      } finally {
        await session.close();
      }
    }, { storyId });
  }

  // ============ MEMORIES ============

  async createMemory(fact: string, aboutId: string, confidence: number, sourceId?: string): Promise<Memory> {
    return withNeo4jRetry('createMemory', async () => {
      const session = getSession();
      try {
        const memoryId = uuid();
        const result = await session.run(
          `
          MATCH (about:Person {id: $aboutId})
          CREATE (m:Memory {
            id: $memoryId,
            fact: $fact,
            confidence: $confidence,
            source: $sourceId,
            createdAt: datetime()
          })
          CREATE (m)-[:ABOUT]->(about)
          ${sourceId ? 'WITH m, about MATCH (s:Story {id: $sourceId}) CREATE (m)-[:EXTRACTED_FROM]->(s)' : ''}
          RETURN m, about
          `,
          { memoryId, fact, aboutId, confidence, sourceId }
        );

        const memory = result.records[0].get('m').properties;
        const about = result.records[0].get('about').properties;

        return {
          ...memory,
          about: { id: about.id, name: about.name },
        };
      } finally {
        await session.close();
      }
    }, { aboutId, sourceId });
  }

  async getMemories(familyId: string, aboutId?: string): Promise<Memory[]> {
    return withNeo4jRetry('getMemories', async () => {
      const session = getSession();
      try {
        const query = aboutId
          ? `
            MATCH (m:Memory)-[:ABOUT]->(about:Person {id: $aboutId})
            RETURN m, about
            ORDER BY m.confidence DESC
            `
          : `
            MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(about:Person)<-[:ABOUT]-(m:Memory)
            RETURN m, about
            ORDER BY m.createdAt DESC
            `;

        const result = await session.run(query, { familyId, aboutId });

        return result.records.map((r) => {
          const memory = r.get('m').properties;
          const about = r.get('about').properties;
          return {
            ...memory,
            about: { id: about.id, name: about.name },
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId, aboutId });
  }

  async getMemory(memoryId: string): Promise<(Memory & { familyId: string }) | null> {
    return withNeo4jRetry('getMemory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (m:Memory {id: $memoryId})-[:ABOUT]->(about:Person)-[:MEMBER_OF]->(f:Family)
          RETURN m, about, f.id as familyId
          `,
          { memoryId }
        );

        if (result.records.length === 0) return null;

        const memory = result.records[0].get('m').properties;
        const about = result.records[0].get('about').properties;
        const familyId = result.records[0].get('familyId');

        return {
          ...memory,
          about: { id: about.id, name: about.name },
          familyId,
        };
      } finally {
        await session.close();
      }
    }, { memoryId });
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    return withNeo4jRetry('deleteMemory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (m:Memory {id: $memoryId})
          DETACH DELETE m
          RETURN count(m) as deleted
          `,
          { memoryId }
        );

        const deleted = result.records[0].get('deleted').toNumber();
        return deleted > 0;
      } finally {
        await session.close();
      }
    }, { memoryId });
  }

  // ============ EVENTS ============

  async createEvent(input: any, familyId?: string): Promise<Event> {
    return withNeo4jRetry('createEvent', async () => {
      const session = getSession();
      try {
        const eventId = uuid();
        const createResult = await session.run(
          `
          CREATE (e:Event {
            id: $eventId,
            type: $type,
            title: $title,
            description: $description,
            date: date($date),
            familyId: $familyId,
            recurring: $recurring,
            reminderDays: $reminderDays,
            createdAt: datetime()
          })
          RETURN e
          `,
          {
            eventId,
            type: input.type,
            title: input.title,
            description: input.description || null,
            date: input.date,
            familyId: familyId || null,
            recurring: input.recurring || false,
            reminderDays: input.reminderDays || [7, 1, 0],
            involves: input.involves,
          }
        );

        const event = createResult.records[0].get('e').properties;
        const involves = Array.isArray(input.involves) ? input.involves : [];
        let people: any[] = [];

        if (involves.length > 0) {
          const relationResult = await session.run(
            `
            MATCH (e:Event {id: $eventId})
            UNWIND $involves as personId
            MATCH (p:Person)
            WHERE p.id = personId
            CREATE (e)-[:INVOLVES]->(p)
            WITH e, collect(DISTINCT p) as people
            RETURN people
            `,
            {
              eventId,
              involves,
            }
          );

          people = relationResult.records[0]?.get('people') ?? [];
        }

        return {
          ...event,
          date: event.date?.toString(),
          createdAt: toISODate(event.createdAt),
          involves: people.map((p: any) => ({ id: p.properties.id, name: p.properties.name })),
        };
      } finally {
        await session.close();
      }
    }, { type: input.type, title: input.title });
  }

  async getUpcomingEvents(familyId: string, days = 30): Promise<Event[]> {
    return withNeo4jRetry('getUpcomingEvents', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (e:Event {familyId: $familyId})
          OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
          WITH e, collect(DISTINCT p) as people
          RETURN e, people
          ORDER BY e.date
          `,
          { familyId, days: days.toString() }
        );

        const today = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        return result.records.map((r) => {
          const event = r.get('e').properties;
          const people = (r.get('people') || []).filter((p: any) => p);
          const eventDate = new Date(`${event.date.toString()}T00:00:00`);
          let nextDate = new Date(eventDate);

          if (event.recurring) {
            while (nextDate < today) {
              nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
          }

          if (nextDate < today || nextDate > endDate) {
            return null;
          }

          // Format in local time — toISOString() would shift the date across the UTC boundary
          const localDate = [
            nextDate.getFullYear(),
            String(nextDate.getMonth() + 1).padStart(2, '0'),
            String(nextDate.getDate()).padStart(2, '0'),
          ].join('-');

          return {
            ...event,
            date: localDate,
            createdAt: toISODate(event.createdAt),
            involves: people.map((p: any) => ({ id: p.properties.id, name: p.properties.name })),
          };
        }).filter(Boolean) as Event[];
      } finally {
        await session.close();
      }
    }, { familyId, days });
  }

  async getEvent(eventId: string): Promise<Event | null> {
    return withNeo4jRetry('getEvent', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (e:Event {id: $eventId})
          OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
          RETURN e, collect(p) as people
          `,
          { eventId }
        );

        if (result.records.length === 0) return null;

        const event = result.records[0].get('e').properties;
        const people = (result.records[0].get('people') || []).filter((p: any) => p);

        return {
          ...event,
          involves: people.map((p: any) => ({ id: p.properties.id, name: p.properties.name })),
        };
      } finally {
        await session.close();
      }
    }, { eventId });
  }

  async updateEvent(eventId: string, input: any): Promise<Event | null> {
    return withNeo4jRetry('updateEvent', async () => {
      const session = getSession();
      try {
        // Build dynamic SET clause
        const updates: string[] = [];
        const params: Record<string, any> = { eventId };

        if (input.type !== undefined) {
          updates.push('e.type = $type');
          params.type = input.type;
        }
        if (input.title !== undefined) {
          updates.push('e.title = $title');
          params.title = input.title;
        }
        if (input.description !== undefined) {
          updates.push('e.description = $description');
          params.description = input.description;
        }
        if (input.date !== undefined) {
          updates.push('e.date = date($date)');
          params.date = input.date;
        }
        if (input.recurring !== undefined) {
          updates.push('e.recurring = $recurring');
          params.recurring = input.recurring;
        }
        if (input.reminderDays !== undefined) {
          updates.push('e.reminderDays = $reminderDays');
          params.reminderDays = input.reminderDays;
        }

        if (updates.length === 0 && !input.involves) {
          return this.getEvent(eventId);
        }

        const setClause = updates.length > 0 ? `SET ${updates.join(', ')}` : '';

        // Update involves if provided
        if (input.involves) {
          params.involves = input.involves;
          const result = await session.run(
            `
            MATCH (e:Event {id: $eventId})
            ${setClause}
            WITH e
            OPTIONAL MATCH (e)-[r:INVOLVES]->()
            DELETE r
            WITH e
            UNWIND $involves as personId
            MATCH (p:Person)
            WHERE p.id = personId
            CREATE (e)-[:INVOLVES]->(p)
            WITH e, collect(DISTINCT p) as people
            RETURN e, people
            `,
            params
          );

          if (result.records.length === 0) return null;

          const event = result.records[0].get('e').properties;
          const people = (result.records[0].get('people') || []).filter((p: any) => p);

          return {
            ...event,
            involves: people.map((p: any) => ({ id: p.properties.id, name: p.properties.name })),
          };
        } else {
          const result = await session.run(
            `
            MATCH (e:Event {id: $eventId})
            ${setClause}
            WITH e
            OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
            RETURN e, collect(DISTINCT p) as people
            `,
            params
          );

          if (result.records.length === 0) return null;

          const event = result.records[0].get('e').properties;
          const people = result.records[0].get('people');

          return {
            ...event,
            involves: people.map((p: any) => ({ id: p.properties.id, name: p.properties.name })),
          };
        }
      } finally {
        await session.close();
      }
    }, { eventId });
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return withNeo4jRetry('deleteEvent', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (e:Event {id: $eventId})
          DETACH DELETE e
          RETURN count(e) as deleted
          `,
          { eventId }
        );

        const deleted = result.records[0].get('deleted').toNumber();
        return deleted > 0;
      } finally {
        await session.close();
      }
    }, { eventId });
  }

  // ============ EPISODIC MEMORY ============

  async createEpisodicMemory(input: CreateEpisodicInput & { emotionalValence: number; importance: number }): Promise<EpisodicMemory> {
    return withNeo4jRetry('createEpisodicMemory', async () => {
      const session = getSession();
      try {
        const episodeId = uuid();
        const result = await session.run(
          `
          CREATE (e:EpisodicMemory {
            id: $episodeId,
            familyId: $familyId,
            sessionId: $sessionId,
            eventType: $eventType,
            content: $content,
            summary: $summary,
            emotionalValence: $emotionalValence,
            importance: $importance,
            extractedFacts: $extractedFacts,
            accessCount: 0,
            consolidated: false,
            createdAt: datetime(),
            lastAccessed: datetime()
          })
          WITH e
          UNWIND $participants as personId
          OPTIONAL MATCH (p:Person {id: personId})
          FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END |
            CREATE (e)-[:INVOLVES]->(p)
          )
          RETURN e
          `,
          {
            episodeId,
            familyId: input.familyId,
            sessionId: input.sessionId,
            eventType: input.eventType,
            content: input.content,
            summary: input.summary || null,
            emotionalValence: input.emotionalValence,
            importance: input.importance,
            participants: input.participants || [],
            extractedFacts: input.extractedFacts || [],
          }
        );

        const episode = result.records[0].get('e').properties;
        return {
          ...episode,
          participants: input.participants || [],
          createdAt: new Date(episode.createdAt),
          lastAccessed: new Date(episode.lastAccessed),
        };
      } finally {
        await session.close();
      }
    }, { familyId: input.familyId });
  }

  async getEpisodicMemories(familyId: string, options: EpisodicQueryOptions = {}): Promise<EpisodicMemory[]> {
    return withNeo4jRetry('getEpisodicMemories', async () => {
      const session = getSession();
      try {
        const {
          limit = 20,
          offset = 0,
          unconsolidatedOnly = false,
          minImportance,
          eventType,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = options;

        const conditions = ['e.familyId = $familyId'];
        const params: Record<string, any> = { familyId, limit: neo4j.int(limit), offset: neo4j.int(offset) };

        if (unconsolidatedOnly) {
          conditions.push('e.consolidated = false');
        }
        if (options.consolidated !== undefined) {
          conditions.push(options.consolidated ? 'e.consolidated = true' : 'e.consolidated = false');
        }
        if (minImportance !== undefined) {
          conditions.push('e.importance >= $minImportance');
          params.minImportance = minImportance;
        }
        if (eventType) {
          conditions.push('e.eventType = $eventType');
          params.eventType = eventType;
        }

        const orderField = sortBy === 'importance' ? 'e.importance' :
                          sortBy === 'accessCount' ? 'e.accessCount' : 'e.createdAt';
        const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

        const result = await session.run(
          `
          MATCH (e:EpisodicMemory)
          WHERE ${conditions.join(' AND ')}
          OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
          WITH e, collect(p.id) as participants
          RETURN e, participants
          ORDER BY ${orderField} ${orderDir}
          SKIP $offset
          LIMIT $limit
          `,
          params
        );

        return result.records.map((r) => {
          const ep = normalizeProps(r.get('e').properties);
          return {
            ...ep,
            participants: r.get('participants').filter(Boolean),
            createdAt: new Date(ep.createdAt),
            lastAccessed: new Date(ep.lastAccessed),
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async accessEpisodicMemory(episodeId: string): Promise<void> {
    await withNeo4jRetry('accessEpisodicMemory', async () => {
      const session = getSession();
      try {
        await session.run(
          `
          MATCH (e:EpisodicMemory {id: $episodeId})
          SET e.accessCount = e.accessCount + 1,
              e.lastAccessed = datetime()
          `,
          { episodeId }
        );
      } finally {
        await session.close();
      }
    }, { episodeId });
  }

  async getConsolidationCandidates(familyId: string): Promise<EpisodicMemory[]> {
    return this.getEpisodicMemories(familyId, {
      unconsolidatedOnly: true,
      minImportance: 0.5,
      sortBy: 'importance',
      sortOrder: 'desc',
    });
  }

  // ============ SEMANTIC MEMORY ============

  async createSemanticMemory(input: CreateSemanticInput): Promise<SemanticMemory> {
    return withNeo4jRetry('createSemanticMemory', async () => {
      const session = getSession();
      try {
        const memoryId = uuid();
        const result = await session.run(
          `
          MATCH (about:Person {id: $aboutId})
          CREATE (m:SemanticMemory {
            id: $memoryId,
            familyId: $familyId,
            layer: 'semantic',
            factType: $factType,
            fact: $fact,
            aboutId: $aboutId,
            aboutName: $aboutName,
            confidence: $confidence,
            reinforcementCount: 1,
            decayFactor: 1.0,
            sourceEpisodes: $sourceEpisodes,
            createdAt: datetime(),
            updatedAt: datetime(),
            lastReinforced: datetime()
          })
          CREATE (m)-[:ABOUT]->(about)
          RETURN m
          `,
          {
            memoryId,
            familyId: input.familyId,
            factType: input.factType,
            fact: input.fact,
            aboutId: input.aboutId,
            aboutName: input.aboutName,
            confidence: input.confidence ?? 0.8,
            sourceEpisodes: input.sourceEpisodeId ? [input.sourceEpisodeId] : [],
          }
        );

        const memory = result.records[0].get('m').properties;
        return {
          ...memory,
          createdAt: new Date(memory.createdAt),
          updatedAt: new Date(memory.updatedAt),
          lastReinforced: new Date(memory.lastReinforced),
        };
      } finally {
        await session.close();
      }
    }, { familyId: input.familyId, aboutId: input.aboutId });
  }

  async getSemanticMemories(familyId: string, options: SemanticQueryOptions = {}): Promise<SemanticMemory[]> {
    return withNeo4jRetry('getSemanticMemories', async () => {
      const session = getSession();
      try {
        const {
          limit = 50,
          offset = 0,
          aboutId,
          factType,
          minConfidence,
          sortBy = 'confidence',
          sortOrder = 'desc',
        } = options;

        const conditions = ['m.familyId = $familyId'];
        const params: Record<string, any> = { familyId, limit: neo4j.int(limit), offset: neo4j.int(offset) };

        if (aboutId) {
          conditions.push('m.aboutId = $aboutId');
          params.aboutId = aboutId;
        }
        if (factType) {
          conditions.push('m.factType = $factType');
          params.factType = factType;
        }
        if (minConfidence !== undefined) {
          conditions.push('m.confidence >= $minConfidence');
          params.minConfidence = minConfidence;
        }

        const orderField = sortBy === 'reinforcementCount' ? 'm.reinforcementCount' :
                          sortBy === 'createdAt' ? 'm.createdAt' :
                          sortBy === 'decayFactor' ? 'm.decayFactor' : 'm.confidence';
        const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

        const result = await session.run(
          `
          MATCH (m:SemanticMemory)
          WHERE ${conditions.join(' AND ')}
          RETURN m
          ORDER BY ${orderField} ${orderDir}
          SKIP $offset
          LIMIT $limit
          `,
          params
        );

        return result.records.map((r) => {
          const mem = normalizeProps(r.get('m').properties);
          return {
            ...mem,
            createdAt: new Date(mem.createdAt),
            updatedAt: new Date(mem.updatedAt),
            lastReinforced: new Date(mem.lastReinforced),
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async findSimilarSemanticMemory(familyId: string, fact: string, aboutId: string): Promise<SemanticMemory | null> {
    return withNeo4jRetry('findSimilarSemanticMemory', async () => {
      const session = getSession();
      try {
        // Simple similarity: exact or near-exact match
        const result = await session.run(
          `
          MATCH (m:SemanticMemory {familyId: $familyId, aboutId: $aboutId})
          WHERE toLower(m.fact) = toLower($fact)
             OR m.fact CONTAINS $fact
             OR $fact CONTAINS m.fact
          RETURN m
          ORDER BY m.confidence DESC
          LIMIT 1
          `,
          { familyId, fact, aboutId }
        );

        if (result.records.length === 0) return null;

        const mem = result.records[0].get('m').properties;
        return {
          ...mem,
          createdAt: new Date(mem.createdAt),
          updatedAt: new Date(mem.updatedAt),
          lastReinforced: new Date(mem.lastReinforced),
        };
      } finally {
        await session.close();
      }
    }, { familyId, aboutId });
  }

  async reinforceSemanticMemory(memoryId: string): Promise<SemanticMemory | null> {
    return withNeo4jRetry('reinforceSemanticMemory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (m:SemanticMemory {id: $memoryId})
          SET m.reinforcementCount = m.reinforcementCount + 1,
              m.confidence = CASE WHEN m.confidence < 0.99 THEN m.confidence + 0.02 ELSE 0.99 END,
              m.decayFactor = 1.0,
              m.lastReinforced = datetime(),
              m.updatedAt = datetime()
          RETURN m
          `,
          { memoryId }
        );

        if (result.records.length === 0) return null;

        const mem = result.records[0].get('m').properties;
        return {
          ...mem,
          createdAt: new Date(mem.createdAt),
          updatedAt: new Date(mem.updatedAt),
          lastReinforced: new Date(mem.lastReinforced),
        };
      } finally {
        await session.close();
      }
    }, { memoryId });
  }

  async applyDecayToMemories(familyId: string, decayAmount: number): Promise<number> {
    return withNeo4jRetry('applyDecayToMemories', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (m:SemanticMemory {familyId: $familyId})
          WHERE m.decayFactor > 0.1
          SET m.decayFactor = m.decayFactor - $decayAmount,
              m.confidence = m.confidence * (1 - $decayAmount / 2),
              m.updatedAt = datetime()
          RETURN count(m) as decayed
          `,
          { familyId, decayAmount }
        );

        return result.records[0].get('decayed').toNumber();
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async updateSemanticMemory(memoryId: string, updates: Partial<SemanticMemory>): Promise<SemanticMemory | null> {
    return withNeo4jRetry('updateSemanticMemory', async () => {
      const session = getSession();
      try {
        const setClauses: string[] = ['m.updatedAt = datetime()'];
        const params: Record<string, any> = { memoryId };

        if (updates.decayFactor !== undefined) {
          setClauses.push('m.decayFactor = $decayFactor');
          params.decayFactor = updates.decayFactor;
        }
        if (updates.confidence !== undefined) {
          setClauses.push('m.confidence = $confidence');
          params.confidence = updates.confidence;
        }
        if (updates.fact !== undefined) {
          setClauses.push('m.fact = $fact');
          params.fact = updates.fact;
        }

        const result = await session.run(
          `
          MATCH (m:SemanticMemory {id: $memoryId})
          SET ${setClauses.join(', ')}
          RETURN m
          `,
          params
        );

        if (result.records.length === 0) return null;

        const mem = result.records[0].get('m').properties;
        return {
          ...mem,
          createdAt: new Date(mem.createdAt),
          updatedAt: new Date(mem.updatedAt),
          lastReinforced: new Date(mem.lastReinforced),
        };
      } finally {
        await session.close();
      }
    }, { memoryId });
  }

  async deleteSemanticMemory(memoryId: string): Promise<boolean> {
    return withNeo4jRetry('deleteSemanticMemory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (m:SemanticMemory {id: $memoryId})
          DETACH DELETE m
          RETURN count(m) as deleted
          `,
          { memoryId }
        );

        return result.records[0].get('deleted').toNumber() > 0;
      } finally {
        await session.close();
      }
    }, { memoryId });
  }

  async updateEpisodicMemory(episodeId: string, updates: Partial<EpisodicMemory>): Promise<EpisodicMemory | null> {
    return withNeo4jRetry('updateEpisodicMemory', async () => {
      const session = getSession();
      try {
        const setClauses: string[] = [];
        const params: Record<string, any> = { episodeId };

        if (updates.summary !== undefined) {
          setClauses.push('e.summary = $summary');
          params.summary = updates.summary;
        }
        if (updates.consolidated !== undefined) {
          setClauses.push('e.consolidated = $consolidated');
          params.consolidated = updates.consolidated;
          if (updates.consolidated) {
            setClauses.push('e.consolidatedAt = datetime()');
          }
        }
        if (updates.importance !== undefined) {
          setClauses.push('e.importance = $importance');
          params.importance = updates.importance;
        }

        if (setClauses.length === 0) return null;

        const result = await session.run(
          `
          MATCH (e:EpisodicMemory {id: $episodeId})
          SET ${setClauses.join(', ')}
          RETURN e
          `,
          params
        );

        if (result.records.length === 0) return null;

        const ep = result.records[0].get('e').properties;
        return {
          ...ep,
          createdAt: new Date(ep.createdAt),
          lastAccessed: new Date(ep.lastAccessed),
          consolidatedAt: ep.consolidatedAt ? new Date(ep.consolidatedAt) : undefined,
        };
      } finally {
        await session.close();
      }
    }, { episodeId });
  }

  async deleteEpisodicMemory(episodeId: string): Promise<boolean> {
    return withNeo4jRetry('deleteEpisodicMemory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (e:EpisodicMemory {id: $episodeId})
          DETACH DELETE e
          RETURN count(e) as deleted
          `,
          { episodeId }
        );

        return result.records[0].get('deleted').toNumber() > 0;
      } finally {
        await session.close();
      }
    }, { episodeId });
  }

  // ============ PROCEDURAL MEMORY ============

  async createProceduralMemory(input: CreateProceduralInput): Promise<ProceduralMemory> {
    return withNeo4jRetry('createProceduralMemory', async () => {
      const session = getSession();
      try {
        const patternId = uuid();
        const result = await session.run(
          `
          CREATE (p:ProceduralMemory {
            id: $patternId,
            familyId: $familyId,
            patternType: $patternType,
            name: $name,
            description: $description,
            trigger: $trigger,
            action: $action,
            frequency: 1,
            confidence: 0.6,
            examples: $examples,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          WITH p
          UNWIND $appliesToIds as personId
          OPTIONAL MATCH (person:Person {id: personId})
          FOREACH (_ IN CASE WHEN person IS NOT NULL THEN [1] ELSE [] END |
            CREATE (p)-[:APPLIES_TO]->(person)
          )
          RETURN p
          `,
          {
            patternId,
            familyId: input.familyId,
            patternType: input.patternType,
            name: input.name,
            description: input.description,
            trigger: input.trigger,
            action: input.action,
            appliesToIds: input.appliesToIds || [],
            examples: input.exampleEpisodeId ? [input.exampleEpisodeId] : [],
          }
        );

        const pattern = result.records[0].get('p').properties;
        return {
          ...pattern,
          appliesToIds: input.appliesToIds || [],
          createdAt: new Date(pattern.createdAt),
          updatedAt: new Date(pattern.updatedAt),
        };
      } finally {
        await session.close();
      }
    }, { familyId: input.familyId });
  }

  async getProceduralMemories(familyId: string): Promise<ProceduralMemory[]> {
    return withNeo4jRetry('getProceduralMemories', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:ProceduralMemory {familyId: $familyId})
          OPTIONAL MATCH (p)-[:APPLIES_TO]->(person:Person)
          WITH p, collect(person.id) as appliesToIds
          RETURN p, appliesToIds
          ORDER BY p.confidence DESC
          `,
          { familyId }
        );

        return result.records.map((r) => {
          const pattern = r.get('p').properties;
          return {
            ...normalizeProps(pattern),
            appliesToIds: r.get('appliesToIds').filter(Boolean),
            createdAt: new Date(pattern.createdAt),
            updatedAt: new Date(pattern.updatedAt),
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async findSimilarProceduralMemory(familyId: string, trigger: string): Promise<ProceduralMemory | null> {
    return withNeo4jRetry('findSimilarProceduralMemory', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:ProceduralMemory {familyId: $familyId})
          WHERE toLower(p.trigger) = toLower($trigger)
             OR p.trigger CONTAINS $trigger
          OPTIONAL MATCH (p)-[:APPLIES_TO]->(person:Person)
          WITH p, collect(person.id) as appliesToIds
          RETURN p, appliesToIds
          LIMIT 1
          `,
          { familyId, trigger }
        );

        if (result.records.length === 0) return null;

        const pattern = result.records[0].get('p').properties;
        return {
          ...pattern,
          appliesToIds: result.records[0].get('appliesToIds').filter(Boolean),
          createdAt: new Date(pattern.createdAt),
          updatedAt: new Date(pattern.updatedAt),
        };
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  async reinforceProceduralMemory(patternId: string): Promise<void> {
    await withNeo4jRetry('reinforceProceduralMemory', async () => {
      const session = getSession();
      try {
        await session.run(
          `
          MATCH (p:ProceduralMemory {id: $patternId})
          SET p.frequency = p.frequency + 1,
              p.confidence = CASE WHEN p.confidence < 0.95 THEN p.confidence + 0.05 ELSE 0.95 END,
              p.updatedAt = datetime()
          `,
          { patternId }
        );
      } finally {
        await session.close();
      }
    }, { patternId });
  }

  // ============ MEMORY ACTIVITY LOGGING ============

  async logMemoryActivity(input: CreateActivityInput): Promise<MemoryActivity> {
    return withNeo4jRetry('logMemoryActivity', async () => {
      const session = getSession();
      try {
        const activityId = uuid();
        const result = await session.run(
          `
          CREATE (a:MemoryActivity {
            id: $activityId,
            familyId: $familyId,
            type: $type,
            description: $description,
            fromLayer: $fromLayer,
            toLayer: $toLayer,
            memoryId: $memoryId,
            memoryFact: $memoryFact,
            confidence: $confidence,
            timestamp: datetime()
          })
          RETURN a
          `,
          {
            activityId,
            familyId: input.familyId,
            type: input.type,
            description: input.description,
            fromLayer: input.fromLayer || null,
            toLayer: input.toLayer || null,
            memoryId: input.memoryId || null,
            memoryFact: input.memoryFact || null,
            confidence: input.confidence || null,
          }
        );

        const activity = result.records[0].get('a').properties;
        return {
          ...activity,
          timestamp: new Date(activity.timestamp),
        };
      } finally {
        await session.close();
      }
    }, { familyId: input.familyId });
  }

  async getMemoryActivity(familyId: string, limit: number = 20): Promise<MemoryActivity[]> {
    return withNeo4jRetry('getMemoryActivity', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (a:MemoryActivity {familyId: $familyId})
          RETURN a
          ORDER BY a.timestamp DESC
          LIMIT $limit
          `,
          { familyId, limit: neo4j.int(limit) }
        );

        return result.records.map((r) => {
          const activity = normalizeProps(r.get('a').properties);
          return {
            ...activity,
            timestamp: new Date(activity.timestamp),
          };
        });
      } finally {
        await session.close();
      }
    }, { familyId, limit });
  }

  // ============ MEMORY STATISTICS ============

  async getMemoryStats(familyId: string): Promise<{
    episodic: EpisodicMemoryStats;
    semantic: SemanticMemoryStats;
    procedural: ProceduralMemoryStats;
  }> {
    return withNeo4jRetry('getMemoryStats', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          OPTIONAL MATCH (ep:EpisodicMemory {familyId: $familyId})
          WITH count(ep) as epCount,
               sum(CASE WHEN ep.consolidated = false THEN 1 ELSE 0 END) as epUnconsolidated,
               avg(ep.importance) as epAvgImportance

          OPTIONAL MATCH (sm:SemanticMemory {familyId: $familyId})
          WITH epCount, epUnconsolidated, epAvgImportance,
               count(sm) as smCount,
               avg(sm.confidence) as smAvgConfidence,
               sum(sm.reinforcementCount) as smTotalReinforcements

          OPTIONAL MATCH (pm:ProceduralMemory {familyId: $familyId})
          RETURN epCount, epUnconsolidated, epAvgImportance,
                 smCount, smAvgConfidence, smTotalReinforcements,
                 count(pm) as pmCount, avg(pm.confidence) as pmAvgConfidence
          `,
          { familyId }
        );

        if (result.records.length === 0) {
          return {
            episodic: { count: 0, unconsolidated: 0, avgImportance: 0 },
            semantic: { count: 0, avgConfidence: 0, totalReinforcements: 0 },
            procedural: { count: 0, avgConfidence: 0 },
          };
        }
        const record = result.records[0];

        return {
          episodic: {
            count: record.get('epCount')?.toNumber?.() || record.get('epCount') || 0,
            unconsolidated: record.get('epUnconsolidated')?.toNumber?.() || record.get('epUnconsolidated') || 0,
            avgImportance: record.get('epAvgImportance') || 0,
          },
          semantic: {
            count: record.get('smCount')?.toNumber?.() || record.get('smCount') || 0,
            avgConfidence: record.get('smAvgConfidence') || 0,
            totalReinforcements: record.get('smTotalReinforcements')?.toNumber?.() || record.get('smTotalReinforcements') || 0,
          },
          procedural: {
            count: record.get('pmCount')?.toNumber?.() || record.get('pmCount') || 0,
            avgConfidence: record.get('pmAvgConfidence') || 0,
          },
        };
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  // ============ PLACEHOLDER MEMBERS & INVITES ============

  async createPlaceholderMember(data: {
    name: string;
    nickname?: string;
    birthDate?: string;
    isDeceased?: boolean;
    familyId: string;
    inviteEmail?: string;
    addedById?: string;
  }): Promise<Person> {
    return withNeo4jRetry('createPlaceholderMember', async () => {
      const session = getSession();
      try {
        const personId = randomUUID();
        const result = await session.run(
          `
          MATCH (f:Family {id: $familyId})
          CREATE (p:Person {
            id: $personId,
            name: $name,
            nickname: $nickname,
            birthDate: $birthDate,
            isDeceased: $isDeceased,
            isRegistered: false,
            inviteEmail: $inviteEmail,
            addedById: $addedById,
            createdAt: datetime()
          })
          CREATE (p)-[:MEMBER_OF]->(f)
          RETURN p
          `,
          {
            personId,
            familyId: data.familyId,
            name: data.name,
            nickname: data.nickname || null,
            birthDate: data.birthDate || null,
            isDeceased: data.isDeceased || false,
            inviteEmail: data.inviteEmail || null,
            addedById: data.addedById || null,
          }
        );

        return result.records[0].get('p').properties;
      } finally {
        await session.close();
      }
    }, { familyId: data.familyId });
  }

  async createFamilyInvite(data: {
    email: string;
    familyId: string;
    placeholderId: string;
    inviterId: string;
  }): Promise<{ id: string; token: string }> {
    return withNeo4jRetry('createFamilyInvite', async () => {
      const session = getSession();
      try {
        const id = randomUUID();
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await session.run(
          `
          CREATE (i:FamilyInvite {
            id: $id,
            token: $token,
            email: $email,
            familyId: $familyId,
            placeholderId: $placeholderId,
            inviterId: $inviterId,
            status: 'pending',
            expiresAt: $expiresAt,
            createdAt: datetime()
          })
          `,
          { id, token, ...data, expiresAt }
        );

        return { id, token };
      } finally {
        await session.close();
      }
    }, { familyId: data.familyId });
  }

  async getPendingInvitesByEmail(email: string): Promise<Array<{
    inviteId: string;
    inviteToken: string;
    familyId: string;
    familyName: string;
    inviterId: string;
    inviterName: string;
    placeholderId: string;
  }>> {
    return withNeo4jRetry('getPendingInvitesByEmail', async () => {
      const session = getSession();
      try {
        const now = new Date().toISOString();
        const result = await session.run(
          `
          MATCH (i:FamilyInvite {email: $email, status: 'pending'})
          WHERE i.expiresAt > $now
          MATCH (f:Family {id: i.familyId})
          MATCH (inviter:Person {id: i.inviterId})
          RETURN i, f.name as familyName, inviter.name as inviterName
          `,
          { email, now }
        );

        return result.records.map((r) => {
          const inv = r.get('i').properties;
          return {
            inviteId: inv.id,
            inviteToken: inv.token,
            familyId: inv.familyId,
            familyName: r.get('familyName'),
            inviterId: inv.inviterId,
            inviterName: r.get('inviterName'),
            placeholderId: inv.placeholderId,
          };
        });
      } finally {
        await session.close();
      }
    });
  }

  async getInviteByToken(token: string): Promise<(FamilyInvite & { familyName: string; inviterName: string }) | null> {
    return withNeo4jRetry('getInviteByToken', async () => {
      const session = getSession();
      try {
        const now = new Date().toISOString();
        const result = await session.run(
          `
          MATCH (i:FamilyInvite {token: $token, status: 'pending'})
          WHERE i.expiresAt > $now
          MATCH (f:Family {id: i.familyId})
          MATCH (inviter:Person {id: i.inviterId})
          RETURN i, f.name as familyName, inviter.name as inviterName
          `,
          { token, now }
        );

        if (result.records.length === 0) return null;

        const inv = result.records[0].get('i').properties;
        return {
          ...inv,
          familyName: result.records[0].get('familyName'),
          inviterName: result.records[0].get('inviterName'),
        };
      } finally {
        await session.close();
      }
    });
  }

  async claimPlaceholder(placeholderId: string, realUserId: string): Promise<void> {
    await withNeo4jRetry('claimPlaceholder', async () => {
      const session = getSession();
      try {
        // Transfer MEMBER_OF
        await session.run(
          `
          MATCH (p:Person {id: $pid})-[:MEMBER_OF]->(f:Family)
          MATCH (r:Person {id: $rid})
          MERGE (r)-[:MEMBER_OF]->(f)
          `,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer incoming PARENT_OF
        await session.run(
          `MATCH (o:Person)-[:PARENT_OF]->(p:Person {id: $pid})
           MATCH (r:Person {id: $rid})
           MERGE (o)-[:PARENT_OF]->(r)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer outgoing PARENT_OF
        await session.run(
          `MATCH (p:Person {id: $pid})-[:PARENT_OF]->(o:Person)
           MATCH (r:Person {id: $rid})
           MERGE (r)-[:PARENT_OF]->(o)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer incoming SPOUSE_OF
        await session.run(
          `MATCH (o:Person)-[:SPOUSE_OF]->(p:Person {id: $pid})
           MATCH (r:Person {id: $rid})
           MERGE (o)-[:SPOUSE_OF]->(r)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer outgoing SPOUSE_OF
        await session.run(
          `MATCH (p:Person {id: $pid})-[:SPOUSE_OF]->(o:Person)
           MATCH (r:Person {id: $rid})
           MERGE (r)-[:SPOUSE_OF]->(o)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer incoming SIBLING_OF
        await session.run(
          `MATCH (o:Person)-[:SIBLING_OF]->(p:Person {id: $pid})
           MATCH (r:Person {id: $rid})
           MERGE (o)-[:SIBLING_OF]->(r)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer outgoing SIBLING_OF
        await session.run(
          `MATCH (p:Person {id: $pid})-[:SIBLING_OF]->(o:Person)
           MATCH (r:Person {id: $rid})
           MERGE (r)-[:SIBLING_OF]->(o)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Transfer MENTIONS in stories
        await session.run(
          `MATCH (s:Story)-[:MENTIONS]->(p:Person {id: $pid})
           MATCH (r:Person {id: $rid})
           MERGE (s)-[:MENTIONS]->(r)`,
          { pid: placeholderId, rid: realUserId }
        );

        // Mark all pending invites for this placeholder as accepted
        await session.run(
          `MATCH (i:FamilyInvite {placeholderId: $pid, status: 'pending'})
           SET i.status = 'accepted'`,
          { pid: placeholderId }
        );

        // Delete placeholder
        await session.run(
          `MATCH (p:Person {id: $pid}) DETACH DELETE p`,
          { pid: placeholderId }
        );
      } finally {
        await session.close();
      }
    }, { placeholderId, realUserId });
  }

  async declineFamilyInvite(inviteId: string, placeholderId: string): Promise<{ addedById: string | null }> {
    return withNeo4jRetry('declineFamilyInvite', async () => {
      const session = getSession();
      try {
        // Mark invite as declined
        await session.run(
          `MATCH (i:FamilyInvite {id: $inviteId}) SET i.status = 'declined'`,
          { inviteId }
        );

        // Clear inviteEmail from placeholder and get addedById for WS notification
        const result = await session.run(
          `MATCH (p:Person {id: $pid})
           SET p.inviteEmail = null
           RETURN p.addedById as addedById`,
          { pid: placeholderId }
        );

        const addedById = result.records.length > 0 ? result.records[0].get('addedById') : null;
        return { addedById };
      } finally {
        await session.close();
      }
    }, { inviteId, placeholderId });
  }

  async resendFamilyInvite(data: {
    placeholderId: string;
    email: string;
    inviterId: string;
    familyId: string;
  }): Promise<{ id: string; token: string }> {
    await withNeo4jRetry('resendFamilyInvite', async () => {
      const session = getSession();
      try {
        // Expire existing active invites for this placeholder
        await session.run(
          `MATCH (i:FamilyInvite {placeholderId: $pid, status: 'pending'})
           SET i.status = 'expired'`,
          { pid: data.placeholderId }
        );
      } finally {
        await session.close();
      }
    }, { placeholderId: data.placeholderId });

    return this.createFamilyInvite(data);
  }

  // ==================== Photos (Photo Room) ====================

  async createPhoto(data: {
    familyId: string;
    uploadedBy: string;
    filename: string;
    caption?: string;
    note?: string;
    taggedMemberIds?: string[];
  }): Promise<any> {
    return withNeo4jRetry('createPhoto', async () => {
      const session = getSession();
      try {
        const photoId = uuid();
        const tagged = (data.taggedMemberIds || []).filter(Boolean);
        const result = await session.run(
          `
          CREATE (ph:Photo {
            id: $photoId,
            familyId: $familyId,
            uploadedBy: $uploadedBy,
            filename: $filename,
            caption: $caption,
            note: $note,
            createdAt: datetime()
          })
          WITH ph
          // Tag the people who appear in this photo
          UNWIND $tagged as personId
          MATCH (p:Person {id: personId})
          MERGE (ph)-[:TAGS]->(p)
          WITH ph, collect({ id: p.id, name: p.name }) as taggedMembers
          RETURN ph, taggedMembers
          `,
          {
            photoId,
            familyId: data.familyId,
            uploadedBy: data.uploadedBy,
            filename: data.filename,
            caption: data.caption ?? null,
            note: data.note ?? null,
            tagged,
          }
        );

        // UNWIND over an empty list yields no rows, so re-fetch the bare photo
        if (result.records.length === 0) {
          const bare = await session.run(`MATCH (ph:Photo {id: $photoId}) RETURN ph`, { photoId });
          return { ...normalizeProps(bare.records[0].get('ph').properties), taggedMembers: [] };
        }

        const photo = normalizeProps(result.records[0].get('ph').properties);
        return { ...photo, taggedMembers: result.records[0].get('taggedMembers') };
      } finally {
        await session.close();
      }
    }, { familyId: data.familyId, uploadedBy: data.uploadedBy });
  }

  async getPhotos(familyId: string): Promise<any[]> {
    return withNeo4jRetry('getPhotos', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (ph:Photo {familyId: $familyId})
          OPTIONAL MATCH (ph)-[:TAGS]->(p:Person)
          WITH ph, collect(CASE WHEN p IS NULL THEN null ELSE { id: p.id, name: p.name } END) as tagged
          RETURN ph, [t IN tagged WHERE t IS NOT NULL] as taggedMembers
          ORDER BY ph.createdAt DESC
          `,
          { familyId }
        );

        return result.records.map((r) => ({
          ...normalizeProps(r.get('ph').properties),
          taggedMembers: r.get('taggedMembers'),
        }));
      } finally {
        await session.close();
      }
    }, { familyId });
  }

  /**
   * Find family photos relevant to a free-text query by matching the query's
   * words against each photo's caption, note, and tagged member names.
   * Returns the best-scoring photos (with a /uploads url) for chat to show.
   */
  async searchPhotos(familyId: string, query: string, limit = 3): Promise<any[]> {
    const photos = await this.getPhotos(familyId);
    const terms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (terms.length === 0) return [];

    const scored = photos
      .map((p: any) => {
        const haystack = [
          p.caption || '',
          p.note || '',
          ...(p.taggedMembers || []).map((m: any) => m.name),
        ]
          .join(' ')
          .toLowerCase();
        const score = terms.reduce((s, t) => (haystack.includes(t) ? s + 1 : s), 0);
        return { photo: p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((x: any) => ({
      id: x.photo.id,
      url: `/uploads/${x.photo.filename}`,
      caption: x.photo.caption ?? null,
      note: x.photo.note ?? null,
      taggedMembers: x.photo.taggedMembers ?? [],
      createdAt: x.photo.createdAt,
    }));
  }

  /**
   * Delete a photo node (uploader-only). Returns the stored filename so the
   * caller can remove the file from disk, or null if not found / not owner.
   */
  async deletePhoto(photoId: string, userId: string): Promise<string | null> {
    return withNeo4jRetry('deletePhoto', async () => {
      const session = getSession();
      try {
        const result = await session.run(
          `
          MATCH (ph:Photo {id: $photoId, uploadedBy: $userId})
          WITH ph, ph.filename as filename
          DETACH DELETE ph
          RETURN filename
          `,
          { photoId, userId }
        );

        if (result.records.length === 0) return null;
        return result.records[0].get('filename') as string;
      } finally {
        await session.close();
      }
    }, { photoId, userId });
  }
}

export const graphService = new GraphService();
