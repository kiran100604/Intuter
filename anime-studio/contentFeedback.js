/**
 * Content Feedback Component
 * Allows users to request missing content, alternative explanations, and more
 */

export class ContentFeedback {
  constructor() {
    this.sessionId = localStorage.getItem("sessionId");
    this.currentSubtopicId = null;
    this.injectStyles();
  }

  /**
   * Initialize feedback UI for a subtopic
   */
  init(subtopicId) {
    this.currentSubtopicId = subtopicId;
  }

  /**
   * Create and return the feedback bar HTML
   */
  createFeedbackBar() {
    return `
      <div class="content-feedback-bar">
        <button class="feedback-btn suggest-btn" onclick="window.contentFeedback.openSuggestModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Something Missing?
        </button>
        <button class="feedback-btn explain-btn" onclick="window.contentFeedback.openExplainModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="M9 9a3 3 0 1 1 6 0c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Explain Differently
        </button>
        <button class="feedback-btn save-btn" onclick="window.contentFeedback.quickSaveSelection()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save to Notes
        </button>
      </div>
    `;
  }

  /**
   * Open the "Something Missing?" modal
   */
  openSuggestModal() {
    if (!this.currentSubtopicId) {
      alert("Please select a subtopic first");
      return;
    }

    const modal = document.createElement("div");
    modal.className = "feedback-modal-overlay";
    modal.innerHTML = `
      <div class="feedback-modal">
        <div class="feedback-modal-header">
          <h3>Suggest Content</h3>
          <button class="modal-close" onclick="this.closest('.feedback-modal-overlay').remove()">×</button>
        </div>
        <div class="feedback-modal-body">
          <div class="form-group">
            <label>What type of content do you need?</label>
            <select id="request-type">
              <option value="missing_concept">Missing Concept - Something isn't covered</option>
              <option value="need_example">Need More Examples - Show me how it works</option>
              <option value="too_complex">Too Complex - I need simpler explanation</option>
              <option value="too_simple">Too Simple - I want more depth</option>
              <option value="add_diagram">Need Visual - Add diagram/graph</option>
              <option value="incorrect_content">Something's Wrong - Content seems incorrect</option>
            </select>
          </div>
          <div class="form-group">
            <label>Describe what you need:</label>
            <textarea id="request-description" rows="4" placeholder="Be specific about what's missing or what you'd like explained differently..."></textarea>
          </div>
          <div class="form-group">
            <label>Preferred explanation style (optional):</label>
            <select id="preferred-style">
              <option value="">Use default style</option>
              <option value="first_principles">First Principles - Build from fundamentals</option>
              <option value="example_driven">Example-Driven - Learn through examples</option>
              <option value="step_by_step">Step-by-Step - Clear procedural approach</option>
              <option value="visual">Visual - Diagrams and spatial thinking</option>
              <option value="analogy_based">Analogy-Based - Real-world comparisons</option>
            </select>
          </div>
        </div>
        <div class="feedback-modal-footer">
          <button class="btn-secondary" onclick="this.closest('.feedback-modal-overlay').remove()">Cancel</button>
          <button class="btn-primary" onclick="window.contentFeedback.submitRequest()">Submit Request</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Open the "Explain Differently" modal
   */
  openExplainModal() {
    if (!this.currentSubtopicId) {
      alert("Please select a subtopic first");
      return;
    }

    const modal = document.createElement("div");
    modal.className = "feedback-modal-overlay";
    modal.innerHTML = `
      <div class="feedback-modal">
        <div class="feedback-modal-header">
          <h3>Explain Differently</h3>
          <button class="modal-close" onclick="this.closest('.feedback-modal-overlay').remove()">×</button>
        </div>
        <div class="feedback-modal-body">
          <p class="modal-description">Get a fresh explanation of this topic using a different teaching approach.</p>
          <div class="form-group">
            <label>Choose an explanation style:</label>
            <div class="style-options">
              <label class="style-option">
                <input type="radio" name="explain-style" value="first_principles" checked>
                <div class="style-card">
                  <strong>First Principles</strong>
                  <p>Start from "why" and build understanding from the ground up</p>
                </div>
              </label>
              <label class="style-option">
                <input type="radio" name="explain-style" value="example_driven">
                <div class="style-card">
                  <strong>Example-Driven</strong>
                  <p>Learn through concrete examples before theory</p>
                </div>
              </label>
              <label class="style-option">
                <input type="radio" name="explain-style" value="step_by_step">
                <div class="style-card">
                  <strong>Step-by-Step</strong>
                  <p>Clear numbered steps with checkpoints</p>
                </div>
              </label>
              <label class="style-option">
                <input type="radio" name="explain-style" value="visual">
                <div class="style-card">
                  <strong>Visual</strong>
                  <p>Spatial thinking with diagrams and graphs</p>
                </div>
              </label>
              <label class="style-option">
                <input type="radio" name="explain-style" value="analogy_based">
                <div class="style-card">
                  <strong>Analogy-Based</strong>
                  <p>Real-world comparisons and metaphors</p>
                </div>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>What specifically are you struggling with? (optional)</label>
            <textarea id="explain-feedback" rows="2" placeholder="e.g., I don't understand the relationship between X and Y..."></textarea>
          </div>
        </div>
        <div class="feedback-modal-footer">
          <button class="btn-secondary" onclick="this.closest('.feedback-modal-overlay').remove()">Cancel</button>
          <button class="btn-primary" onclick="window.contentFeedback.requestAlternativeExplanation()">Get New Explanation</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Submit a content request
   */
  async submitRequest() {
    const requestType = document.getElementById("request-type").value;
    const description = document.getElementById("request-description").value.trim();
    const preferredStyle = document.getElementById("preferred-style").value;

    if (!description) {
      alert("Please describe what you need");
      return;
    }

    const submitBtn = document.querySelector(".feedback-modal-footer .btn-primary");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/content-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          subtopicId: this.currentSubtopicId,
          requestType,
          description,
          preferredStyle: preferredStyle || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.showSuccessToast("Request submitted! Processing your content...");

        // Close modal
        document.querySelector(".feedback-modal-overlay").remove();

        // Process the request immediately
        await this.processRequest(data.data.request.id);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || "Failed to submit request"}`);
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Network error. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Request";
    }
  }

  /**
   * Process a content request
   */
  async processRequest(requestId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/content-requests/${requestId}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.showGeneratedContent(data.data.generatedContent, requestId);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || "Failed to process request"}`);
      }
    } catch (error) {
      console.error("Error processing request:", error);
    }
  }

  /**
   * Show generated content in a modal for review
   */
  showGeneratedContent(content, requestId) {
    const modal = document.createElement("div");
    modal.className = "feedback-modal-overlay";
    modal.innerHTML = `
      <div class="feedback-modal feedback-modal-large">
        <div class="feedback-modal-header">
          <h3>Generated Content</h3>
          <button class="modal-close" onclick="this.closest('.feedback-modal-overlay').remove()">×</button>
        </div>
        <div class="feedback-modal-body">
          <div class="generated-content-preview">
            <h4>${content.summary || "Additional Content"}</h4>
            <div class="generated-content-text">${this.renderMarkdown(content.content)}</div>
            ${content.practiceQuestion ? `
              <div class="generated-practice">
                <h5>Practice Question</h5>
                <p><strong>Q:</strong> ${content.practiceQuestion.question}</p>
                <details>
                  <summary>Show Answer</summary>
                  <p>${content.practiceQuestion.answer}</p>
                </details>
              </div>
            ` : ""}
          </div>
        </div>
        <div class="feedback-modal-footer">
          <button class="btn-secondary" onclick="this.closest('.feedback-modal-overlay').remove()">Discard</button>
          <button class="btn-primary" onclick="window.contentFeedback.integrateContent(${requestId})">Add to Learning Content</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Render LaTeX
    if (window.renderMathInElement) {
      window.renderMathInElement(modal.querySelector(".generated-content-preview"), {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  /**
   * Integrate generated content into learning content
   */
  async integrateContent(requestId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/content-requests/${requestId}/integrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mergeStrategy: "append" }),
      });

      if (response.ok) {
        this.showSuccessToast("Content added successfully! Refreshing...");
        document.querySelector(".feedback-modal-overlay").remove();
        // Trigger content refresh
        setTimeout(() => location.reload(), 1000);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || "Failed to integrate content"}`);
      }
    } catch (error) {
      console.error("Error integrating content:", error);
      alert("Network error. Please try again.");
    }
  }

  /**
   * Request alternative explanation
   */
  async requestAlternativeExplanation() {
    const selectedStyle = document.querySelector('input[name="explain-style"]:checked').value;
    const feedback = document.getElementById("explain-feedback")?.value.trim();

    const submitBtn = document.querySelector(".feedback-modal-footer .btn-primary");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Generating...';

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/content-requests/explain-differently", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subtopicId: this.currentSubtopicId,
          preferredStyle: selectedStyle,
          specificFeedback: feedback,
          section: "theory",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.showAlternativeExplanation(data.data.alternativeExplanation);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || "Failed to generate explanation"}`);
      }
    } catch (error) {
      console.error("Error requesting explanation:", error);
      alert("Network error. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Get New Explanation";
    }
  }

  /**
   * Show alternative explanation
   */
  showAlternativeExplanation(explanation) {
    // Close the style selection modal
    document.querySelector(".feedback-modal-overlay")?.remove();

    const modal = document.createElement("div");
    modal.className = "feedback-modal-overlay";
    modal.innerHTML = `
      <div class="feedback-modal feedback-modal-large">
        <div class="feedback-modal-header">
          <h3>Alternative Explanation</h3>
          <span class="approach-badge">${explanation.approachUsed}</span>
          <button class="modal-close" onclick="this.closest('.feedback-modal-overlay').remove()">×</button>
        </div>
        <div class="feedback-modal-body">
          <div class="alternative-explanation">
            ${this.renderMarkdown(explanation.explanation)}
          </div>
          ${explanation.memorableAnalogy ? `
            <div class="memorable-analogy">
              <strong>Remember it this way:</strong> ${explanation.memorableAnalogy}
            </div>
          ` : ""}
          ${explanation.keyInsights && explanation.keyInsights.length > 0 ? `
            <div class="key-insights">
              <strong>Key Insights:</strong>
              <ul>
                ${explanation.keyInsights.map(i => `<li>${i}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
        <div class="feedback-modal-footer">
          <button class="btn-secondary" onclick="this.closest('.feedback-modal-overlay').remove()">Close</button>
          <button class="btn-primary" onclick="window.contentFeedback.saveExplanationToNotes()">Save to Notes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Render LaTeX
    if (window.renderMathInElement) {
      window.renderMathInElement(modal.querySelector(".alternative-explanation"), {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  /**
   * Quick save selected text to notes
   */
  async quickSaveSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      alert("Please select some text to save");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/notes/quick-save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          subtopicId: this.currentSubtopicId,
          content: selectedText,
          sourceType: "learning",
          sourceSection: "theory",
        }),
      });

      if (response.ok) {
        this.showSuccessToast("Saved to notes!");
        selection.removeAllRanges();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || "Failed to save"}`);
      }
    } catch (error) {
      console.error("Error saving to notes:", error);
      alert("Network error. Please try again.");
    }
  }

  /**
   * Save current explanation to notes
   */
  async saveExplanationToNotes() {
    const content = document.querySelector(".alternative-explanation")?.innerText;
    if (!content) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/notes/quick-save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          subtopicId: this.currentSubtopicId,
          content: content,
          sourceType: "alternative_explanation",
        }),
      });

      if (response.ok) {
        this.showSuccessToast("Explanation saved to notes!");
        document.querySelector(".feedback-modal-overlay")?.remove();
      }
    } catch (error) {
      console.error("Error saving to notes:", error);
    }
  }

  /**
   * Render markdown to HTML
   */
  renderMarkdown(text) {
    if (window.marked) {
      return window.marked.parse(text || "");
    }
    return text || "";
  }

  /**
   * Show success toast
   */
  showSuccessToast(message) {
    const toast = document.createElement("div");
    toast.className = "success-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /**
   * Inject styles
   */
  injectStyles() {
    if (document.getElementById("content-feedback-styles")) return;

    const styles = document.createElement("style");
    styles.id = "content-feedback-styles";
    styles.textContent = `
      .content-feedback-bar {
        display: flex;
        gap: 0.75rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        margin: 1rem 0;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .feedback-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: var(--text-secondary, #aaa);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
      }

      .feedback-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary, #fff);
        border-color: var(--primary-color, #f97316);
      }

      .feedback-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .feedback-modal {
        background: var(--bg-secondary, #1e1e2e);
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .feedback-modal-large {
        max-width: 700px;
      }

      .feedback-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .feedback-modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: var(--text-secondary);
        cursor: pointer;
      }

      .feedback-modal-body {
        padding: 1.5rem;
        overflow-y: auto;
      }

      .feedback-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .form-group {
        margin-bottom: 1rem;
      }

      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-secondary);
      }

      .form-group select,
      .form-group textarea,
      .form-group input {
        width: 100%;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: var(--text-primary, #fff);
        font-family: inherit;
      }

      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--primary-color, #f97316);
      }

      .style-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .style-option {
        cursor: pointer;
      }

      .style-option input {
        display: none;
      }

      .style-card {
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.2);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        transition: all 0.2s;
      }

      .style-option input:checked + .style-card {
        border-color: var(--primary-color, #f97316);
        background: rgba(249, 115, 22, 0.1);
      }

      .style-card strong {
        display: block;
        margin-bottom: 0.25rem;
      }

      .style-card p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
      }

      .generated-content-preview,
      .alternative-explanation {
        background: rgba(0, 0, 0, 0.2);
        padding: 1.5rem;
        border-radius: 8px;
        max-height: 400px;
        overflow-y: auto;
      }

      .memorable-analogy,
      .key-insights {
        margin-top: 1rem;
        padding: 1rem;
        background: rgba(249, 115, 22, 0.1);
        border-radius: 8px;
        border-left: 3px solid var(--primary-color);
      }

      .approach-badge {
        background: var(--primary-color);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        text-transform: capitalize;
      }

      .success-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        animation: slideIn 0.3s ease;
        z-index: 1001;
      }

      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styles);
  }
}

// Create global instance
window.contentFeedback = new ContentFeedback();

export default ContentFeedback;
