try {
  importScripts('config.js');
} catch (e) {
  console.error("config.js not found. Please create it from config.example.js.");
}

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "correctGrammar",
    title: "Correct Grammar",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "correctGrammar" && info.selectionText) {
    correctText(info.selectionText).then(corrected => {
      chrome.tabs.sendMessage(tab.id, {
        action: "replaceSelection",
        original: info.selectionText,
        corrected: corrected
      });
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "correctGrammar") {
    // Get settings from storage if not provided in request
    chrome.storage.local.get(['tone', 'showExplanations'], (result) => {
      const tone = request.tone || result.tone || 'Professional';
      const includeExplanation = request.includeExplanation !== undefined ? request.includeExplanation : (result.showExplanations || false);
      
      correctText(request.text, tone, includeExplanation).then(response => {
        sendResponse(response);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
    });
    return true; // Keep the message channel open for async response
  }
});

async function correctText(text, tone = 'Professional', includeExplanation = false) {
  try {
    if (!text || text.trim().length === 0) {
      return { corrected: '' };
    }

    let systemPrompt = `You are an expert editor. Your job is to rewrite the user's input to be grammatically perfect while strictly adhering to a ${tone} tone.`;
    let userPrompt = `Rewrite this text for perfect grammar and spelling in a ${tone} tone: "${text}"\n\n`;

    if (includeExplanation) {
      systemPrompt += ` Provide the rewritten text followed by a very brief explanation of the primary changes. Format: [REWRITTEN TEXT] ||| [EXPLANATION]`;
      userPrompt += `Return the result in the "Text ||| Explanation" format.`;
    } else {
      systemPrompt += ` Return ONLY the rewritten text. No conversational filler, no quotes.`;
      userPrompt += `Return ONLY the rewritten text.`;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/google-deepmind/antigravity',
        'X-Title': 'Prism AI'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      let content = (data.choices[0].message.content || '').trim();
      
      if (includeExplanation) {
        const parts = content.split('|||').map(p => p.trim());
        let corrected = parts[0];
        let explanation = parts[1] || '';
        
        // Clean up quotes if present
        if (corrected.startsWith('"') && corrected.endsWith('"')) corrected = corrected.substring(1, corrected.length - 1);
        
        return { corrected: corrected.trim(), explanation: explanation.trim() };
      } else {
        // Remove surrounding quotes if the AI included them
        if (content.startsWith('"') && content.endsWith('"')) {
          content = content.substring(1, content.length - 1);
        } else if (content.startsWith("'") && content.endsWith("'")) {
          content = content.substring(1, content.length - 1);
        }
        return { corrected: content.trim() };
      }
    } else {
      console.error('API Error:', data);
      throw new Error(data.error?.message || 'Failed to get correction');
    }
  } catch (error) {
    console.error('Correction Error:', error);
    throw error;
  }
}
