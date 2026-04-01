// Load saved settings
chrome.storage.local.get(['autoSuggest', 'blockEmail', 'blockSensitive', 'blockPassword', 'tone', 'showExplanations', 'showManual', 'showButton', 'theme', 'blacklist'], (result) => {
    document.getElementById('autoSuggestToggle').checked = result.autoSuggest || false;
    document.getElementById('blockEmailToggle').checked = result.blockEmail !== false;
    document.getElementById('blockSensitiveToggle').checked = result.blockSensitive !== false;
    document.getElementById('blockPasswordToggle').checked = result.blockPassword !== false;
    document.getElementById('toneSelect').value = result.tone || 'Professional';
    document.getElementById('showExplanationsToggle').checked = result.showExplanations || false;
    document.getElementById('showButtonToggle').checked = result.showButton !== false;
    
    // Theme logic
    const theme = result.theme || 'light';
    document.getElementById('themeSelect').value = theme;
    applyTheme(theme);

    // Toggle manual section visibility
    const showManual = result.showManual || false;
    document.getElementById('showManualToggle').checked = showManual;
    document.getElementById('manualCorrectionSection').style.display = showManual ? 'block' : 'none';

    // Blacklist detection
    const blacklist = (result.blacklist || []).filter(domain => {
        return !['extensions', 'settings', 'history', 'newtab', 'downloads'].includes(domain);
    });
    if (result.blacklist && result.blacklist.length !== blacklist.length) {
        chrome.storage.local.set({ blacklist: blacklist });
    }
    updateBlacklistUI(blacklist);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                const restrictedProtocols = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'view-source:'];
                const isRestricted = restrictedProtocols.includes(url.protocol);
                console.log("Prism Popup Debug:", { protocol: url.protocol, hostname: url.hostname, isRestricted });
                
                const toggle = document.getElementById('blacklistToggle');
                const toggleGroup = document.getElementById('blacklistToggleGroup');
                const sectionTitle = document.getElementById('blacklistSectionTitle');
                const label = document.getElementById('currentDomainLabel');

                if (isRestricted) {
                    toggleGroup.style.display = 'none';
                    sectionTitle.style.display = 'none';
                    return;
                }

                toggleGroup.style.display = 'flex';
                sectionTitle.style.display = 'block';
                const hostname = url.hostname;
                if (hostname) {
                    const normalizedHost = hostname.replace(/^www\./, '');
                    label.innerText = `Disable on ${hostname}`;
                    
                    const isEffectivelyBlacklisted = blacklist.some(d => hostname === d || hostname.endsWith('.' + d));
                    toggle.checked = isEffectivelyBlacklisted;
                    
                    // Handle toggle change
                    toggle.addEventListener('change', (e) => {
                        chrome.storage.local.get(['blacklist'], (res) => {
                            let currentList = res.blacklist || [];
                            if (e.target.checked) {
                                if (!currentList.includes(normalizedHost)) currentList.push(normalizedHost);
                            } else {
                                currentList = currentList.filter(h => h !== hostname && h !== normalizedHost);
                            }
                            chrome.storage.local.set({ blacklist: currentList }, () => {
                                updateBlacklistUI(currentList);
                            });
                        });
                    });
                }
            } catch (e) {
                console.error("Prism Popup Error:", e);
                document.getElementById('blacklistToggle').disabled = true;
            }
        }
    });
});

function updateBlacklistUI(blacklist) {
    const container = document.getElementById('blacklistContainer');
    container.innerHTML = '';
    
    if (blacklist.length === 0) {
        container.innerHTML = '<div style="font-size: 11px; color: #999; text-align: center;">No blacklisted sites</div>';
        return;
    }

    blacklist.forEach(domain => {
        const item = document.createElement('div');
        item.className = 'blacklist-item';
        item.innerHTML = `
            <span>${domain}</span>
            <span class="remove-btn" data-domain="${domain}">&times;</span>
        `;
        container.appendChild(item);
    });

    // Add remove listeners
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = () => {
            const domain = btn.getAttribute('data-domain');
            chrome.storage.local.get(['blacklist'], (res) => {
                const newList = (res.blacklist || []).filter(d => d !== domain);
                chrome.storage.local.set({ blacklist: newList }, () => {
                    updateBlacklistUI(newList);
                    // Also update toggle if we're on that domain
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0] && tabs[0].url) {
                            const url = new URL(tabs[0].url);
                            if (url.hostname === domain) {
                                document.getElementById('blacklistToggle').checked = false;
                            }
                        }
                    });
                });
            });
        };
    });
}

function applyTheme(theme) {
    let isDark = theme === 'dark';
    if (theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    document.body.classList.toggle('theme-dark', isDark);
}

// Save settings
document.getElementById('themeSelect').addEventListener('change', (e) => {
    const theme = e.target.value;
    chrome.storage.local.set({ theme: theme });
    applyTheme(theme);
});
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

// Handle manual blacklist add
document.getElementById('addBlacklistBtn').addEventListener('click', () => {
    const input = document.getElementById('manualBlacklistInput');
    const domain = input.value.trim().toLowerCase();
    if (domain) {
        chrome.storage.local.get(['blacklist'], (res) => {
            let currentList = res.blacklist || [];
            if (!currentList.includes(domain)) {
                currentList.push(domain);
                chrome.storage.local.set({ blacklist: currentList }, () => {
                    updateBlacklistUI(currentList);
                    input.value = '';
                    // Update toggle if we're on that domain
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0] && tabs[0].url) {
                            try {
                                const url = new URL(tabs[0].url);
                                if (url.hostname === domain) {
                                    document.getElementById('blacklistToggle').checked = true;
                                }
                            } catch (e) {}
                        }
                    });
                });
            }
        });
    }
});
