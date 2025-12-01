export class ChatManager {
    constructor() {
        this.conversations = new Map(); // subtopicId -> { messages: [], summary: "" }
        this.activeSubtopicId = null;
        this.sessionId = localStorage.getItem("sessionId");
        this.tokenLimit = 24000; // Approx 80% of Gemini context
        this.chatMessagesContainer = document.querySelector(".chat-messages");
        this.chatInput = document.querySelector(".chat-input input");
        this.sendButton = document.querySelector(".send-btn");
        this.fileInput = null;
        this.attachments = []; // Current attachments for the message being composed

        this.init();
    }

    init() {
        this.loadHistory();
        this.setupUI();
        this.setupEventListeners();
    }

    setupUI() {
        // Add file upload button to chat input
        const inputContainer = document.querySelector(".chat-input");

        // Create file input (hidden)
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = "image/jpeg,image/png,image/webp,application/pdf";
        this.fileInput.style.display = "none";
        this.fileInput.multiple = true; // Allow multiple files? Let's start with single for simplicity or multiple if easy.
        document.body.appendChild(this.fileInput);

        // Create upload trigger button
        const uploadBtn = document.createElement("button");
        uploadBtn.className = "upload-btn";
        uploadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
      </svg>
    `;
        inputContainer.insertBefore(uploadBtn, this.chatInput);

        // Create attachment preview area
        this.previewContainer = document.createElement("div");
        this.previewContainer.className = "attachment-previews";
        this.previewContainer.style.display = "none";
        // Insert before chat input container
        inputContainer.parentElement.insertBefore(this.previewContainer, inputContainer);

        // Bind upload button click
        uploadBtn.addEventListener("click", () => this.fileInput.click());

        // Bind file selection
        this.fileInput.addEventListener("change", (e) => this.handleFileSelect(e));
    }

    setupEventListeners() {
        this.sendButton.addEventListener("click", () => this.sendMessage());
        this.chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.sendMessage();
        });
        this.setupResizer();
    }

    setupResizer() {
        const resizer = document.getElementById("dragMe");
        const rightSidebar = document.querySelector(".right-sidebar");

        if (!resizer || !rightSidebar) return;

        let x = 0;
        let w = 0;

        const mouseDownHandler = (e) => {
            x = e.clientX;
            const sbWidth = window.getComputedStyle(rightSidebar).width;
            w = parseInt(sbWidth, 10);

            document.addEventListener("mousemove", mouseMoveHandler);
            document.addEventListener("mouseup", mouseUpHandler);
            resizer.classList.add("resizing");
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none"; // Prevent text selection
        };

        const mouseMoveHandler = (e) => {
            const dx = e.clientX - x;
            // Since sidebar is on the right, moving right (positive dx) decreases width
            const newWidth = w - dx;

            // Min width constraint (e.g., 250px)
            if (newWidth > 250 && newWidth < 800) {
                rightSidebar.style.width = `${newWidth}px`;
            }
        };

        const mouseUpHandler = () => {
            document.removeEventListener("mousemove", mouseMoveHandler);
            document.removeEventListener("mouseup", mouseUpHandler);
            resizer.classList.remove("resizing");
            document.body.style.removeProperty("cursor");
            document.body.style.removeProperty("user-select");
        };

        resizer.addEventListener("mousedown", mouseDownHandler);
    }

    loadHistory() {
        if (!this.sessionId) return;
        const history = localStorage.getItem(`chat_history_${this.sessionId}`);
        if (history) {
            try {
                const parsed = JSON.parse(history);
                // Convert object back to Map
                this.conversations = new Map(Object.entries(parsed));
            } catch (e) {
                console.error("Failed to load chat history", e);
            }
        }
    }

    saveHistory() {
        if (!this.sessionId) return;
        // Convert Map to object for storage
        const obj = Object.fromEntries(this.conversations);
        localStorage.setItem(`chat_history_${this.sessionId}`, JSON.stringify(obj));
    }

    switchToSubtopic(subtopicId) {
        this.activeSubtopicId = subtopicId;
        this.renderCurrentConversation();
        this.updateContextIndicator();
    }

    updateContextIndicator() {
        const header = document.querySelector(".right-sidebar-header h3");
        if (this.activeSubtopicId) {
            // Find subtopic name
            const activeItem = document.querySelector(`.subtopic-item[data-id="${this.activeSubtopicId}"]`);
            const name = activeItem ? activeItem.querySelector("span:last-child").textContent : "Unknown";
            header.innerHTML = `AI Assistant <span class="context-badge">${name}</span>`;
        } else {
            header.innerHTML = `AI Assistant`;
        }
    }

    renderCurrentConversation() {
        this.chatMessagesContainer.innerHTML = "";

        if (!this.activeSubtopicId) {
            this.renderSystemMessage("Select a subtopic to start chatting.");
            return;
        }

        const conv = this.conversations.get(this.activeSubtopicId) || { messages: [] };

        // If there is a summary, show it as a system message at the top
        if (conv.summary) {
            this.renderSystemMessage(`<i>Previous conversation summary:</i> ${conv.summary}`);
        }

        conv.messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
    }

    renderMessage(msg) {
        const div = document.createElement("div");
        div.className = `chat-message ${msg.role === "user" ? "user-message" : ""}`;

        let contentHtml = "";

        // Render attachments if any
        if (msg.attachments && msg.attachments.length > 0) {
            contentHtml += `<div class="message-attachments">`;
            msg.attachments.forEach(att => {
                if (att.mimeType.startsWith("image/")) {
                    contentHtml += `<img src="data:${att.mimeType};base64,${att.data}" class="attachment-thumb" />`;
                } else {
                    contentHtml += `<div class="attachment-file">📄 PDF Document</div>`;
                }
            });
            contentHtml += `</div>`;
        }

        // Render text with Markdown
        // Assuming 'marked' is available globally via CDN
        const textHtml = window.marked ? window.marked.parse(msg.content) : msg.content;

        contentHtml += `<div class="message-bubble ${msg.role === "user" ? "user-bubble" : ""}">${textHtml}</div>`;

        div.innerHTML = contentHtml;
        this.chatMessagesContainer.appendChild(div);

        // Render Math (KaTeX)
        if (window.renderMathInElement) {
            window.renderMathInElement(div, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }
    }

    renderSystemMessage(text) {
        const div = document.createElement("div");
        div.className = "chat-message system-message";
        div.innerHTML = `<div class="message-bubble system-bubble">${text}</div>`;
        this.chatMessagesContainer.appendChild(div);
    }

    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            // Validation
            if (file.size > 20 * 1024 * 1024) {
                this.showError(`File ${file.name} exceeds 20MB limit.`);
                continue;
            }

            try {
                const base64 = await this.fileToBase64(file);
                this.attachments.push({
                    name: file.name,
                    mimeType: file.type,
                    data: base64
                });
            } catch (e) {
                this.showError(`Failed to process ${file.name}`);
            }
        }

        this.updatePreview();
        this.fileInput.value = ""; // Reset input
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove data URL prefix (e.g., "data:image/png;base64,")
                const base64 = reader.result.split(",")[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    updatePreview() {
        this.previewContainer.innerHTML = "";
        if (this.attachments.length > 0) {
            this.previewContainer.style.display = "flex";
            this.attachments.forEach((att, index) => {
                const item = document.createElement("div");
                item.className = "preview-item";
                item.innerHTML = `
          <span class="preview-name">${att.name}</span>
          <button class="preview-remove">×</button>
        `;
                item.querySelector(".preview-remove").addEventListener("click", () => {
                    this.attachments.splice(index, 1);
                    this.updatePreview();
                });
                this.previewContainer.appendChild(item);
            });
        } else {
            this.previewContainer.style.display = "none";
        }
    }

    async sendMessage() {
        const text = this.chatInput.value.trim();
        if (!text && this.attachments.length === 0) return;
        if (!this.activeSubtopicId) {
            this.showError("Please select a subtopic first.");
            return;
        }

        // Prepare message object
        const userMsg = {
            role: "user",
            content: text,
            attachments: [...this.attachments], // Copy current attachments
            timestamp: new Date().toISOString()
        };

        // Add to local state
        this.addMessageToState(userMsg);
        this.renderMessage(userMsg);
        this.scrollToBottom();

        // Clear input
        this.chatInput.value = "";
        this.attachments = [];
        this.updatePreview();

        // Check context limit
        await this.checkContextLimit();

        // Get conversation context (summary + recent messages)
        const conv = this.conversations.get(this.activeSubtopicId);
        // We don't send the whole history to the API because the backend logic (questionAnswerer) 
        // currently only takes 'context' (static subtopic desc) and 'question'.
        // However, to support "chat", we should ideally send history. 
        // Since the backend `questionAnswerer.js` constructs a prompt with just `context` and `question`,
        // we need to inject our history into the `question` field or `context` field if we want the AI to see it.
        // Given the backend changes I made, it only accepts `attachments`.
        // STRATEGY: Prepend the summary/history to the 'question' sent to the API.

        let promptContext = "";
        if (conv.summary) {
            promptContext += `[Previous Summary: ${conv.summary}]\n`;
        }
        // Add last few messages for immediate context (e.g. last 2 exchanges)
        const recent = conv.messages.slice(-4, -1); // Exclude the one we just added
        if (recent.length > 0) {
            promptContext += `[Recent Chat History:\n${recent.map(m => `${m.role}: ${m.content}`).join("\n")}\n]\n`;
        }

        const fullQuestion = `${promptContext}\nUser: ${text}`;

        // Show loading indicator
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "chat-message loading-message";
        loadingDiv.innerHTML = `<div class="message-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
        this.chatMessagesContainer.appendChild(loadingDiv);
        this.scrollToBottom();

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:5000/api/questions/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    subtopicId: this.activeSubtopicId,
                    question: fullQuestion,
                    attachments: userMsg.attachments
                }),
            });

            if (!response.ok) throw new Error("Failed to get response");

            const data = await response.json();
            const answer = data.data.userQuestion.answer;

            // Remove loading
            loadingDiv.remove();

            const aiMsg = {
                role: "assistant",
                content: answer,
                timestamp: new Date().toISOString()
            };

            this.addMessageToState(aiMsg);
            this.renderMessage(aiMsg);
            this.scrollToBottom();

        } catch (error) {
            loadingDiv.remove();
            this.renderSystemMessage(`Error: ${error.message}`);
        }
    }

    addMessageToState(msg) {
        if (!this.conversations.has(this.activeSubtopicId)) {
            this.conversations.set(this.activeSubtopicId, { messages: [], summary: "" });
        }
        const conv = this.conversations.get(this.activeSubtopicId);
        conv.messages.push(msg);
        this.saveHistory();
    }

    async checkContextLimit() {
        const conv = this.conversations.get(this.activeSubtopicId);
        if (!conv) return;

        // Heuristic: 1 token ~ 4 chars
        const totalChars = conv.messages.reduce((acc, m) => acc + m.content.length, 0) + (conv.summary.length);
        const estTokens = totalChars / 4;

        if (estTokens > this.tokenLimit) {
            await this.summarizeContext();
        }
    }

    async summarizeContext() {
        this.renderSystemMessage("<i>Summarizing conversation to save memory...</i>");

        const conv = this.conversations.get(this.activeSubtopicId);
        const textToSummarize = conv.messages.map(m => `${m.role}: ${m.content}`).join("\n");

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:5000/api/questions/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    subtopicId: this.activeSubtopicId,
                    question: `Summarize the following conversation concisely, preserving key learning points:\n\n${textToSummarize}`
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const summary = data.data.userQuestion.answer;

                // Update state
                conv.summary = summary;
                conv.messages = []; // Clear messages
                this.saveHistory();

                // Refresh view
                this.renderCurrentConversation();
            }
        } catch (e) {
            console.error("Summarization failed", e);
        }
    }

    scrollToBottom() {
        this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
    }

    showError(msg) {
        // Simple toast or alert
        const toast = document.createElement("div");
        toast.className = "error-toast";
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}
