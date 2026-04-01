// Load saved settings
chrome.storage.local.get(['autoSuggest', 'blockEmail', 'blockSensitive', 'blockPassword', 'tone', 'showExplanations', 'showManual', 'showButton'], (result) => {
    document.getElementById('autoSuggestToggle').checked = result.autoSuggest || false;
    document.getElementById('blockEmailToggle').checked = result.blockEmail !== false;
    document.getElementById('blockSensitiveToggle').checked = result.blockSensitive !== false;
    document.getElementById('blockPasswordToggle').checked = result.blockPassword !== false;
    document.getElementById('toneSelect').value = result.tone || 'Professional';
    document.getElementById('showExplanationsToggle').checked = result.showExplanations || false;
    document.getElementById('showButtonToggle').checked = result.showButton !== false;
    
    // Toggle manual section visibility
    const showManual = result.showManual || false;
    document.getElementById('showManualToggle').checked = showManual;
    document.getElementById('manualCorrectionSection').style.display = showManual ? 'block' : 'none';
});

// Save settings
document.getElementById('autoSuggestToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ autoSuggest: e.target.checked });
});
document.getElementById('blockEmailToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ blockEmail: e.target.checked });
});
document.getElementById('blockSensitiveToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ blockSensitive: e.target.checked });
});
document.getElementById('blockPasswordToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ blockPassword: e.target.checked });
});
document.getElementById('showButtonToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ showButton: e.target.checked });
});
document.getElementById('toneSelect').addEventListener('change', (e) => {
    chrome.storage.local.set({ tone: e.target.value });
});
document.getElementById('showExplanationsToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ showExplanations: e.target.checked });
});
document.getElementById('showManualToggle').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    chrome.storage.local.set({ showManual: isChecked });
    document.getElementById('manualCorrectionSection').style.display = isChecked ? 'block' : 'none';
});

document.getElementById('correctBtn').addEventListener('click', async () => {
    const inputText = document.getElementById('inputText').value;
    const btn = document.getElementById('correctBtn');
    const outputDiv = document.getElementById('outputText');
    const resultBlock = document.getElementById('resultBlock');
    const status = document.getElementById('status');

    if (!inputText.trim()) return;

    btn.disabled = true;
    btn.innerText = 'CORRECTING...';
    status.innerText = '';
    resultBlock.style.display = 'none';

    try {
        const response = await chrome.runtime.sendMessage({
            action: "correctGrammar",
            text: inputText
        });

        if (response && response.corrected) {
            outputDiv.innerText = response.corrected;
            
            const explanationBlock = document.getElementById('explanationBlock');
            const explanationText = document.getElementById('explanationText');
            if (response.explanation && explanationBlock && explanationText) {
                explanationText.innerText = response.explanation;
                explanationBlock.style.display = 'block';
            } else if (explanationBlock) {
                explanationBlock.style.display = 'none';
            }

            resultBlock.style.display = 'block';
            status.innerText = 'Success!';
        } else if (response && response.error) {
            status.innerText = 'Error: ' + response.error;
            status.style.color = 'red';
        }
    } catch (error) {
        status.innerText = 'Error: ' + error.message;
        status.style.color = 'red';
    } finally {
        btn.disabled = false;
        btn.innerText = 'CORRECT';
    }
});

// Auto-copy corrected text to clipboard
document.getElementById('outputText').addEventListener('click', () => {
    const text = document.getElementById('outputText').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const status = document.getElementById('status');
        status.innerText = 'Copied to clipboard!';
        setTimeout(() => { status.innerText = ''; }, 2000);
    });
});
