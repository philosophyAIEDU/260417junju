// ──── CONFIGURATION ────
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TEXT_MODEL = 'gemini-2.0-flash-lite-preview-02-05';
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';

// ──── API CALLS ────

export async function callText(apiKey, prompt) {
  if (!apiKey) throw new Error("API Key is missing.");
  
  const url = `${API_BASE}/${TEXT_MODEL}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Use low temperature for structured output, higher for creative
      generationConfig: { temperature: 0.7 }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini API");
  
  return text;
}

export async function callImage(apiKey, prompt) {
  if (!apiKey) throw new Error("API Key is missing.");
  
  const url = `${API_BASE}/${IMAGE_MODEL}:predict?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Image model predict endpoint format
    body: JSON.stringify({
      instances: [{ prompt: prompt }],
      parameters: { sampleCount: 1, outputOptions: { mimeType: 'image/jpeg' } }
    })
  });

  if (!response.ok) {
    console.warn(`Image generation failed for prompt: "${prompt}"`, response.status);
    return null;
  }

  const data = await response.json();
  // Extract base64 encoded image
  const base64Data = data.predictions?.[0]?.bytesBase64Encoded;
  
  if (base64Data) {
    return `data:image/jpeg;base64,${base64Data}`;
  }
  return null;
}

// ──── PROMPT BUILDERS ────

export function buildSamPrompt(templateText) {
  return `You are Sam, an expert structural analyst. Analyze the following document template/context and extract to JSON. 
Do not output anything other than valid JSON. 

Template Text:
"""
${templateText}
"""

Required JSON Format:
{
  "sections": ["Section 1 Title", "Section 2 Title", ...],
  "tone": "Brief description of the tone",
  "style_notes": "Any other formatting or style notes",
  "structure_summary": "Short summary of the overall structure"
}`;
}

export function buildJennyPrompt(samJsonText, brief) {
  return `You are Jenny, an expert proposal writer and HTML designer.
Your task is to write a comprehensive proposal draft in HTML based on the provided structural analysis, and the user's brief.

Structural Analysis from Sam:
${samJsonText}

User Brief:
- Client Name: ${brief.clientName}
- Project Title: ${brief.projectTitle}
- Description: ${brief.description}
- Duration: ${brief.duration}
- Budget: ${brief.budget}
- Additional Requirements: ${brief.requirements}

INSTRUCTIONS:
1. Write a complete HTML document body (just the content, no <html> or <body> tags). Use <h1> for the main title, <h2> for sections, and <table> where appropriate (e.g., budget, timeline).
2. Fulfill all requirements from the user brief and follow the basic structure highlighted by Sam.
3. Be persuasive, professional, and detailed.
4. IMPORTANT: You can suggest up to 3 images to make the proposal visually appealing. Where an image is appropriate, insert this exact placeholder: {{IMAGE: A detailed description of the image to be generated in English}}
Do not write anything else outside of the HTML code formatting.`;
}

export function buildWillPrompt(jennyHtml) {
  return `You are Will, a senior editor and quality assurance specialist. 
Your task is to review and finalize this HTML proposal. 

Draft Proposal HTML:
"""
${jennyHtml}
"""

INSTRUCTIONS:
1. Review the content for professionalism, clarity, and persuasiveness. Address any obvious logical gaps.
2. Fix any broken HTML tags. 
3. MUST PRESERVE the image placeholders perfectly. Do NOT modify any {{IMAGE: ...}} tags. Keep them exactly as they are.
4. Output ONLY the finalized HTML. Do not wrap in markdown code blocks (\`\`\`html) if possible, just output the raw HTML string.`;
}
