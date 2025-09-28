// This script is injected into the active web page.
// It listens for messages from the background script.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        // Get all the visible text from the page
        const pageText = document.body.innerText;
        sendResponse({ content: pageText });
    } else if (request.action === 'getVideoTranscript') {
        // YouTube-specific logic to extract the transcript.
        // THIS IS FRAGILE and may break if YouTube changes its HTML structure.
        
        // The transcript segments are in elements with the class 'segment'.
        // The parent container has an id 'segments-container'.
        const transcriptSegments = document.querySelectorAll('#segments-container .segment .yt-core-attributed-string');
        
        if (transcriptSegments.length > 0) {
            let fullTranscript = "";
            transcriptSegments.forEach(segment => {
                fullTranscript += segment.textContent.trim() + " ";
            });
            sendResponse({ content: fullTranscript });
        } else {
            // If no segments are found, send an empty response
            sendResponse({ content: "" });
        }
    }
    // Indicates that the response may be sent asynchronously if needed
    return true; 
});

