let currentRevisionContent = null;
let currentSubtopicId = null;

export function setupRevisionMode(mainContent, subtopicId) {
  currentSubtopicId = subtopicId;
  if (!subtopicId) {
    mainContent.innerHTML = `
      <div class="revision-placeholder">
        <h2>Select a Subtopic</h2>
        <p>Please select a subtopic from the sidebar to start revising.</p>
      </div>
    `;
    return;
  }

  mainContent.innerHTML = `
    <div class="revision-container">
      <div class="revision-header">
        <h2>Revision Mode</h2>
        <div id="revision-status">Loading...</div>
      </div>
      <div id="revision-content"></div>
    </div>
  `;

  loadRevisionContent(subtopicId);

  // Inject CSS for user question
  if (!document.getElementById('revision-user-question-styles')) {
    const style = document.createElement('style');
    style.id = 'revision-user-question-styles';
    style.textContent = `
      .user-question-container {
        background: rgba(255, 255, 255, 0.05);
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 2rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .user-question-container h4 {
        margin-top: 0;
        margin-bottom: 1rem;
        color: var(--text-primary, #fff);
      }
      .user-input-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      #user-question-text {
        width: 100%;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: var(--text-primary, #fff);
        font-family: inherit;
        resize: vertical;
      }
      #user-question-text:focus {
        outline: none;
        border-color: var(--primary-color, #f97316);
      }
      .file-input-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      #user-question-image {
        color: var(--text-secondary, #aaa);
      }
      .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary, #fff);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
  }
}

async function loadRevisionContent(subtopicId) {
  const token = localStorage.getItem("token");
  const contentContainer = document.getElementById("revision-content");
  const statusDiv = document.getElementById("revision-status");

  try {
    console.log(`Fetching revision for subtopic: ${subtopicId}`);
    const response = await fetch(`http://localhost:5000/api/revision/${subtopicId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`Revision response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log("Revision content found:", data);
      currentRevisionContent = data.data.content.content;
      renderRevision(currentRevisionContent);

      // Render saved practice questions if any
      if (data.data.content.practiceQuestions && data.data.content.practiceQuestions.length > 0) {
        data.data.content.practiceQuestions.forEach(q => addPracticeQuestionToUI(q));
      }

      statusDiv.textContent = "";
    } else if (response.status === 404) {
      console.log("Revision content not found (404)");
      statusDiv.textContent = "";
      contentContainer.innerHTML = `
        <div class="learning-options">
          <div class="start-learning-btn" id="start-revision-btn">
            <h3>Ready to revise?</h3>
            <p>Click to generate personalized revision notes for this topic.</p>
            <button class="btn-primary">Generate Revision Notes</button>
          </div>
        </div>
      `;
      document.getElementById("start-revision-btn").addEventListener("click", () => {
        generateRevision(subtopicId);
      });
    } else {
      console.error("Error loading revision:", response.status);
      statusDiv.textContent = "Error loading revision content.";
    }
  } catch (error) {
    console.error("Error loading revision:", error);
    statusDiv.textContent = "Network error.";
  }
}

async function generateRevision(subtopicId) {
  const token = localStorage.getItem("token");
  const statusDiv = document.getElementById("revision-status");

  statusDiv.textContent = "Generating revision notes... This may take a moment.";

  try {
    const response = await fetch("http://localhost:5000/api/revision/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subtopicId }),
    });

    if (response.ok) {
      const data = await response.json();
      currentRevisionContent = data.data.content.content;
      renderRevision(currentRevisionContent);
      statusDiv.textContent = "";
    } else {
      const error = await response.json();
      statusDiv.textContent = `Error: ${error.message || "Generation failed"}`;
    }
  } catch (error) {
    console.error("Error generating revision:", error);
    statusDiv.textContent = "Network error during generation.";
  }
}

function renderRevision(content) {
  const container = document.getElementById("revision-content");

  let html = '<div class="revision-grid">';

  // Core Intuition
  if (content.coreIntuition) {
    html += `
      <div class="revision-section intuition-section">
        <h3>Core Intuition</h3>
        <div class="intuition-content">${formatText(content.coreIntuition)}</div>
      </div>
    `;
  }

  // Important Concepts
  if (content.importantConcepts && content.importantConcepts.length > 0) {
    html += `
      <div class="revision-section concepts-section">
        <h3>Important Concepts</h3>
        <div class="concepts-list">
          ${content.importantConcepts.map(c => `
            <div class="concept-item" id="${c.id.replace('#', '')}">
              <div class="concept-header">
                <span class="concept-name">${c.concept}</span>
                <span class="concept-tag-badge">${c.id}</span>
              </div>
              <div class="concept-explanation">${formatText(c.explanation)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Formulas
  if (content.formulas && content.formulas.length > 0) {
    html += `
      <div class="revision-section formulas-section">
        <h3>Key Formulas</h3>
        <div class="cards-container">
          ${content.formulas.map(f => `
            <div class="revision-card formula-card" id="${f.id ? f.id.replace('#', '') : ''}">
              <div class="card-header">
                <div class="card-title">${f.name}</div>
                ${f.id ? `<span class="card-tag-badge">${f.id}</span>` : ''}
              </div>
              <div class="card-expression">$$${f.expression.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '')}$$</div>
              <div class="card-explanation">${f.explanation}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Definitions
  if (content.definitions && content.definitions.length > 0) {
    html += `
      <div class="revision-section definitions-section">
        <h3>Key Definitions</h3>
        <div class="definitions-list">
          ${content.definitions.map(d => `
            <div class="definition-item" id="${d.id ? d.id.replace('#', '') : ''}">
              <div class="definition-header">
                <span class="term">${d.term}:</span>
                ${d.id ? `<span class="definition-tag-badge">${d.id}</span>` : ''}
              </div>
              <div class="def-content">
                  <div class="formal-def"><strong>Formal:</strong> ${d.formalDefinition || d.definition}</div>
                  ${d.intuitiveExplanation ? `<div class="intuitive-def"><strong>Intuition:</strong> ${d.intuitiveExplanation}</div>` : ''}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Quiz
  if (content.quiz && content.quiz.length > 0) {
    html += `
      <div class="revision-section quiz-section">
        <h3>Quick Quiz</h3>
        <div class="quiz-container">
          ${content.quiz.map((q, index) => `
            <div class="quiz-item">
              <div class="question"><strong>Q${index + 1}:</strong> ${q.question}</div>
              <div class="answer-container">
                <button class="reveal-btn" onclick="this.nextElementSibling.classList.toggle('visible'); this.style.display='none'">Show Answer</button>
                <div class="answer">${q.answer}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Tips
  if (content.tips && content.tips.length > 0) {
    html += `
      <div class="revision-section tips-section">
        <h3>Pro Tips</h3>
        <ul class="tips-list">
          ${content.tips.map(t => {
      const text = typeof t === 'string' ? t : t.text;
      const id = typeof t === 'object' && t.id ? t.id.replace('#', '') : '';
      return `<li ${id ? `id="${id}"` : ''}>${formatText(text)} ${id ? `<span class="tip-tag-badge">#${id}</span>` : ''}</li>`;
    }).join("")}
        </ul>
      </div>
    `;
  }

  html += '</div>'; // End revision-grid

  // Practice Zone
  html += `
    <div class="revision-section practice-section">
      <h3>Practice Zone</h3>
      
      <div class="user-question-container">
        <h4>Ask Your Own Question</h4>
        <div class="user-input-group">
          <textarea id="user-question-text" placeholder="Type your question here..." rows="3"></textarea>
          <div class="file-input-wrapper">
            <input type="file" id="user-question-image" accept="image/*">
            <span class="file-input-label">Upload Image (optional)</span>
          </div>
        </div>
        <button id="solve-user-question-btn" class="btn-secondary">Solve My Question</button>
      </div>

      <div id="practice-questions-container"></div>
      <div class="practice-controls">
        <button id="generate-practice-btn" class="btn-primary">Generate Practice Question</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Event Listeners
  document.getElementById("generate-practice-btn").addEventListener("click", () => generatePracticeQuestion());
  document.getElementById("solve-user-question-btn").addEventListener("click", handleUserQuestion);

  // Re-render KaTeX
  if (window.renderMathInElement) {
    window.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }

  // Debug: Log all generated IDs
  const allIds = Array.from(container.querySelectorAll('[id]')).map(el => el.id);
  console.log("Generated IDs in revision content:", allIds);
}

async function handleUserQuestion() {
  const questionText = document.getElementById("user-question-text").value;
  const imageInput = document.getElementById("user-question-image");
  const btn = document.getElementById("solve-user-question-btn");

  if (!questionText.trim() && (!imageInput.files || imageInput.files.length === 0)) {
    alert("Please enter a question or upload an image.");
    return;
  }

  let userImage = null;
  if (imageInput.files && imageInput.files.length > 0) {
    const file = imageInput.files[0];
    try {
      userImage = await convertToBase64(file);
    } catch (e) {
      console.error("Error converting image:", e);
      alert("Failed to process image.");
      return;
    }
  }

  // Disable button
  btn.disabled = true;
  btn.textContent = "Solving...";

  await generatePracticeQuestion({ userQuestion: questionText, userImage });

  // Re-enable button
  btn.disabled = false;
  btn.textContent = "Solve My Question";
}

function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:image/...;base64, prefix
    reader.onerror = error => reject(error);
  });
}

async function generatePracticeQuestion(options = {}) {
  const { userQuestion, userImage } = options;

  const btn = userQuestion
    ? document.getElementById("solve-user-question-btn")
    : document.getElementById("generate-practice-btn");

  const container = document.getElementById("practice-questions-container");
  const token = localStorage.getItem("token");

  if (!userQuestion) {
    btn.disabled = true;
    btn.textContent = "Generating...";
  }

  try {
    const body = {
      subtopicId: currentSubtopicId,
      revisionContent: currentRevisionContent
    };

    if (userQuestion) body.userQuestion = userQuestion;
    if (userImage) body.userImage = userImage;

    const response = await fetch("http://localhost:5000/api/revision/practice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      const questionData = data.data;
      addPracticeQuestionToUI(questionData);

      // Clear inputs if it was a user question
      if (userQuestion) {
        document.getElementById("user-question-text").value = "";
        document.getElementById("user-question-image").value = "";
      }
    } else {
      const err = await response.json();
      alert(`Failed to generate: ${err.message || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error generating practice question:", error);
    alert("Network error.");
  } finally {
    if (!userQuestion) {
      btn.disabled = false;
      btn.textContent = "Generate Practice Question";
    }
  }
}

function addPracticeQuestionToUI(data) {
  const container = document.getElementById("practice-questions-container");
  const questionId = data.id || `pq-${Date.now()}`;

  const questionHtml = `
    <div class="practice-card" id="${questionId}">
      <div class="practice-question">
        <strong>Question:</strong> ${formatText(data.question)}
      </div>
      
      <div class="practice-hints">
        <div class="hints-toggle" onclick="this.nextElementSibling.classList.toggle('visible')">
          <span>Need a hint? (Relevant Concepts)</span>
          <span class="arrow">▼</span>
        </div>
        <div class="hints-content">
          ${data.relevantTags && data.relevantTags.length > 0
      ? data.relevantTags.map(tag => {
        const cleanTag = tag.replace('#', '');
        const escapedTag = cleanTag.replace(/'/g, "\\'");
        return `<span class="hint-tag" onclick="scrollToTag('${escapedTag}')">${tag}</span>`;
      }).join(" ")
      : "No specific hints available."}
        </div>
      </div>

      <div class="practice-answer-section">
        <button class="reveal-btn" onclick="this.nextElementSibling.classList.toggle('visible'); this.innerText = this.nextElementSibling.classList.contains('visible') ? 'Hide Answer' : 'Show Answer'">Show Answer</button>
        <div class="answer-content">
          <strong>Solution:</strong>
          <div>${formatText(data.answer)}</div>
        </div>
      </div>
    </div>
  `;

  const div = document.createElement('div');
  div.innerHTML = questionHtml;
  container.appendChild(div);

  // Render Math in the new question
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

// Make scrollToTag global so it can be called from onclick
window.scrollToTag = function (tagId) {
  console.log(`Attempting to scroll to tag: ${tagId}`);
  let element = document.getElementById(tagId);

  // Helper to find element case-insensitively
  const findCaseInsensitive = (id) => {
    const allElements = document.querySelectorAll('[id]');
    for (const el of allElements) {
      if (el.id.toLowerCase() === id.toLowerCase()) {
        return el;
      }
    }
    return null;
  };

  // 1. Try direct match (already done above)

  // 2. Try case-insensitive
  if (!element) {
    console.log(`Element with id ${tagId} not found directly. Searching case-insensitively...`);
    element = findCaseInsensitive(tagId);
  }

  // 3. Try stripping trailing hyphen (common AI artifact)
  if (!element && tagId.endsWith('-')) {
    const cleanedId = tagId.replace(/-+$/, '');
    console.log(`Trying cleaned ID: ${cleanedId}`);
    element = document.getElementById(cleanedId) || findCaseInsensitive(cleanedId);
  }

  // 4. Try stripping leading/trailing whitespace just in case
  if (!element) {
    const trimmedId = tagId.trim();
    if (trimmedId !== tagId) {
      element = document.getElementById(trimmedId) || findCaseInsensitive(trimmedId);
    }
  }

  if (element) {
    console.log("Successfully found element:", element);

    // Try manual scroll first as it's most reliable for custom scroll containers
    const container = document.querySelector('.main-content');
    if (container) {
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate relative position
      const relativeTop = elementRect.top - containerRect.top;
      const currentScroll = container.scrollTop;

      // Target is current scroll + relative position - half container height + half element height
      const targetScroll = currentScroll + relativeTop - (containerRect.height / 2) + (elementRect.height / 2);

      console.log(`Manual scroll: current=${currentScroll}, relativeTop=${relativeTop}, target=${targetScroll}`);

      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    } else {
      // Fallback to scrollIntoView if container not found
      console.warn("Main content container not found, falling back to scrollIntoView");
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Apply highlight class
    element.classList.remove('highlighted'); // Reset animation
    void element.offsetWidth; // Trigger reflow
    element.classList.add('highlighted');

    // Also add a temporary inline style to be absolutely sure it's visible
    const originalBg = element.style.backgroundColor;
    const originalTransition = element.style.transition;

    element.style.transition = 'background-color 0.5s ease';
    element.style.backgroundColor = 'rgba(249, 115, 22, 0.3)';

    setTimeout(() => {
      element.style.backgroundColor = originalBg;
      element.style.transition = originalTransition;
      element.classList.remove('highlighted');
    }, 2000);

  } else {
    console.warn(`Element with id ${tagId} not found`);
    alert(`Could not find the concept for tag: #${tagId}. It might be missing from the generated content.`);
  }
};

function formatText(text) {
  if (!text) return "";
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return formatted;
}
