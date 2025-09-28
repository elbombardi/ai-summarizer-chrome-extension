// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent' || request.action === 'getVideoTranscript') {
        // Make the function asynchronous to use await
        (async () => {
            try {
                const apiKey = await getApiKey();
                if (!apiKey) {
                    sendResponse({ error: "Gemini API key is not configured." });
                    return;
                }

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });

                // Once the script is injected, send it a message to retrieve the content
                const contentResponse = await chrome.tabs.sendMessage(tab.id, { action: request.action });

                if (!contentResponse || !contentResponse.content || contentResponse.content.trim() === '') {
                     sendResponse({ error: "Could not retrieve content from the page. For a video, make sure the transcript is open." });
                     return;
                }

                const summary = await getGeminiSummary(contentResponse.content, apiKey, request.action);
                sendResponse({ summary: summary });

            } catch (e) {
                console.error("Error in background.js:", e);
                sendResponse({ error: e.message });
            }
        })();
        
        // Indicates that the response will be sent asynchronously
        return true; 
    }
});


// Function to retrieve the API key from storage
function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('apiKey', (data) => {
            resolve(data.apiKey);
        });
    });
}


// Function to call the Gemini API
async function getGeminiSummary(text, apiKey, action) {
    const model = 'gemini-2.5-flash-preview-05-20';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let prompt;
    if (action === 'getVideoTranscript') {
        prompt = "Summarize the transcript of this video in English. Highlight the key points as a bulleted list:\n\n" + text;
    } else {
        prompt = "Make a concise and structured summary of the following web page in English. Start with an introductory sentence, then list the 3 to 5 most important points:\n\n" + text;
    }

    // To avoid overloading the API, limit the size of the text sent
    const maxChars = 15000;
    const truncatedText = text.substring(0, maxChars);
    
    const payload = {
        contents: [{
            parts: [{
                text: prompt.replace('{text}', truncatedText)
            }]
        }]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error:", errorData);
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    try {
       return data.candidates[0].content.parts[0].text;
    } catch(e) {
       console.error("Unexpected API response:", data);
       throw new Error("The API response structure has changed or is invalid.");
    }
}

