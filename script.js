// script.js

// --- Global Constants & DOM Elements ---
// IMPORTANT: Replace "YOUR_GEMINI_API_KEY" with your actual Google Gemini API key.
// This key will be exposed in the frontend code. Use with caution in production.
const API_KEY = "AIzaSyBGqg6gaWBImHtvrGk9IJlPNq_wErCwMag"; 

// Main UI Elements
const mainChatUI = document.getElementById('main-chat-ui');
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const micButton = document.getElementById('mic-button');
const sendButton = document.getElementById('send-button');
const languageToggle = document.getElementById('language-toggle');
const settingsButton = document.getElementById('settings-button');

// Modal Elements (Alert & Settings)
const customAlertModal = document.getElementById('custom-alert-modal');
const alertMessageText = document.getElementById('alert-message-text');
const alertOkButton = document.getElementById('alert-ok-button');

const settingsModal = document.getElementById('settings-modal');
const settingsUserNameInput = document.getElementById('settings-user-name-input');
const settingsUserHobbiesInput = document.getElementById('settings-user-hobbies-input');
const settingsPartnerNameInput = document.getElementById('settings-partner-name-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

// Onboarding Elements
const onboardingModal = document.getElementById('onboarding-modal');
const onboardingStep1 = document.getElementById('onboarding-step-1');
const onboardingStep2 = document.getElementById('onboarding-step-2');
const onboardingStep3 = document.getElementById('onboarding-step-3');
const onboardingUserNameInput = document.getElementById('onboarding-user-name');
const onboardingUserHobbiesInput = document.getElementById('onboarding-user-hobbies');
const onboardingPartnerNameInput = document.getElementById('onboarding-partner-name');
const onboardingNext1 = document.getElementById('onboarding-next-1');
const onboardingNext2 = document.getElementById('onboarding-next-2');
const onboardingFinish = document.getElementById('onboarding-finish');

// Chat Mode Buttons
const voiceChatModeBtn = document.getElementById('voice-chat-mode-btn');
const typeChatModeBtn = document.getElementById('type-chat-mode-btn');
const micAndSendContainer = document.getElementById('mic-and-send-container');

// --- Global State Variables ---
let currentLanguage = 'en-US'; // Default language for conversation and TTS (English)
let isRecording = false; // Tracks if microphone is actively recording
let speechRecognition; // Web Speech API SpeechRecognition instance for input
let currentChatMode = 'voice'; // 'voice' or 'type' - default mode
let userSettings = { // Default user settings, overwritten by loaded data or onboarding
    userName: 'there',
    userHobbies: 'learning new things',
    partnerName: 'Buddy'
};

// Global chat history to maintain context for both display and AI interaction
// Stores objects like: { type: 'user' | 'ai', text: 'message', correctedOriginalText?: string, correctionExplanation?: string, timestamp: string }
let chatHistory = []; 
const MAX_CHAT_HISTORY_LENGTH = 300; // Maximum number of messages (lines) to store in localStorage

// Temporary storage for settings when the settings modal is opened.
// This allows cancelling edits without losing original values.
let tempSettings = {}; 

let isInitialWelcomeDelivered = false; // Flag to track if the initial welcome message has been spoken
let onboardingCurrentStep = 0; // Tracks the current step in the onboarding flow (1, 2, or 3)


// --- Function Definitions ---

/**
 * Displays a custom alert modal with a given message.
 * Replaces standard browser alert() for better UX.
 * @param {string} message - The message to display in the alert.
 */
function alertUser(message) {
    console.log('ALERT:', message); // Log for debugging
    if (alertMessageText) alertMessageText.textContent = message; // Set message text
    showModal(customAlertModal); // Display the modal
}

/**
 * Loads user settings from localStorage.
 * Updates global `userSettings` object.
 */
function loadUserSettings() {
    console.log('loadUserSettings: Attempting to load settings from localStorage...');
    try {
        const storedSettings = localStorage.getItem('languagePartnerSettings');
        if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            // Update user settings, using fallbacks if data is missing or corrupted
            userSettings.userName = parsedSettings.userName || userSettings.userName;
            userSettings.userHobbies = parsedSettings.userHobbies || userSettings.userHobbies;
            userSettings.partnerName = parsedSettings.partnerName || userSettings.partnerName;
            console.log('loadUserSettings: Settings loaded successfully from localStorage:', userSettings);
        } else {
            console.log('loadUserSettings: No settings found in localStorage. Using defaults.');
        }
    } catch (error) {
        console.error('loadUserSettings: Error loading settings from localStorage:', error);
        alertUser(`Error loading saved settings: ${error.message}. Using default settings.`);
    }
    // Populate settings inputs in the settings modal (for editing later), empty if default placeholder
    // This is handled by openSettingsModal() when the settings button is clicked.
}

/**
 * Saves current `userSettings` to localStorage.
 * @param {boolean} fromOnboarding - True if called during the onboarding flow.
 */
function saveUserSettings(fromOnboarding = false) {
    console.log('saveUserSettings: Attempting to save settings to localStorage...');
    // Get values from relevant input fields based on where the call originated
    const userName = fromOnboarding ? onboardingUserNameInput?.value.trim() : settingsUserNameInput?.value.trim();
    const userHobbies = fromOnboarding ? onboardingUserHobbiesInput?.value.trim() : settingsUserHobbiesInput?.value.trim();
    const partnerName = fromOnboarding ? onboardingPartnerNameInput?.value.trim() : settingsPartnerNameInput?.value.trim();

    // Update the global userSettings object
    userSettings.userName = userName || 'there'; // Use 'there' as fallback if empty
    userSettings.userHobbies = userHobbies || 'learning new things'; // Use default if empty
    userSettings.partnerName = partnerName || 'Buddy'; // Use 'Buddy' as fallback if empty

    try {
        localStorage.setItem('languagePartnerSettings', JSON.stringify(userSettings));
        console.log('saveUserSettings: Settings saved successfully to localStorage.');
        if (!fromOnboarding) { // Only show alert if not part of onboarding
            alertUser('Settings saved successfully!');
            closeSettingsModal(); // Close settings modal if not onboarding
            // If settings changed, welcome message needs to be refreshed
            isInitialWelcomeDelivered = false; 
            deliverPersonalizedWelcome();
        }
    } catch (error) {
        console.error('saveUserSettings: Error saving settings to localStorage:', error);
        alertUser(`Failed to save settings: ${error.message}.`);
    }
}

/**
 * Loads conversation history from localStorage and populates the chat box.
 */
function loadChatHistory() {
    console.log('loadChatHistory: Attempting to load chat history from localStorage...');
    try {
        const storedHistory = localStorage.getItem('languagePartnerChatHistory');
        if (storedHistory) {
            chatHistory = JSON.parse(storedHistory);
            console.log('loadChatHistory: Chat history loaded successfully. Messages:', chatHistory.length);
            // Populate chat box from history without re-saving
            chatHistory.forEach(msg => {
                addMessage(msg.text, msg.sender, msg.correctedOriginalText, msg.correctionExplanation, true); // true for doNotSave
            });
            chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
        } else {
            console.log('loadChatHistory: No chat history found in localStorage.');
            chatHistory = []; // Ensure history is empty if nothing found
        }
    } catch (error) {
        console.error('loadChatHistory: Error loading chat history from localStorage:', error);
        alertUser(`Error loading chat history: ${error.message}. Starting with a fresh conversation.`);
        chatHistory = []; // Clear history on error to prevent issues
    }
}

/**
 * Saves current conversation history to localStorage.
 * This is called after each new message is added.
 */
function saveChatHistory() {
    try {
        // Ensure the history is within the maximum length before saving
        if (chatHistory.length > MAX_CHAT_HISTORY_LENGTH) {
            chatHistory = chatHistory.slice(chatHistory.length - MAX_CHAT_HISTORY_LENGTH);
        }
        localStorage.setItem('languagePartnerChatHistory', JSON.stringify(chatHistory));
        console.log('saveChatHistory: History saved to localStorage. Current messages:', chatHistory.length);
    } catch (error) {
        console.error('saveChatHistory: Error saving chat history to localStorage:', error);
        // Do not alert the user for every save error, it can be annoying. Log instead.
    }
}


/**
 * Shows a modal by removing its 'hidden' class.
 * @param {HTMLElement} modalElement - The DOM element of the modal to show.
 */
function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
        console.log(`showModal: ${modalElement.id} is now visible.`);
    } else {
        console.warn('showModal: Attempted to show a null modal element.');
    }
}

/**
 * Hides a modal by adding its 'hidden' class.
 * @param {HTMLElement} modalElement - The DOM element of the modal to hide.
 */
function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('hidden');
        console.log(`hideModal: ${modalElement.id} is now hidden.`);
    } else {
        console.warn('hideModal: Attempted to hide a null modal element.');
    }
}

/**
 * Opens the settings modal, populating its fields with current user settings.
 */
function openSettingsModal() {
    console.log('openSettingsModal: Opening settings modal.');
    // NEW: Store a snapshot of the current settings before user edits.
    // This will be used to restore if 'Cancel' is clicked.
    tempSettings = { ...userSettings }; 

    // Populate input fields in the settings modal with CURRENT user settings
    // Use the actual setting value, or an empty string if it's the default placeholder.
    if (settingsUserNameInput) settingsUserNameInput.value = userSettings.userName === 'there' ? '' : userSettings.userName;
    if (settingsUserHobbiesInput) settingsUserHobbiesInput.value = userSettings.userHobbies === 'learning new things' ? '' : userSettings.userHobbies;
    if (settingsPartnerNameInput) settingsPartnerNameInput.value = userSettings.partnerName === 'Buddy' ? '' : userSettings.partnerName;

    showModal(settingsModal); // Display the settings modal
}

/**
 * Closes the settings modal.
 * This function is called by `saveSettingsBtn` after successful save,
 * and by `cancelSettingsBtn` after reverting changes.
 */
function closeSettingsModal() {
    console.log('closeSettingsModal: Closing settings modal.');
    hideModal(settingsModal); // Hide the settings modal
}

/**
 * Displays the main chat UI and hides the onboarding modal.
 */
function showMainChatUI() {
    console.log('showMainChatUI: Displaying main chat UI.');
    hideModal(onboardingModal); // Ensure onboarding modal is hidden
    if (mainChatUI) { // Check if main chat UI element exists
        mainChatUI.classList.remove('hidden'); // Show the main chat UI
    }
    switchChatMode(currentChatMode); // Apply current chat mode UI settings
}

/**
 * Shows a specific onboarding step and hides all other steps.
 * Also adjusts modal height and button states.
 * @param {number} stepNum - The step number to display (1, 2, or 3).
 */
function showOnboardingStep(stepNum) {
    console.log(`showOnboardingStep: Showing step ${stepNum}.`);
    // Exit if trying to show the same step again
    if (stepNum === onboardingCurrentStep) return; 

    const steps = [onboardingStep1, onboardingStep2, onboardingStep3]; // Array of all onboarding step elements

    // Basic validation: ensure the target step element exists
    if (!steps[stepNum - 1]) {
        console.error(`showOnboardingStep: Onboarding step ${stepNum} element not found.`);
        return;
    }

    // Iterate through all steps to manage their visibility and positioning
    steps.forEach((step, index) => {
        if (step) { // Ensure step element is not null before manipulation
            if (index + 1 === stepNum) {
                step.classList.add('active'); // Add 'active' class to show this step
                step.style.position = 'relative'; // Make active step take up space in the modal flow
                console.log(`showOnboardingStep: Step ${index + 1} set to active and relative.`);
            } else {
                step.classList.remove('active'); // Remove 'active' class from other steps to hide them
                step.style.position = 'absolute'; // Position inactive steps absolutely to remove them from document flow
                console.log(`showOnboardingStep: Step ${index + 1} set to inactive and absolute.`);
            }
        }
    });
    onboardingCurrentStep = stepNum; // Update the current onboarding step in state

    // Dynamically adjust the modal's height to fit the content of the currently active step
    const modalContent = onboardingModal?.querySelector('.modal-content');
    const activeStepElement = steps[stepNum - 1]; // Get the currently active step element
    if (modalContent && activeStepElement) {
        // Set minHeight to allow content to push height, and height to auto for responsiveness
        modalContent.style.minHeight = `${activeStepElement.scrollHeight + 100}px`;
        modalContent.style.height = 'auto';
        console.log(`showOnboardingStep: Modal height adjusted to ${modalContent.style.minHeight}.`);
    }

    // Re-evaluate the disabled state of the 'Next' and 'Finish' buttons based on input validity
    if (onboardingUserNameInput) onboardingNext1.disabled = onboardingUserNameInput.value.trim().length === 0;
    if (onboardingUserHobbiesInput) onboardingNext2.disabled = onboardingUserHobbiesInput.value.trim().length === 0;
    if (onboardingPartnerNameInput) onboardingFinish.disabled = onboardingPartnerNameInput.value.trim().length === 0;
    console.log(`showOnboardingStep: Button states updated for step ${stepNum}.`);
}

/**
 * Hides the onboarding modal, shows the main chat UI, and then delivers the personalized welcome.
 */
async function hideOnboardingAndShowChat() {
    console.log('hideOnboardingAndChat: Hiding onboarding, showing chat.');
    hideModal(onboardingModal); // Hide the onboarding modal
    showMainChatUI(); // Display the main chat interface
    isInitialWelcomeDelivered = false; // Reset flag to ensure welcome plays
    await deliverPersonalizedWelcome(); // Deliver the welcome message
}

/**
 * Toggles the Web Speech Recognition (microphone input) on or off.
 * Handles starting and stopping the recognition process.
 */
function toggleSpeechRecognition() {
    console.log('toggleSpeechRecognition: Toggling microphone. Current recording state:', isRecording);
    // Check if Speech Recognition API is supported and microphone button is not disabled
    if (!speechRecognition || (micButton && micButton.disabled)) {
        alertUser('Microphone input is currently unavailable or unsupported by your browser.');
        return;
    }

    if (isRecording) {
        // If currently recording, stop the speech recognition
        speechRecognition.stop();
        if (userInput) userInput.value = ''; // Clear "Listening..." text from input
        console.log('toggleSpeechRecognition: Microphone stopped.');
    } else {
        // If not recording, start the speech recognition
        speechRecognition.lang = currentLanguage; // Set the language for recognition
        try {
            speechRecognition.start(); // Attempt to start the recognition service
            // UI updates for recording state (like changing button icon/class) are handled by
            // the `onstart` and `onend` event handlers for better synchronization.
            console.log('toggleSpeechRecognition: Microphone started.');
        } catch (error) {
            // Catch errors during speech recognition start (e.g., microphone access denied)
            console.error('toggleSpeechRecognition: Error starting speech recognition:', error);
            alertUser('Failed to start speech recognition. Please ensure microphone access is granted and try again.');
            // Reset UI on error
            if (micButton) {
                micButton.classList.remove('recording');
                micButton.innerHTML = '<i class="fas fa-microphone text-xl"></i>';
            }
            isRecording = false; // Ensure state is reset
        }
    }
    // `isRecording` state is managed by `onstart` and `onend` callbacks of `speechRecognition`.
}

/**
 * Initializes the Web Speech Recognition API, setting up its event handlers.
 * This should be called once when the DOM is ready.
 */
function initSpeechRecognition() {
    console.log('initSpeechRecognition: Initializing speech recognition...');
    // Check for browser support of SpeechRecognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false; // Set to false to stop after a single utterance
        speechRecognition.interimResults = false; // Do not return interim (partial) results
        speechRecognition.lang = currentLanguage; // Set initial recognition language

        // Event handler when speech recognition starts
        speechRecognition.onstart = () => {
            console.log('SpeechRecognition: started.');
            isRecording = true; // Update global state
            if (micButton) {
                micButton.classList.add('recording'); // Apply recording style
                micButton.innerHTML = '<i class="fas fa-microphone-alt-slash text-xl"></i>'; // Change icon
            }
            if (userInput) {
                userInput.value = currentLanguage === 'en-US' ? 'Listening...' : 'सुन रहा हूँ...'; // Indicate listening
                userInput.focus(); // Keep focus on input field
            }
            setSendButtonState(false); // Disable send button while recording
        };

        // Event handler when a final speech recognition result is available
        speechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript; // Get the recognized text
            console.log('SpeechRecognition: result ->', transcript);
            if (userInput) userInput.value = transcript; // Display transcript in input field
            processUserInput(transcript); // Process the user's spoken input
            // The `onend` event will automatically be triggered after `onresult` for non-continuous recognition.
        };

        // Event handler when speech recognition ends (either by stop() or automatically)
        speechRecognition.onend = () => {
            console.log('SpeechRecognition: ended.');
            isRecording = false; // Update global state
            if (micButton) {
                micButton.classList.remove('recording'); // Remove recording style
                micButton.innerHTML = '<i class="fas fa-microphone text-xl"></i>'; // Restore icon
            }
            if (userInput) {
                // Clear "Listening..." text only if no actual input was captured
                if (userInput.value === 'Listening...' || userInput.value === 'सुन रहा हूँ...') {
                    userInput.value = '';
                }
            }
            // Re-enable send button based on current mode and input content
            setSendButtonState(currentChatMode === 'type' && userInput.value.trim().length > 0); 
        };

        // Event handler for errors during speech recognition
        speechRecognition.onerror = (event) => {
            console.error('SpeechRecognition: error ->', event.error);
            isRecording = false; // Reset state on error
            if (micButton) {
                micButton.classList.remove('recording');
                micButton.innerHTML = '<i class="fas fa-microphone text-xl"></i>';
            }
            if (userInput) userInput.value = ''; // Clear input field on error
            // Re-enable send button based on current mode and input content
            setSendButtonState(currentChatMode === 'type' && userInput.value.trim().length > 0); 

            // Provide specific alerts for common errors
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                alertUser('Microphone access denied. Please allow microphone access in your browser settings to use voice chat.');
            } else if (event.error === 'no-speech') {
                console.warn('SpeechRecognition: No speech detected.'); // No alert for "no speech" to avoid annoyance
            } else {
                alertUser(`Speech recognition error: ${event.error}`);
            }
        };
        console.log('initSpeechRecognition: Speech recognition setup complete (if supported).');
    } else {
        console.warn('SpeechRecognition not supported in this browser.');
        // Disable microphone-related UI if API is not supported
        if (micButton) {
            micButton.disabled = true;
            micButton.title = 'Speech recognition not supported';
        }
        if (voiceChatModeBtn) voiceChatModeBtn.disabled = true;
        alertUser('Your browser does not support Web Speech Recognition. Only text input is available.');
        currentChatMode = 'type'; // Force to type mode if voice isn't supported
        switchChatMode('type'); // Update UI to text input mode
    }
}

/**
 * Switches the chat mode between 'voice' and 'type'.
 * Updates UI elements (input field, buttons) accordingly.
 * @param {string} mode - The desired chat mode ('voice' or 'type').
 */
function switchChatMode(mode) {
    console.log(`switchChatMode: Switching to ${mode} mode.`);
    currentChatMode = mode; // Update global state

    // Update active/inactive styles for mode buttons
    if (voiceChatModeBtn) voiceChatModeBtn.classList.toggle('active', mode === 'voice');
    if (typeChatModeBtn) typeChatModeBtn.classList.toggle('active', mode === 'type');

    // Toggle visibility of input field and microphone/send button container
    if (mode === 'voice') {
        if (userInput) userInput.classList.add('hidden'); // Hide text input
        if (micAndSendContainer) micAndSendContainer.classList.remove('hidden'); // Show mic and send buttons
        // Mic button enabled only if Speech Recognition is supported
        if (micButton) micButton.disabled = !speechRecognition; 
        if (sendButton) setSendButtonState(false); // Send button is for text, disable in voice mode
        if (userInput) userInput.value = ''; // Clear text input content
        if (isRecording) { // If currently recording, stop it when switching modes
            speechRecognition.stop(); // This will trigger `onend`, resetting UI
        }
    } else { // mode === 'type'
        if (userInput) userInput.classList.remove('hidden'); // Show text input
        if (micAndSendContainer) micAndSendContainer.classList.add('hidden'); // Hide mic and send buttons
        // Send button enabled if there's text in the input
        if (sendButton) setSendButtonState(userInput.value.trim().length > 0); 
        if (isRecording) { // If currently recording, stop it when switching modes
            speechRecognition.stop(); // This will trigger `onend`, resetting UI
        }
    }
    // Set focus to the text input field if in type mode
    if (mode === 'type' && userInput) {
        userInput.focus();
    }
}

/**
 * Sets the disabled state of the send button.
 * @param {boolean} enable - True to enable the button, false to disable.
 */
function setSendButtonState(enable) {
    if (sendButton) {
        sendButton.disabled = !enable; // Set disabled property
        sendButton.style.cursor = enable ? 'pointer' : 'not-allowed'; // Update cursor style
    }
}

/**
 * Creates and appends a message bubble to the chat box.
 * Includes logic for displaying corrections and play audio buttons.
 * Also stores the message in `chatHistory`.
 * @param {string} text - The main message text (e.g., AI's conversational response).
 * @param {string} sender - 'user' or 'ai'.
 * @param {string} [correctedOriginalText] - The user's original text if the AI corrected it.
 * @param {string} [correctionExplanation] - A brief explanation for the correction.
 * @param {boolean} [doNotSave=false] - If true, the message will not be added to chatHistory or saved.
 */
function addMessage(text, sender, correctedOriginalText = null, correctionExplanation = null, doNotSave = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    // Use first letter of user's name or partner's name for avatar, or fallback 'U'/'A'
    avatarDiv.textContent = sender === 'user' ? (userSettings.userName.charAt(0).toUpperCase() || 'U') : (userSettings.partnerName.charAt(0).toUpperCase() || 'A');

    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('message-bubble');

    const messageParagraph = document.createElement('p');
    messageParagraph.textContent = text; // Set the main message text

    // Append the main message paragraph to the bubble
    bubbleDiv.appendChild(messageParagraph);

    // Logic for displaying corrections and explanations (for AI messages only)
    // Show correction info only if it's an AI message AND correctedOriginalText is not null AND correctionExplanation is meaningful
    if (sender === 'ai' && correctedOriginalText !== null && correctionExplanation && correctionExplanation !== 'None') {
        const correctionInfoSpan = document.createElement('span');
        correctionInfoSpan.classList.add('text-sm', 'text-gray-600', 'mt-1', 'block'); // Smaller, slightly dimmed text
        // Use a wrapper with tooltip for the original text and explanation
        correctionInfoSpan.innerHTML = `
            <span class="correction-wrapper cursor-help border-b border-dotted border-gray-500">
                Original: "${correctedOriginalText}"
                <span class="correction-tooltip bg-gray-800 text-white p-2 rounded-lg text-xs absolute z-10 bottom-full left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal">
                    Explanation: ${correctionExplanation}
                </span>
            </span>`;
        bubbleDiv.appendChild(correctionInfoSpan); // Add the correction info below the main response
    }
    
    // Add play audio button only for AI messages
    if (sender === 'ai') {
        const playButton = document.createElement('button');
        playButton.classList.add('play-audio-btn', 'mt-1', 'mr-1', 'self-end'); // Align to the right/end of bubble
        playButton.innerHTML = '<i class="fas fa-volume-up"></i>'; // Initial icon
        playButton.title = 'Play Audio';
        // Store the actual conversational response text in a data attribute for TTS playback
        playButton.setAttribute('data-text-to-speak', text); 
        bubbleDiv.appendChild(playButton);
    }

    const timestampDiv = document.createElement('div');
    timestampDiv.classList.add('message-timestamp');
    timestampDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Current time

    bubbleDiv.appendChild(timestampDiv); // Add timestamp to bubble

    // Append avatar and bubble to the main message div based on sender
    if (sender === 'user') {
        messageDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(avatarDiv);
    } else {
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(bubbleDiv);
    }

    chatBox.appendChild(messageDiv); // Add message to the chat box
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom to show new message

    // NEW: Add message to global chat history and save to localStorage
    if (!doNotSave) {
        const messageObject = {
            text: text,
            sender: sender,
            timestamp: new Date().toISOString(), // ISO string for consistent storage
            correctedOriginalText: correctedOriginalText,
            correctionExplanation: correctionExplanation
        };
        chatHistory.push(messageObject);
        // Trim history if it exceeds limit
        if (chatHistory.length > MAX_CHAT_HISTORY_LENGTH) {
            chatHistory = chatHistory.slice(chatHistory.length - MAX_CHAT_HISTORY_LENGTH);
        }
        saveChatHistory(); // Save to localStorage after adding
    }
}

/**
 * Displays a typing indicator (three pulsing dots) in the chat box.
 * @returns {HTMLElement} The created typing indicator element.
 */
function showTypingIndicator() {
    const typingIndicatorDiv = document.createElement('div');
    typingIndicatorDiv.id = 'typing-indicator'; // Unique ID for easy removal
    typingIndicatorDiv.classList.add('ai-message', 'message'); // Style as an AI message
    
    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar');
    avatarDiv.textContent = userSettings.partnerName.charAt(0).toUpperCase() || 'A'; // Partner's avatar
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('message-bubble', 'flex', 'items-center', 'space-x-1'); // Styling for dots

    // Create three pulsing dots for the typing indicator
    for (let i = 1; i <= 3; i++) {
        const dot = document.createElement('span');
        dot.classList.add('typing-dot', 'w-2', 'h-2', 'bg-gray-500', 'rounded-full', `animate-bounce-${i}`);
        bubbleDiv.appendChild(dot);
    }

    typingIndicatorDiv.appendChild(avatarDiv);
    typingIndicatorDiv.appendChild(bubbleDiv);

    chatBox.appendChild(typingIndicatorDiv); // Add to chat box
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
    return typingIndicatorDiv; // Return the element for later removal
}

/**
 * Removes a specific typing indicator from the chat box.
 * @param {HTMLElement} indicatorElement - The typing indicator element to remove.
 */
function hideTypingIndicator(indicatorElement) {
    if (indicatorElement && chatBox.contains(indicatorElement)) {
        chatBox.removeChild(indicatorElement); // Remove element from DOM
    }
}

/**
 * Sends user input to the Gemini API directly from the frontend for processing.
 * Handles displaying typing indicators, AI responses, and triggering TTS.
 * @param {string} text - The user's input text to send to the AI.
 */
async function processUserInput(text) {
    console.log('processUserInput: Processing user input:', text);
    addMessage(text, 'user'); // Add user's message to the chat display

    if (userInput) userInput.value = ''; // Clear the user input field after sending

    // Disable all interactive UI elements to prevent further input during AI processing
    if (userInput) userInput.disabled = true;
    if (micButton) micButton.disabled = true;
    if (sendButton) sendButton.disabled = true;
    if (languageToggle) languageToggle.disabled = true;
    if (settingsButton) settingsButton.disabled = true;
    if (voiceChatModeBtn) voiceChatModeBtn.disabled = true;
    if (typeChatModeBtn) typeChatModeBtn.disabled = true;

    const typingIndicator = showTypingIndicator(); // Show the typing animation

    try {
        // Construct the prompt for Gemini
        const promptTemplate = `You are a friendly and encouraging language partner. The user is practicing either Hindi or English.
Your primary tasks are:
1.  **Correct Grammar:** If the user's sentence has grammatical errors or unnatural phrasing, provide the corrected version.
2.  **Explain Briefly:** If you made a correction, give a very brief explanation of *why* it was corrected (e.g., "tense correction", "word order"). If no correction is needed, state that the original sentence was correct.
3.  **Conversational Response:** Provide a friendly, natural, and concise conversational response to the user's input, engaging them further.

Output your response in the exact following JSON-like format to facilitate parsing:
CORRECTED: [corrected or original sentence] (Explanation: [brief explanation or "None"])
RESPONSE: [your conversational response]

Example if correction is needed:
CORRECTED: I am going to the store. (Explanation: Subject-verb agreement)
RESPONSE: That's great! What are you planning to buy there?

Example if no correction is needed:
CORRECTED: I went to the park. (Explanation: None)
RESPONSE: Oh, how wonderful! Did you have a good time?

Now, please respond to: "%s"`;

        const prompt = promptTemplate.replace("%s", text);

        // Prepare chat history for Gemini API (last few turns for context)
        const chatHistoryForGemini = [];
        // Limit to last 20 messages (approx. 10 turns of user/model messages) for context window
        // Ensure user/model roles alternate correctly
        const historyToSend = chatHistory.slice(Math.max(0, chatHistory.length - 20)); 

        historyToSend.forEach(msg => {
            chatHistoryForGemini.push({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            });
        });

        // Add the current user input as the last message in the history for Gemini
        chatHistoryForGemini.push({
            role: 'user',
            parts: [{ text: prompt }] 
        });

        const payload = {
            contents: chatHistoryForGemini, // This is the key change for sending history
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 200,
            }
        };

        // Gemini API Endpoint
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

        // Send request to Gemini API
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) { // Check for HTTP errors from Gemini API
            const errorDetails = await geminiResponse.text();
            throw new Error(`Gemini API request failed with HTTP code ${geminiResponse.status}. Details: ${errorDetails}`);
        }

        const geminiData = await geminiResponse.json(); // Parse the JSON response from Gemini
        console.log('processUserInput: Gemini Response received:', geminiData);

        hideTypingIndicator(typingIndicator); // Hide typing indicator once response is received

        // Check for specific Gemini API errors (e.g., if API_KEY is invalid or missing)
        if (geminiData.error) {
            addMessage(`Error from AI: ${geminiData.error.message || 'Unknown API error'}`, 'ai');
            alertUser(`An error occurred with Gemini API: ${geminiData.error.message || 'Unknown error'}. Please check your API key.`);
            return;
        }
        
        // Extract the text content from Gemini's response structure
        let geminiText = geminiData.candidates && geminiData.candidates.length > 0 &&
                           geminiData.candidates[0].content && geminiData.candidates[0].content.parts &&
                           geminiData.candidates[0].content.parts.length > 0
                           ? geminiData.candidates[0].content.parts[0].text
                           : '';

        if (!geminiText) {
            alertUser('AI response was empty or malformed.');
            addMessage('AI response was empty or malformed.', 'ai');
            return;
        }

        // NEW: Attempt to parse the response as JSON first
        let parsedAiResponse = {};
        let conversationalResponse = '';
        let correctedText = null;
        let correctionExplanation = null;

        // Try to strip markdown JSON code block wrappers if present
        const jsonBlockRegex = /```json\n([\s\S]*?)\n```/;
        const jsonMatch = geminiText.match(jsonBlockRegex);
        const contentToParse = jsonMatch ? jsonMatch[1] : geminiText;

        try {
            parsedAiResponse = JSON.parse(contentToParse);
            // If successfully parsed as JSON, extract fields
            conversationalResponse = parsedAiResponse.RESPONSE || '';
            correctedText = parsedAiResponse.CORRECTED || text; // Default to original if corrected is missing
            correctionExplanation = parsedAiResponse.Explanation || 'None';
            
            // Clean up explanation if it's "None" or empty
            if (correctionExplanation.toLowerCase() === 'none' || correctionExplanation.trim() === '') {
                correctionExplanation = null;
            }

        } catch (jsonError) {
            console.warn("processUserInput: Failed to parse AI response as JSON. Falling back to regex. Error:", jsonError);
            // Fallback if JSON.parse fails: attempt to extract using the previous regex for plain text format
            const structuredRegex = /CORRECTED: (.*?)(?:\s+\(Explanation: (.*?)\))?\s+RESPONSE: (.*)/s;
            const regexMatch = contentToParse.match(structuredRegex);

            if (regexMatch) {
                correctedText = regexMatch[1] ? regexMatch[1].trim() : text;
                correctionExplanation = regexMatch[2] ? regexMatch[2].trim() : 'None';
                conversationalResponse = regexMatch[3] ? regexMatch[3].trim() : '';

                if (correctionExplanation.toLowerCase() === 'none' || correctionExplanation.trim() === '') {
                    correctionExplanation = null;
                }
            } else {
                // Absolute fallback: If no "RESPONSE:" tag found even in plain text, assume the entire original AI output is the response
                // Do not prefix with "AI Response (format unexpected)" for cleaner look
                conversationalResponse = geminiText.trim(); 
                correctedText = null; 
                correctionExplanation = null;
                console.warn("processUserInput: Failed to parse AI response with any expected format. Displaying raw text.");
            }
        }

        // Ensure conversational response is not empty before adding
        if (conversationalResponse.trim() === '') {
             conversationalResponse = "I'm sorry, I couldn't generate a clear response. Could you please try again?";
             correctedText = null;
             correctionExplanation = null;
        }

        // Add the AI's conversational response to the chat, including correction info
        addMessage(conversationalResponse, 'ai', correctedText, correctionExplanation);

        // Find the play button of the newly added AI message for audio playback
        const lastAIMessageBubble = chatBox?.lastElementChild?.querySelector('.message-bubble');
        const playButton = lastAIMessageBubble?.querySelector('.play-audio-btn');

        if (playButton) {
            // Play the AI's response as speech using the browser's Speech Synthesis API
            await playAudioWithSpeechSynthesis(conversationalResponse, playButton, () => {
                // After AI's speech finishes, auto-start microphone if in voice chat mode,
                // and mic is not disabled, and not already recording.
                if (currentChatMode === 'voice' && micButton && !micButton.disabled && !isRecording) {
                    setTimeout(toggleSpeechRecognition, 500); // Small delay for smoother UX
                }
            });
            console.log('processUserInput: Playing AI audio response and setting up mic restart.');
        } else {
            console.error("processUserInput: Could not find play button in the last AI message, cannot auto-play.");
            // If no play button, still try to restart mic if voice mode
            if (currentChatMode === 'voice' && micButton && !micButton.disabled && !isRecording) {
                setTimeout(toggleSpeechRecognition, 500);
            }
        }

    } catch (error) { // Catch any network or client-side processing errors
        console.error('processUserInput: Error during AI processing:', error);
        alertUser(`Failed to get response from AI: ${error.message}`);
        hideTypingIndicator(typingIndicator); // Ensure indicator is hidden on error
    } finally {
        // Re-enable all interactive UI elements after processing
        if (userInput) userInput.disabled = false;
        if (micButton) micButton.disabled = false;
        // Enable send button only if in type mode AND there's text in the input
        if (sendButton) setSendButtonState(currentChatMode === 'type' && userInput.value.trim().length > 0); 
        if (languageToggle) languageToggle.disabled = false;
        if (settingsButton) settingsButton.disabled = false;
        if (voiceChatModeBtn) voiceChatModeBtn.disabled = false;
        if (typeChatModeBtn) typeChatModeBtn.disabled = false;
        console.log('processUserInput: Interaction elements re-enabled.');
    }
}

/**
 * Plays audio using the browser's native Web Speech Synthesis API.
 * This replaces the backend TTS call.
 * @param {string} textToSpeak - The text content to convert to speech.
 * @param {HTMLElement} playButton - The button element associated with the playback (to disable/enable).
 * @param {Function} [onEndCallback] - Optional callback to execute after speech finishes.
 */
function playAudioWithSpeechSynthesis(textToSpeak, playButton, onEndCallback = null) {
    console.log('playAudioWithSpeechSynthesis: Attempting client-side TTS playback for:', textToSpeak.substring(0, Math.min(textToSpeak.length, 50)) + '...');
    
    // Check if Web Speech Synthesis API is supported by the browser
    if (!('speechSynthesis' in window)) {
        alertUser('Your browser does not support Web Speech Synthesis for audio output. Audio playback unavailable.');
        if (onEndCallback) onEndCallback(); // Still call callback even if not supported
        return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak); // Create a new utterance object
    utterance.lang = currentLanguage; // Set the language for the speech

    const voices = speechSynthesis.getVoices(); // Get available voices from the browser
    let selectedVoice = null;
    // Filter voices by the current language (matching language code prefix, e.g., 'en' for 'en-US')
    const langVoices = voices.filter(voice => voice.lang.startsWith(currentLanguage.substring(0,2))); 

    if (langVoices.length > 0) {
        // Prioritize Google/Wavenet voices or default, then any voice for the language
        selectedVoice = langVoices.find(voice => voice.name.includes('Google') || voice.name.includes('Wavenet') || voice.default) || langVoices[0];
    } else {
        selectedVoice = voices.find(voice => voice.default) || voices[0]; // Fallback to browser default or first voice
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice; // Set the chosen voice
        console.log('playAudioWithSpeechSynthesis: Using voice:', selectedVoice.name, 'for lang:', selectedVoice.lang);
    } else {
        console.warn('playAudioWithSpeechSynthesis: No suitable voice found for', currentLanguage, '. Using default browser voice.');
    }

    utterance.pitch = 1; // Normal pitch
    utterance.rate = 1;  // Normal rate

    if (playButton) {
        playButton.innerHTML = '<i class="fas fa-volume-mute"></i>'; // Change icon to 'mute' during playback
        playButton.disabled = true; // Disable the button to prevent multiple clicks
    }

    // Event handler for when the speech finishes
    utterance.onend = () => {
        console.log('playAudioWithSpeechSynthesis: Audio playback ended.');
        if (playButton) {
            playButton.innerHTML = '<i class="fas fa-volume-up"></i>'; // Restore icon
            playButton.disabled = false; // Re-enable button
        }
        if (onEndCallback) onEndCallback(); // Execute the provided callback function
    };

    // Event handler for errors during speech synthesis
    utterance.onerror = (event) => {
        console.error('playAudioWithSpeechSynthesis: SpeechSynthesisUtterance error:', event);
        alertUser('An error occurred during audio playback via Web Speech Synthesis.');
        if (playButton) {
            playButton.innerHTML = '<i class="fas fa-volume-up"></i>'; // Restore icon
            playButton.disabled = false; // Re-enable button
        }
        if (onEndCallback) onEndCallback(); // Still call callback on error
    };

    // If there's currently speech being spoken, cancel it before starting a new one
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        console.log('playAudioWithSpeechSynthesis: Canceled previous speech.');
    }
    speechSynthesis.speak(utterance); // Start speaking the utterance
}

/**
 * Delivers a personalized welcome message from the AI partner based on user settings.
 * This message is spoken and added to the chat.
 */
async function deliverPersonalizedWelcome() {
    // Only deliver welcome message if no prior chat history exists, or if explicitly reset (e.g., language change)
    if (isInitialWelcomeDelivered && chatHistory.length > 0) {
        console.log('deliverPersonalizedWelcome: Welcome already delivered and history exists. Skipping.');
        return; 
    }
    
    console.log('deliverPersonalizedWelcome: Delivering personalized welcome.');
    
    // Construct welcome text using personalized settings
    const userName = userSettings.userName === 'there' ? 'there' : userSettings.userName;
    const partnerName = userSettings.partnerName || 'Buddy';
    const hobbies = userSettings.userHobbies === 'learning new things' ? 'learning new things' : userSettings.userHobbies; 

    let welcomeTextPart1 = '';
    let welcomeTextPart2 = '';

    // Localize welcome messages based on current language
    if (currentLanguage === 'en-US') {
        welcomeTextPart1 = `Hello ${userName}! I'm ${partnerName}, your language partner.`;
        welcomeTextPart2 = `I'm here to help you practice English or Hindi. You can speak or type, and I'll give you grammar corrections and natural responses. Let's start practicing! What are you interested in today, maybe something about ${hobbies}?`;
    } else { // Hindi
        welcomeTextPart1 = `नमस्ते ${userName}! मैं ${partnerName} हूँ, आपकी भाषा साथी।`;
        welcomeTextPart2 = `मैं आपको हिंदी या अंग्रेजी का अभ्यास करने में मदद करने के लिए यहाँ हूँ। आप बोल सकते हैं या टाइप कर सकते हैं, और मैं आपको व्याकरण सुधार और स्वाभाविक प्रतिक्रियाएँ दूँगा। आइए अभ्यास करना शुरू करें! आज आपकी किस में रुचि है, शायद ${hobbies} के बारे में कुछ?`;
    }

    if (chatBox) chatBox.innerHTML = ''; // Clear previous chat messages

    // Add first part of welcome message to chat display (this also saves to history)
    addMessage(welcomeTextPart1, 'ai');
    const firstAIMessageBubble = chatBox?.lastElementChild?.querySelector('.message-bubble');
    const firstPlayButton = firstAIMessageBubble?.querySelector('.play-audio-btn');

    // Play first part of welcome message and wait for it to finish
    await new Promise(resolve => {
        if (firstPlayButton) {
            playAudioWithSpeechSynthesis(welcomeTextPart1, firstPlayButton, resolve);
        } else {
            console.warn("First welcome message play button not found, skipping audio for part 1.");
            resolve(); // Resolve immediately if button not found
        }
    });

    // Add second part of welcome message to chat display (this also saves to history)
    addMessage(welcomeTextPart2, 'ai');
    const secondAIMessageBubble = chatBox?.lastElementChild?.querySelector('.message-bubble');
    const secondPlayButton = secondAIMessageBubble?.querySelector('.play-audio-btn');

    // Play second part of welcome message and wait for it to finish
    await new Promise(resolve => {
        if (secondPlayButton) {
            playAudioWithSpeechSynthesis(welcomeTextPart2, secondPlayButton, () => {
                // After the *entire* welcome message finishes, auto-start microphone if:
                // 1. Current mode is voice chat.
                // 2. Microphone button exists and is not disabled.
                // 3. Not already recording.
                if (currentChatMode === 'voice' && micButton && !micButton.disabled && !isRecording) {
                    setTimeout(toggleSpeechRecognition, 500); // Small delay for smooth transition
                }
                resolve();
            });
        } else {
            console.warn("Second welcome message play button not found, skipping audio for part 2.");
            // Still attempt to start mic if conditions met, even without audio playback
            if (currentChatMode === 'voice' && micButton && !micButton.disabled && !isRecording) {
                setTimeout(toggleSpeechRecognition, 500); 
            }
            resolve();
        }
    });

    isInitialWelcomeDelivered = true; // Mark welcome as delivered
    console.log('deliverPersonalizedWelcome: Personalized welcome delivered and mic initiated (if applicable).');
}


// --- Event Listeners (Initialized AFTER all functions are defined) ---

// Event listener for when the entire DOM content is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded: Script started.');

    initSpeechRecognition(); // Initialize Web Speech Recognition API

    loadUserSettings(); // Load user settings from localStorage (no longer async)
    loadChatHistory(); // NEW: Load chat history from localStorage

    // Determine whether to show the onboarding modal or the main chat UI
    // Show onboarding if user's name or partner's name are still default values
    if (userSettings.userName === 'there' || userSettings.partnerName === 'Buddy') {
        console.log('DOMContentLoaded: Default settings detected, showing onboarding modal.');
        showModal(onboardingModal); // Show onboarding modal
        showOnboardingStep(1); // Start with the first step of onboarding
    } else {
        console.log('DOMContentLoaded: Existing settings found, showing main chat UI.');
        showMainChatUI(); // Show main chat interface
        // Only deliver personalized welcome if chat history is empty, otherwise rely on loaded history
        if (chatHistory.length === 0) {
            await deliverPersonalizedWelcome(); 
        } else {
            // If history exists, simply ensure mic starts if in voice mode (after a slight delay)
            if (currentChatMode === 'voice' && micButton && !micButton.disabled && !isRecording) {
                setTimeout(toggleSpeechRecognition, 1000); 
            }
        }
    }
    console.log('DOMContentLoaded: Initial UI display logic executed.');
});

// --- Onboarding Modal Event Listeners ---
// Ensure elements exist before attaching listeners
if (onboardingUserNameInput && onboardingNext1) {
    // Enable/disable 'Next' button for step 1 based on input content
    onboardingUserNameInput.addEventListener('input', () => {
        console.log('Onboarding Input: user-name, value length:', onboardingUserNameInput.value.trim().length);
        onboardingNext1.disabled = onboardingUserNameInput.value.trim().length === 0;
    });
    // Click listener for 'Next' button in step 1
    onboardingNext1.addEventListener('click', () => {
        showOnboardingStep(2); // Advance to step 2
    });
} else { console.warn("Onboarding Step 1 elements not found during DOMContentLoaded. Check HTML IDs."); }

if (onboardingUserHobbiesInput && onboardingNext2) {
    // Enable/disable 'Next' button for step 2 based on input content
    onboardingUserHobbiesInput.addEventListener('input', () => {
        console.log('Onboarding Input: user-hobbies, value length:', onboardingUserHobbiesInput.value.trim().length);
        onboardingNext2.disabled = onboardingUserHobbiesInput.value.trim().length === 0;
    });
    // Click listener for 'Next' button in step 2
    onboardingNext2.addEventListener('click', () => {
        showOnboardingStep(3); // Advance to step 3
    });
} else { console.warn("Onboarding Step 2 elements not found during DOMContentLoaded. Check HTML IDs."); }

if (onboardingPartnerNameInput && onboardingFinish) {
    // Enable/disable 'Let's Begin' button for step 3 based on input content
    onboardingPartnerNameInput.addEventListener('input', () => {
        console.log('Onboarding Input: partner-name, value length:', onboardingPartnerNameInput.value.trim().length);
        onboardingFinish.disabled = onboardingPartnerNameInput.value.trim().length === 0;
    });
    // Click listener for 'Let's Begin' button in step 3
    onboardingFinish.addEventListener('click', async () => {
        saveUserSettings(true); // Save settings (from onboarding) - now synchronous
        hideOnboardingAndChat(); // Hide onboarding and show main chat
    });
} else { console.warn("Onboarding Step 3 elements not found during DOMContentLoaded. Check HTML IDs."); }


// --- Main Chat UI Event Listeners ---

// Microphone button click handler
if (micButton) {
    micButton.addEventListener('click', toggleSpeechRecognition);
}

// Send button click handler for text input
if (sendButton) {
    sendButton.addEventListener('click', () => {
        // Only process if there's actual text input
        if (userInput && userInput.value.trim() !== '') {
            processUserInput(userInput.value.trim());
        } else {
            alertUser('Please enter some text before sending.');
        }
    });
}

// Keyboard event listener for the text input field (e.g., 'Enter' key)
if (userInput) {
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default Enter key behavior (e.g., new line)
            // Only process if there's actual text input
            if (userInput.value.trim() !== '') {
                processUserInput(userInput.value.trim());
            } else {
                alertUser('Please enter some text before sending.');
            }
        }
    });
    // Input event listener to dynamically enable/disable the send button in type mode
    userInput.addEventListener('input', () => {
        if (currentChatMode === 'type') {
            setSendButtonState(userInput.value.trim().length > 0);
        }
    });
}

// Language toggle button handler
if (languageToggle) {
    languageToggle.addEventListener('click', () => {
        currentLanguage = (currentLanguage === 'en-US') ? 'hi-IN' : 'en-US'; // Toggle language code
        languageToggle.textContent = (currentLanguage === 'en-US') ? 'English ↔ Hindi' : 'हिंदी ↔ English'; // Update button text
        console.log('Language toggled to:', currentLanguage);

        // If Speech Recognition is active, update its language setting
        if (speechRecognition) {
            speechRecognition.lang = currentLanguage;
            // If mic was actively recording, stop it. The `onend` will then allow it to restart cleanly.
            if (isRecording) {
                speechRecognition.stop(); 
            }
        }
        // Update the placeholder text for the input field to match the new language
        if (userInput) {
            userInput.placeholder = currentLanguage === 'en-US' ? 'Type your message...' : 'अपना संदेश लिखें...';
        }
        
        // NEW: Clear existing chat history when language is toggled to start a fresh conversation in the new language
        chatHistory = [];
        localStorage.removeItem('languagePartnerChatHistory');
        if (chatBox) chatBox.innerHTML = ''; // Clear previous chat messages from display
        
        isInitialWelcomeDelivered = false; // Ensure welcome plays in new language
        deliverPersonalizedWelcome(); 
    });
}

// Chat mode buttons (Voice Chat / Type Chat) handlers
if (voiceChatModeBtn) {
    voiceChatModeBtn.addEventListener('click', () => switchChatMode('voice'));
}
if (typeChatModeBtn) {
    typeChatModeBtn.addEventListener('click', () => switchChatMode('type'));
}

// Settings button click handler
if (settingsButton) {
    settingsButton.addEventListener('click', openSettingsModal);
}

// Alert Modal 'OK' button handler
if (alertOkButton) {
    alertOkButton.addEventListener('click', () => hideModal(customAlertModal));
}

// Settings Modal 'Save Settings' and 'Cancel' button handlers
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => saveUserSettings(false)); // Call saveUserSettings, not from onboarding
}

// NEW: Handle Cancel button to revert input fields to the state when modal was opened
if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener('click', () => {
        console.log('cancelSettingsBtn: Cancelling changes and restoring temp settings.');
        // Restore input fields to the state they were in when the modal was opened (from tempSettings)
        if (settingsUserNameInput) settingsUserNameInput.value = tempSettings.userName === 'there' ? '' : tempSettings.userName;
        if (settingsUserHobbiesInput) settingsUserHobbiesInput.value = tempSettings.userHobbies === 'learning new things' ? '' : tempSettings.userHobbies;
        if (settingsPartnerNameInput) settingsPartnerNameInput.value = tempSettings.partnerName === 'Buddy' ? '' : tempSettings.partnerName;
        closeSettingsModal(); // Close the settings modal
    });
}

// Event delegation for dynamically added play audio buttons within the chat box
// This ensures new messages' play buttons also work
if (chatBox) {
    chatBox.addEventListener('click', (event) => {
        const playButton = event.target.closest('.play-audio-btn'); // Find the closest play button
        if (playButton) {
            // Retrieve the text to speak from the 'data-text-to-speak' attribute
            const textToSpeak = playButton.getAttribute('data-text-to-speak');
            if (textToSpeak) {
                playAudioWithSpeechSynthesis(textToSpeak, playButton, () => {
                    // After manual playback, auto-start mic if in voice chat mode and not already recording
                    if (currentChatMode === 'voice' && micButton && !micButton.disabled && !isRecording) {
                        setTimeout(toggleSpeechRecognition, 500); // Small delay
                    }
                });
            } else {
                console.warn("Could not find text to speak from data-text-to-speak attribute for audio playback.");
            }
        }
    });
}
