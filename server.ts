import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface DraftRequestBody {
  title?: string;
  category?: 'contract' | 'report';
  templateName?: string;
  tone?: string;
  jurisdiction?: string;
  brief?: string;
  metadata?: Record<string, string | undefined>;
  sections?: Array<{ id: string; title: string; guidance: string }>;
}

interface RefineRequestBody {
  documentTitle?: string;
  category?: 'contract' | 'report';
  tone?: string;
  sectionHeading?: string;
  sectionBody?: string;
  instruction?: string;
}

interface AuditRequestBody {
  documentTitle?: string;
  category?: 'contract' | 'report';
  jurisdiction?: string;
  sections?: Array<{ heading: string; body: string }>;
}

interface RoomMember {
  ws: WebSocket;
  clientId: string;
  uid: string;
  name: string;
  color: string;
  activeSectionId: string | null;
  isTyping: boolean;
  updatedAt: number;
}

const rooms = new Map<string, Map<string, RoomMember>>();

function broadcastRoomPresence(docId: string) {
  const room = rooms.get(docId);
  if (!room) return;
  const members = Array.from(room.values()).map((m) => ({
    clientId: m.clientId,
    uid: m.uid,
    name: m.name,
    color: m.color,
    activeSectionId: m.activeSectionId,
    isTyping: m.isTyping,
    updatedAt: m.updatedAt,
  }));
  const payload = JSON.stringify({ type: 'presence:state', docId, members });
  for (const member of room.values()) {
    if (member.ws.readyState === WebSocket.OPEN) {
      member.ws.send(payload);
    }
  }
}

function broadcastRoomEvent(docId: string, senderClientId: string, data: unknown) {
  const room = rooms.get(docId);
  if (!room) return;
  const payload = JSON.stringify(data);
  for (const member of room.values()) {
    if (member.clientId !== senderClientId && member.ws.readyState === WebSocket.OPEN) {
      member.ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/documents/draft', async (req, res) => {
    try {
      const body = req.body as DraftRequestBody;
      const category = body.category === 'report' ? 'report' : 'contract';
      const templateName = (body.templateName || 'Custom Blueprint').slice(0, 140);
      const tone = (body.tone || 'formal_legal').slice(0, 60);
      const jurisdiction = (body.jurisdiction || 'Delaware, United States').slice(0, 120);
      const brief = (body.brief || '').trim().slice(0, 4000);
      const rawTitle = (body.title || '').trim().slice(0, 200);
      const sectionSpecs = Array.isArray(body.sections) ? body.sections.slice(0, 20) : [];
      const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

      if (!brief && sectionSpecs.length === 0) {
        return res.status(400).json({ error: 'Please provide a drafting brief or template sections.' });
      }

      const ai = createGeminiClient();
      const systemInstruction =
        category === 'contract'
          ? 'You are a senior corporate counsel drafting authoritative, enforceable commercial agreements. Write thorough, unambiguous, well-structured clauses with concrete defined terms, obligations, timelines, and remedies. Avoid placeholder brackets where concrete details are provided in the metadata or brief; only use clear [BRACKETED PLACEHOLDERS] for genuinely missing operational details. Format body text as clean multi-paragraph prose without markdown asterisks.'
          : 'You are a managing director and strategy partner authoring executive business reports and board memoranda. Write clear, data-grounded analytical prose with crisp subsection structure, actionable recommendations, risk assessments, and structured findings. Avoid markdown asterisks; use clean paragraphs and numbered or bulleted lines where appropriate.';

      const metadataLines = Object.entries(metadata)
        .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

      const outlineLines = sectionSpecs
        .map((s, idx) => `${idx + 1}. ${s.title}${s.guidance ? ` — Guidance: ${s.guidance}` : ''}`)
        .join('\n');

      const prompt = [
        `Document Type: ${category === 'contract' ? 'Legal Contract' : 'Business Report'}`,
        `Template Blueprint: ${templateName}`,
        `Requested Title: ${rawTitle || 'Generate an appropriate formal title'}`,
        `Tone: ${tone}`,
        category === 'contract' ? `Governing Jurisdiction: ${jurisdiction}` : `Audience / Scope: ${jurisdiction}`,
        metadataLines ? `Key Parameters:\n${metadataLines}` : '',
        outlineLines ? `Required Section Structure:\n${outlineLines}` : '',
        `Drafting Brief & Context:\n${brief || 'Follow standard best practices for this template.'}`,
        '',
        'Generate the complete document with well-developed, substantive content for each section.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Formal title of the generated document.',
              },
              changeSummary: {
                type: Type.STRING,
                description: 'Concise 1-sentence version summary describing the initial draft.',
              },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    body: { type: Type.STRING },
                  },
                  required: ['heading', 'body'],
                },
              },
            },
            required: ['title', 'changeSummary', 'sections'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        return res.status(502).json({ error: 'Model returned an empty response.' });
      }
      const parsed = JSON.parse(rawText) as {
        title: string;
        changeSummary: string;
        sections: Array<{ heading: string; body: string }>;
      };

      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate document draft.';
      console.error('Draft generation error:', error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/documents/refine-section', async (req, res) => {
    try {
      const body = req.body as RefineRequestBody;
      const instruction = (body.instruction || '').trim().slice(0, 1500);
      const sectionHeading = (body.sectionHeading || '').trim().slice(0, 200);
      const sectionBody = (body.sectionBody || '').trim().slice(0, 15000);
      const documentTitle = (body.documentTitle || 'Untitled Document').slice(0, 200);
      const category = body.category === 'report' ? 'report' : 'contract';
      const tone = (body.tone || 'formal_legal').slice(0, 60);

      if (!instruction) {
        return res.status(400).json({ error: 'Refinement instruction is required.' });
      }

      const ai = createGeminiClient();
      const prompt = [
        `Document: ${documentTitle} (${category})`,
        `Target Tone: ${tone}`,
        `Current Section Heading: ${sectionHeading}`,
        `Current Section Content:\n${sectionBody}`,
        `Requested Revision:\n${instruction}`,
        'Return the revised section heading, revised prose body (clean paragraphs without markdown asterisks), and a brief 1-sentence changeSummary.',
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior legal and executive editor refining a specific section of a professional document. Preserve factual parameters and defined terms while executing the requested revision cleanly.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING },
              body: { type: Type.STRING },
              changeSummary: { type: Type.STRING },
            },
            required: ['heading', 'body', 'changeSummary'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        return res.status(502).json({ error: 'Model returned an empty response.' });
      }
      res.json(JSON.parse(rawText));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refine section.';
      console.error('Refine section error:', error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/documents/audit', async (req, res) => {
    try {
      const body = req.body as AuditRequestBody;
      const sections = Array.isArray(body.sections) ? body.sections.slice(0, 30) : [];
      const category = body.category === 'report' ? 'report' : 'contract';
      const documentTitle = (body.documentTitle || 'Untitled Document').slice(0, 200);
      const jurisdiction = (body.jurisdiction || 'General').slice(0, 120);

      if (sections.length === 0) {
        return res.status(400).json({ error: 'Document has no sections to review.' });
      }

      const ai = createGeminiClient();
      const compiled = sections
        .map((s, i) => `Section ${i + 1}: ${s.heading}\n${s.body}`)
        .join('\n\n---\n\n')
        .slice(0, 24000);

      const prompt = [
        `Review the following ${category === 'contract' ? 'contract' : 'business report'} titled "${documentTitle}" (Context: ${jurisdiction}).`,
        'Identify up to 5 concrete legal, structural, ambiguity, or completeness findings with actionable recommendations.',
        '',
        compiled,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            category === 'contract'
              ? 'You are a meticulous commercial contracts reviewer. Identify missing protections, ambiguous obligations, undefined terms, or liability gaps.'
              : 'You are an executive audit reviewer. Identify unsupported claims, missing financial/operational context, unclear recommendations, or structural gaps.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                    sectionHeading: { type: Type.STRING },
                    issue: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                  },
                  required: ['severity', 'sectionHeading', 'issue', 'recommendation'],
                },
              },
            },
            required: ['summary', 'findings'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        return res.status(502).json({ error: 'Model returned an empty response.' });
      }
      res.json(JSON.parse(rawText));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to review document.';
      console.error('Audit error:', error);
      res.status(500).json({ error: message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentDocId: string | null = null;
    let currentClientId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          docId?: string;
          clientId?: string;
          uid?: string;
          name?: string;
          color?: string;
          activeSectionId?: string | null;
          isTyping?: boolean;
          sectionId?: string;
          heading?: string;
          body?: string;
          title?: string;
        };

        if (msg.type === 'join' && msg.docId && msg.clientId) {
          if (currentDocId && currentClientId && rooms.has(currentDocId)) {
            rooms.get(currentDocId)?.delete(currentClientId);
            broadcastRoomPresence(currentDocId);
          }

          currentDocId = msg.docId;
          currentClientId = msg.clientId;
          if (!rooms.has(currentDocId)) {
            rooms.set(currentDocId, new Map());
          }
          rooms.get(currentDocId)?.set(currentClientId, {
            ws,
            clientId: currentClientId,
            uid: msg.uid || 'guest',
            name: (msg.name || 'Collaborator').slice(0, 80),
            color: msg.color || '#1D4ED8',
            activeSectionId: msg.activeSectionId ?? null,
            isTyping: false,
            updatedAt: Date.now(),
          });
          broadcastRoomPresence(currentDocId);
          return;
        }

        if (!currentDocId || !currentClientId) return;
        const room = rooms.get(currentDocId);
        if (!room) return;
        const member = room.get(currentClientId);
        if (!member) return;

        if (msg.type === 'presence:focus') {
          member.activeSectionId = msg.activeSectionId ?? null;
          member.isTyping = Boolean(msg.isTyping);
          member.updatedAt = Date.now();
          broadcastRoomPresence(currentDocId);
          return;
        }

        if (msg.type === 'section:patch') {
          member.updatedAt = Date.now();
          broadcastRoomEvent(currentDocId, currentClientId, {
            type: 'section:patch',
            docId: currentDocId,
            clientId: currentClientId,
            authorName: member.name,
            sectionId: msg.sectionId,
            heading: msg.heading,
            body: msg.body,
            title: msg.title,
          });
        }
      } catch {
        // Ignore malformed WebSocket payloads
      }
    });

    ws.on('close', () => {
      if (currentDocId && currentClientId && rooms.has(currentDocId)) {
        const room = rooms.get(currentDocId);
        room?.delete(currentClientId);
        if (room && room.size === 0) {
          rooms.delete(currentDocId);
        } else {
          broadcastRoomPresence(currentDocId);
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`VellumDesk server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
