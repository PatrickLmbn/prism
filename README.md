# Prism

A minimalist, high-end AI writing companion for Chrome. Prism doesn't just fix your grammar—it refracts your voice into the perfect tone for any occasion.

![Prism Branding](icons/icon128.png)

## ✨ Features

- **Tone-Aware Refinement**: Choose between **Professional, Casual, Academic, or Creative** tones to match your intent.
- **AI Explanations**: Toggle "Explain Changes" to see the "why" behind every correction via a subtle hover tooltip.
- **Privacy-First**: Automatic protection for sensitive fields like passwords, emails, and API keys.
- **Minimalist UI**: Injected suggestion boxes and manual correction buttons follow a premium, non-intrusive aesthetic.
- **Dark Mode Support**: Seamlessly switches between Light, Dark, and System themes.
- **Domain Blacklist**: Disable Prism on specific websites (like internal dashboards) to prevent AI interference.
- **Manual Correction Tools**: A dedicated area in the popup for quick text checks.

## 🚀 Getting Started

### 1. Manual API Key Setup
Prism uses the **OpenRouter API** to provide high-quality AI suggestions.
1. Copy `config.example.js` to a new file named `config.js`.
2. Open `config.js` and paste your OpenRouter API key.
   > [!NOTE]
   > `config.js` is automatically added to `.gitignore` to keep your keys private.

### 2. Installation
1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the extension folder.

## 🛠️ Usage

### Auto-Suggest
When enabled, Prism will subtly suggest improvements as you type.
- Click **Accept** to apply the change.
- Click **Decline** to dismiss.
- Hover over the **?** icon to see the explanation for the change.

### Manual Correction
- Look for the **Pr** button on text fields to trigger a quick check.
- Or use the **Enable Manual Correction** toggle in the popup to paste text directly.

### Domain Blacklist
Manage which websites Prism stays active on.
- **Quick Toggle**: While on a site, open the popup and toggle **Disable on [domain]**.
- **Manual Entry**: Type a domain (e.g. `example.com`) into the input field at the bottom and click **ADD**.
- **Remove**: Click the **✕** next to any domain in the list to re-enable Prism.

## 🛡️ Privacy
Prism is built with your privacy in mind:
- **Sensitive Data Detection**: Prism automatically disables itself on fields labeled as passwords or emails.
- **Local Settings**: All your preferences are stored locally in your browser.

## 💻 Tech Stack
- Manifest V3
- OpenRouter API (Llama 3.1 8B Instruct)
- Vanilla Javascript & CSS

---
*Created with focus on visual excellence and minimalist functionality.*
