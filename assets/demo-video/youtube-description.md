# YouTube upload pack — RememberKin demo video

## Title
RememberKin | A Family Memory Agent Built on Qwen Cloud (MemoryAgent Track Demo)

## Description

RememberKin is a family memory agent built entirely on Qwen Cloud for the Global AI Hackathon Series with Qwen (Track 1: MemoryAgent).

Tell it something once: a birthday, a recipe, a story. It extracts the fact, scores how meaningful it is, and consolidates it from short-term working memory into permanent long-term memory. Log out, come back as a different family member, and it still remembers, fusing profiles, events, and photos into one answer.

Built for the track's core themes:
- Efficient memory storage and retrieval: Neo4j knowledge graph + Qdrant vector search, hybrid recall
- Timely forgetting of outdated information: confidence decay and pruning of weak memories
- Recalling critical memories within limited context windows: only the relevant facts are selected per message

Chapters:
0:00 What RememberKin is
0:30 Log in as a family member
0:40 Tell it a fact once
0:52 Extract, score, consolidate: the 4-layer cognitive memory (Working, Episodic, Semantic, Procedural)
1:08 The real test: log out, come back as someone else, and it still recalls
1:24 Memory of photos: the real family photo appears right in the conversation
1:42 Under the hood: Neo4j, Qdrant, MCP server, live spend cap, self-evaluation harness
2:02 Close

Tech stack:
- Qwen models via DashScope (Alibaba Cloud Model Studio): qwen-plus for chat and reasoning, qwen-turbo for fact extraction, text-embedding-v3 for embeddings, qwen-image for portraits
- 4-layer cognitive memory engine: importance scoring, consolidation jobs, confidence decay, reinforcement
- Neo4j + Qdrant hybrid retrieval, an MCP server exposing memory as tools, live cost tracking with a spending cap, and a self-evaluation harness
- React + TypeScript frontend, Node.js + Express backend, deployed on Alibaba Cloud

Open source (MIT), built entirely during the hackathon submission period:
https://github.com/minkhant1996/RememberKin-QWEN

The family in this demo is fictional and its photos are AI-generated for the demo.

#Qwen #QwenCloud #AIAgent #MemoryAgent #Neo4j #Qdrant #MCP

## Tags (comma list for the tag field)
qwen, qwen cloud, alibaba cloud, ai agent, memory agent, persistent memory, neo4j, qdrant, mcp server, dashscope, family memory, hackathon demo, ai memory system

## Notes
- Judge login credentials belong in the Devpost testing instructions, NOT in this public description.
- Add the video link to README.md and the Devpost form after upload (SUBMISSION.md checklist).
