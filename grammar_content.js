chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "replaceSelection") {
    replaceSelectedText(request.corrected);
  }
});

function replaceSelectedText(corrected) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(corrected));
  }
}

let autoSuggestEnabled = false;
let blockEmail = true;
let blockSensitive = true;
let blockPassword = true;
let debounceTimer;

// Safe trim helper
function safeTrim(val) {
  if (typeof val !== 'string') return '';
  return val.trim();
}

let tone = 'Professional';
let showExplanations = false;

let showButton = true;

// Load initial state
chrome.storage.local.get(['autoSuggest', 'blockEmail', 'blockSensitive', 'blockPassword', 'tone', 'showExplanations', 'showButton'], (result) => {
  autoSuggestEnabled = result.autoSuggest || false;
  blockEmail = result.blockEmail !== false;
  blockSensitive = result.blockSensitive !== false;
  blockPassword = result.blockPassword !== false;
  tone = result.tone || 'Professional';
  showExplanations = result.showExplanations || false;
  showButton = result.showButton !== false;
});

// Listen for state changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoSuggest) autoSuggestEnabled = changes.autoSuggest.newValue;
  if (changes.blockEmail) blockEmail = changes.blockEmail.newValue;
  if (changes.blockSensitive) blockSensitive = changes.blockSensitive.newValue;
  if (changes.blockPassword) blockPassword = changes.blockPassword.newValue;
  if (changes.tone) tone = changes.tone.newValue;
  if (changes.showExplanations) showExplanations = changes.showExplanations.newValue;
  if (changes.showButton) showButton = changes.showButton.newValue;
});

function isProtectedField(el) {
  try {
    if (!el) return false;
    const type = (el.type || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const name = (el.name || '').toLowerCase();
    const placeholder = (el.placeholder || '').toLowerCase();
    const autocomplete = (el.autocomplete || '').toLowerCase();

    // 1. Password protection
    if (blockPassword) {
      if (type === 'password' || autocomplete.includes('password') || name.includes('password') || id.includes('password')) {
        return true;
      }
    }

    // 2. Email protection
    if (blockEmail) {
      if (type === 'email' || name.includes('email') || id.includes('email') || placeholder.includes('email')) {
        return true;
      }
    }

    // 3. Sensitive protection (API keys, tokens, usernames, secrets)
    if (blockSensitive) {
      const sensitiveKeywords = ['api', 'key', 'token', 'secret', 'pass', 'username', 'user_name', 'cred', 'auth', 'login', 'cvv', 'card', 'credit', 'ssh', 'passport', 'ssn'];
      const combinedStrings = `${id} ${name} ${placeholder} ${autocomplete}`;
      if (sensitiveKeywords.some(kw => combinedStrings.includes(kw))) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

function isSupportedInput(el) {
  try {
    if (!el || typeof el.tagName !== 'string') return false;
    const tagName = el.tagName.toUpperCase();
    return tagName === 'TEXTAREA' || 
           (tagName === 'INPUT' && el.type === 'text') ||
           el.isContentEditable ||
           el.getAttribute('contenteditable') === 'true' ||
           el.getAttribute('role') === 'textbox';
  } catch (e) {
    return false;
  }
}

function getInputValue(el) {
  try {
    if (!el) return '';
    let val = '';
    // Standard inputs
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      val = el.value || '';
    } 
    // Content editable - try multiple ways
    else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      val = el.textContent || el.innerText || '';
    }
    return String(val).trim();
  } catch (e) {
    return '';
  }
}

function setInputValue(el, val) {
  try {
    if (!el) return;
    const stringVal = String(val);
    
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = stringVal;
    } else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      // Use textContent instead of innerText to avoid complex layout triggers
      el.textContent = stringVal;
    }
  } catch (e) {}
}

// Event listener for input
document.addEventListener('input', (e) => {
  try {
    let target = e.target;
    if (!target) return;
    
    // Find the actual input/editable ancestor
    const realTarget = target.closest('[contenteditable="true"], [role="textbox"], textarea, input');
    if (realTarget) target = realTarget;

    // Immediately remove any existing suggestion when the user types
    removeSuggestionUI(target);

    // Skip if field is protected
    if (isProtectedField(target)) {
      removeCorrectionButton(target);
      return;
    }

    if (isSupportedInput(target)) {
      const val = getInputValue(target);
      if (val && val.length > 0) {
        if (autoSuggestEnabled) {
          triggerAutoSuggest(target);
        } else {
          addCorrectionButton(target);
        }
      } else {
        removeCorrectionButton(target);
        removeSuggestionUI(target);
      }
    }
  } catch (err) {}
}, true);

// Clear suggestions when user hits Enter (sending message)
document.addEventListener('keydown', (e) => {
  try {
    if (e.key === 'Enter' && !e.shiftKey) {
      removeSuggestionUI();
    }
  } catch (err) {}
}, true);

// Clear suggestions when user clicks anywhere else or the send button
document.addEventListener('click', (e) => {
  try {
    const target = e.target;
    // If clicking a button that looks like "Send"
    if (target.closest('button') || target.tagName === 'SVG' || target.tagName === 'PATH') {
      // Small delay to ensure the click processed
      setTimeout(removeSuggestionUI, 100);
    }
    
    // If clicking outside the suggestion UI, remove it
    if (!target.closest('.grammar-suggestion-ui')) {
      removeSuggestionUI();
    }
  } catch (err) {}
}, true);

document.addEventListener('focusin', (e) => {
  try {
    const target = e.target;
    if (isSupportedInput(target)) {
      const val = getInputValue(target);
      if (val && val.length > 0 && !autoSuggestEnabled) {
        addCorrectionButton(target);
      }
    }
  } catch (err) {}
}, true);

function triggerAutoSuggest(target) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      const val = getInputValue(target);
      if (val && val.length > 3) { 
        const targetId = target.id || 'unnamed-suggestion';
        if (!document.querySelector(`.grammar-suggestion-ui[data-target-id="${targetId}"]`)) {
          showSuggestionUI(target);
        }
      }
    } catch (e) {}
  }, 500); 
}

async function showSuggestionUI(target) {
  const targetId = target.id || 'unnamed-suggestion';
  try {
    removeSuggestionUI(target);

    const suggestionContainer = document.createElement('div');
    suggestionContainer.className = 'grammar-suggestion-ui';
    suggestionContainer.setAttribute('data-target-id', targetId);
    
    // Antigravity-style premium minimalist styling
    suggestionContainer.style.cssText = `
      position: absolute;
      background: #ffffff;
      border: 1px solid #000000;
      padding: 16px;
      z-index: 2147483647;
      box-shadow: 6px 6px 0px #000000;
      max-width: 340px;
      min-width: 240px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #000000;
      border-radius: 2px;
      animation: grammarFadeIn 0.2s ease-out;
    `;
    
    // Adding a subtle fade-in animation
    if (!document.getElementById('grammar-styles')) {
      const style = document.createElement('style');
      style.id = 'grammar-styles';
      style.innerHTML = `
        @keyframes grammarFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      .grammar-btn-primary:hover { background: #333 !important; }
      .grammar-btn-secondary:hover { background: #f0f0f0 !important; }
      .grammar-explanation-tooltip {
        position: absolute;
        bottom: calc(100% + 10px);
        right: 0;
        width: 260px;
        background: #f9f9f9;
        color: #000;
        padding: 12px;
        font-size: 12px;
        line-height: 1.4;
        border: 1px solid #000;
        box-shadow: 4px 4px 0px rgba(0,0,0,0.1);
        display: none;
        z-index: 2147483647;
        pointer-events: none;
        border-radius: 2px;
      }
      .grammar-q-mark:hover + .grammar-explanation-tooltip { display: block; }
    `;
      document.head.appendChild(style);
    }
    
    suggestionContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 6px; height: 6px; background: #000; border-radius: 50%;"></div>
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #000; font-weight: 700; opacity: 0.7;">Grammar</div>
        </div>
        <div style="position: relative; display: flex; align-items: center;">
          <div id="qMark" class="grammar-q-mark" style="cursor:help; font-size: 12px; font-weight: bold; border: 1px solid #000; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%; opacity: 0.5; transition: opacity 0.2s; visibility: hidden;">?</div>
          <div id="explanationBox" class="grammar-explanation-tooltip"></div>
        </div>
      </div>
      <div id="suggestionText" style="font-size: 13px; margin-bottom: 12px; font-weight: 400; line-height: 1.4; color: #1a1a1a;">Correcting...</div>
      <div style="display: flex; gap: 8px;">
        <button id="acceptBtn" class="grammar-btn-primary" style="background: #000; color: #fff; border: 1px solid #000; padding: 5px 12px; cursor: pointer; flex: 1; font-weight: 600; font-size: 11px; letter-spacing: 0.3px; transition: background 0.2s;">ACCEPT</button>
        <button id="declineBtn" class="grammar-btn-secondary" style="background: #fff; color: #000; border: 1px solid #000; padding: 5px 12px; cursor: pointer; flex: 1; font-weight: 600; font-size: 11px; letter-spacing: 0.3px; transition: background 0.2s;">DECLINE</button>
      </div>
    `;

    updateSuggestionPosition(suggestionContainer, target);
    document.body.appendChild(suggestionContainer);

    const val = getInputValue(target);
    if (!val || val.length < 3) {
      removeSuggestionUI(target);
      return;
    }
    
    const response = await chrome.runtime.sendMessage({ 
      action: "correctGrammar", 
      text: val,
      tone: tone,
      includeExplanation: showExplanations
    });

    // Race condition check: If the user cleared the text while the AI was thinking, don't show the suggestion
    const currentVal = getInputValue(target);
    if (!currentVal || currentVal.length < 3) {
      removeSuggestionUI(target);
      return;
    }

    if (response && response.corrected) {
      const corrected = safeTrim(response.corrected);
      const original = safeTrim(val);
      
      if (corrected && corrected !== original) {
        const suggestionText = suggestionContainer.querySelector('#suggestionText');
        if (suggestionText) suggestionText.innerText = corrected;

        const qMark = suggestionContainer.querySelector('#qMark');
        const explanationBox = suggestionContainer.querySelector('#explanationBox');
        if (qMark && explanationBox && response.explanation) {
          qMark.style.visibility = 'visible';
          qMark.style.opacity = '1';
          explanationBox.innerText = response.explanation;
        }

        const acceptBtn = suggestionContainer.querySelector('#acceptBtn');
        if (acceptBtn) {
          acceptBtn.onclick = () => {
            setInputValue(target, corrected);
            target.dispatchEvent(new Event('input', { bubbles: true }));
            removeSuggestionUI(target);
          };
        }

        const declineBtn = suggestionContainer.querySelector('#declineBtn');
        if (declineBtn) {
          declineBtn.onclick = () => {
            removeSuggestionUI(target);
          };
        }
      } else {
        removeSuggestionUI(target);
      }
    } else {
      removeSuggestionUI(target);
    }
  } catch (error) {
    removeSuggestionUI({ id: targetId }); 
  }
}

function removeSuggestionUI(target) {
  try {
    // Aggressively remove all suggestion boxes on the page to ensure none are left behind
    const suggestions = document.querySelectorAll('.grammar-suggestion-ui');
    suggestions.forEach(s => s.remove());
  } catch (e) {}
}

function updateSuggestionPosition(ui, target) {
  try {
    const rect = target.getBoundingClientRect();
    let top = window.scrollY + rect.bottom + 4;
    let left = window.scrollX + rect.left;
    if (left + 300 > window.innerWidth) {
      left = window.scrollX + rect.right - 300;
    }
    ui.style.top = `${top}px`;
    ui.style.left = `${left}px`;
  } catch (e) {}
}

function removeCorrectionButton(target) {
  try {
    const targetId = target.id || 'unnamed-manual';
    const existingBtn = document.querySelector(`.grammar-check-btn[data-target-id="${targetId}"]`);
    if (existingBtn) existingBtn.remove();
  } catch (e) {}
}

function addCorrectionButton(target) {
  try {
    if (isProtectedField(target) || !showButton) return;
    const targetId = target.id || 'unnamed-manual';
    let btn = document.querySelector(`.grammar-check-btn[data-target-id="${targetId}"]`);
    
    if (btn) {
      updateButtonPosition(btn, target);
      return;
    }

    btn = document.createElement('div');
    btn.innerText = 'Pr';
    btn.className = 'grammar-check-btn';
    btn.setAttribute('data-target-id', targetId);
    btn.style.cssText = 'position:absolute;cursor:pointer;background:#fff;color:#000;padding:4px 8px;font-size:11px;font-weight:bold;z-index:100000;border:1px solid #000;box-shadow:4px 4px 0px #000;transition:transform 0.1s;';
    btn.title = 'Correct Grammar';

    btn.onmouseover = () => btn.style.transform = 'translate(-1px, -1px)';
    btn.onmouseout = () => btn.style.transform = 'translate(0, 0)';

    updateButtonPosition(btn, target);

    btn.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      btn.innerText = '...';
      try {
        const val = getInputValue(target);
        const response = await chrome.runtime.sendMessage({ 
          action: "correctGrammar", 
          text: val,
          tone: tone,
          includeExplanation: showExplanations
        });
        if (response && response.corrected) {
          setInputValue(target, response.corrected);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          btn.innerText = '✔';
          setTimeout(() => { btn.innerText = 'Pr'; }, 1000);
        } else {
          btn.innerText = '✘';
          setTimeout(() => { btn.innerText = 'Pr'; }, 2000);
        }
      } catch (error) {
        btn.innerText = '✘';
        setTimeout(() => { btn.innerText = 'Pr'; }, 2000);
      }
    };

    document.body.appendChild(btn);

    target.addEventListener('blur', () => {
      setTimeout(() => {
          if (document.body.contains(btn)) btn.remove();
      }, 500);
    }, { once: true });
  } catch (e) {}
}

function updateButtonPosition(btn, target) {
  try {
    const rect = target.getBoundingClientRect();
    btn.style.top = `${window.scrollY + rect.top + 5}px`;
    btn.style.left = `${window.scrollX + rect.right - 25}px`;
  } catch (e) {}
}
