// reading-mode/pdfViewer.js
// PDF Viewer logic with PaddleOCR integration

export function setupReadingMode(mainContent) {
  mainContent.innerHTML = '';

  // Add Material Button
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.style.margin = '64px auto 0 auto';
  addBtn.style.display = 'block';
  addBtn.style.fontSize = '1.1rem';
  addBtn.style.padding = '14px 36px';
  addBtn.style.borderRadius = '10px';
  addBtn.style.boxShadow = '0 2px 8px rgba(255,107,53,0.10)';
  addBtn.textContent = 'Add Material';

  // File input (hidden)
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.style.display = 'none';

  // PDF Card Container
  const pdfCard = document.createElement('div');
  pdfCard.style.background = 'var(--bg-secondary)';
  pdfCard.style.borderRadius = '18px';
  pdfCard.style.boxShadow = '0 4px 32px rgba(0,0,0,0.22)';
  pdfCard.style.padding = '0';
  pdfCard.style.margin = '48px auto';
  pdfCard.style.maxWidth = '900px';
  pdfCard.style.width = '100%';
  pdfCard.style.boxSizing = 'border-box';
  pdfCard.style.overflow = 'visible';
  pdfCard.style.display = 'none';
  pdfCard.style.border = '2px solid var(--border-color)';
  pdfCard.style.position = 'relative';

  // OCR Controls
  const ocrControls = document.createElement('div');
  ocrControls.style.padding = '16px';
  ocrControls.style.borderBottom = '1px solid var(--border-color)';
  ocrControls.style.display = 'flex';
  ocrControls.style.gap = '12px';
  ocrControls.style.alignItems = 'center';

  const ocrBtn = document.createElement('button');
  ocrBtn.className = 'btn-primary';
  ocrBtn.style.fontSize = '0.9rem';
  ocrBtn.style.padding = '8px 20px';
  ocrBtn.textContent = 'Extract Handwriting';
  ocrBtn.style.borderRadius = '8px';

  const ocrStatus = document.createElement('span');
  ocrStatus.style.fontSize = '0.85rem';
  ocrStatus.style.color = 'var(--text-secondary)';
  ocrStatus.textContent = '';

  ocrControls.appendChild(ocrBtn);
  ocrControls.appendChild(ocrStatus);

  // PDF Viewer
  const pdfViewer = document.createElement('div');
  pdfViewer.className = 'pdf-viewer';
  pdfViewer.style.borderRadius = '0 0 16px 16px';
  pdfViewer.style.overflow = 'hidden';
  pdfViewer.style.background = '#181818';
  pdfViewer.style.margin = '0';
  pdfViewer.style.width = '100%';
  pdfViewer.style.maxWidth = '100%';
  pdfViewer.style.boxSizing = 'border-box';

  // Extracted Text Display
  const textDisplay = document.createElement('div');
  textDisplay.style.padding = '20px';
  textDisplay.style.background = 'var(--bg-primary)';
  textDisplay.style.borderTop = '1px solid var(--border-color)';
  textDisplay.style.maxHeight = '300px';
  textDisplay.style.overflowY = 'auto';
  textDisplay.style.display = 'none';
  textDisplay.style.fontFamily = 'monospace';
  textDisplay.style.fontSize = '0.9rem';
  textDisplay.style.lineHeight = '1.6';
  textDisplay.style.whiteSpace = 'pre-wrap';

  let currentFile = null;

  addBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      currentFile = file;
      const url = URL.createObjectURL(file);
      pdfViewer.innerHTML = `<iframe src="${url}" style="width:100%;min-height:70vh;max-height:80vh;border:none;background:#181818;box-shadow:0 2px 16px rgba(0,0,0,0.18);"></iframe>`;
      addBtn.style.display = 'none';
      pdfCard.style.display = 'block';
      textDisplay.style.display = 'none';
      textDisplay.innerHTML = '';
    }
  };

  // OCR Button Handler
  ocrBtn.onclick = async () => {
    if (!currentFile) return;

    ocrBtn.disabled = true;
    ocrBtn.textContent = 'Processing...';
    ocrStatus.textContent = 'Extracting text from handwriting...';
    ocrStatus.style.color = '#FF6B35';
    textDisplay.style.display = 'none';

    try {
      const formData = new FormData();
      formData.append('file', currentFile);

      const response = await fetch('http://localhost:5000/ocr', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Display extracted text in a selectable textarea
        textDisplay.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="color: var(--primary-color);">Extracted Text:</strong>
            <button id="copyBtn" style="padding: 6px 16px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; font-size: 0.85rem;">
              Copy All
            </button>
          </div>
          <textarea readonly style="width:100%;height:220px;resize:vertical;font-family:monospace;font-size:0.95rem;background:var(--bg-primary);color:var(--text-primary);border-radius:8px;border:1px solid var(--border-color);padding:12px;box-sizing:border-box;">${result.text.trim()}</textarea>
        `;
        textDisplay.style.display = 'block';

        // Copy button handler
        document.getElementById('copyBtn').onclick = () => {
          navigator.clipboard.writeText(result.text.trim());
          document.getElementById('copyBtn').textContent = 'Copied!';
          setTimeout(() => {
            document.getElementById('copyBtn').textContent = 'Copy All';
          }, 2000);
        };

        ocrStatus.textContent = `✓ Text extracted`;
        ocrStatus.style.color = '#4CAF50';
      } else {
        ocrStatus.textContent = `Error: ${result.error}`;
        ocrStatus.style.color = '#f44336';
      }
    } catch (error) {
      console.error('OCR Error:', error);
      ocrStatus.textContent = 'Error: Could not connect to OCR server';
      ocrStatus.style.color = '#f44336';
    } finally {
      ocrBtn.disabled = false;
      ocrBtn.textContent = 'Extract Handwriting';
    }
  };

  pdfCard.appendChild(ocrControls);
  pdfCard.appendChild(pdfViewer);
  pdfCard.appendChild(textDisplay);

  mainContent.appendChild(addBtn);
  mainContent.appendChild(fileInput);
  mainContent.appendChild(pdfCard);
}