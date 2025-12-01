// reading-mode/pdfViewer.js
// Full PDF.js Viewer with Thumbnail Strip, AI Integration, and Multi-Tab Support

export function setupReadingMode(mainContent, chatManager) {
  mainContent.innerHTML = '';

  // CRITICAL: Set mainContent to take full available height
  mainContent.style.cssText = `
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  `;

  // State
  const state = {
    tabs: [], // Array of { id, name, file, pdfDoc, pageNum, scale, thumbnailsRendered }
    activeTabId: null,
    canvas: null,
    ctx: null,
    pageRendering: false,
    pageNumPending: null
  };

  // Main Container
  const container = document.createElement('div');
  container.className = 'reading-mode-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #0f0f0f;
    margin: 0;
    padding: 0;
    overflow: hidden;
  `;

  // Header Bar
  const header = document.createElement('div');
  header.className = 'header-bar';
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #141414;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    min-height: 48px;
    flex-shrink: 0;
    z-index: 10;
  `;

  // Header Controls (Left)
  const headerLeft = document.createElement('div');
  headerLeft.style.cssText = 'display: flex; align-items: center; gap: 12px; min-width: 150px;';

  const pageInfo = document.createElement('span');
  pageInfo.textContent = 'Page 0 / 0';
  pageInfo.style.cssText = 'color: #a3a3a3; font-size: 13px; font-variant-numeric: tabular-nums;';

  const prevBtn = createNavButton('<', () => onPrevPage());
  const nextBtn = createNavButton('>', () => onNextPage());

  headerLeft.appendChild(prevBtn);
  headerLeft.appendChild(pageInfo);
  headerLeft.appendChild(nextBtn);

  // Tab Bar (Center)
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  tabBar.style.cssText = `
    display: flex;
    gap: 4px;
    overflow-x: auto;
    flex: 1;
    margin: 0 16px;
    padding: 0 4px;
    scrollbar-width: none;
  `;
  // Hide scrollbar style
  const hideScrollbarStyle = document.createElement('style');
  hideScrollbarStyle.textContent = `.tab-bar::-webkit-scrollbar { display: none; }`;
  document.head.appendChild(hideScrollbarStyle);

  // Header Controls (Right)
  const headerRight = document.createElement('div');
  headerRight.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const openFileBtn = document.createElement('button');
  openFileBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 5v14M5 12h14"></path>
    </svg>
    <span style="margin-left: 6px;">Open PDF</span>
  `;
  openFileBtn.style.cssText = `
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: rgba(124, 58, 237, 0.1);
    color: #a78bfa;
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  openFileBtn.onclick = () => fileInput.click();

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.multiple = true; // Allow multiple files
  fileInput.style.display = 'none';
  fileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file && file.type === 'application/pdf') {
        addTab(file);
      }
    });
    fileInput.value = '';
  };

  // Main Viewer Area (Canvas)
  const viewerArea = document.createElement('div');
  viewerArea.className = 'viewer-area';
  viewerArea.style.cssText = `
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    background: #202020;
    overflow: auto;
    padding: 20px;
    position: relative;
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    max-width: 100%;
  `;
  state.canvas = canvas;
  state.ctx = canvas.getContext('2d');
  viewerArea.appendChild(canvas);

  // Empty State
  const emptyState = document.createElement('div');
  emptyState.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #666;
  `;
  emptyState.innerHTML = `
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity: 0.3; margin-bottom: 16px;">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
    <p>No PDF Open</p>
  `;
  viewerArea.appendChild(emptyState);

  // Thumbnail Strip
  const thumbnailStrip = document.createElement('div');
  thumbnailStrip.className = 'thumbnail-strip';
  thumbnailStrip.style.cssText = `
    height: 140px;
    background: #141414;
    border-top: 1px solid #2a2a2a;
    display: none; /* Hidden by default */
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    overflow-x: auto;
    flex-shrink: 0;
    white-space: nowrap;
  `;

  // Toggle Thumbnails Button
  const toggleThumbsBtn = document.createElement('button');
  toggleThumbsBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="9" y1="21" x2="9" y2="9"></line>
    </svg>
  `;
  toggleThumbsBtn.title = "Toggle Page Thumbnails";
  toggleThumbsBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    color: #a3a3a3;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    margin-right: 8px;
  `;

  toggleThumbsBtn.onclick = () => {
    const isHidden = thumbnailStrip.style.display === 'none';
    thumbnailStrip.style.display = isHidden ? 'flex' : 'none';
    toggleThumbsBtn.style.color = isHidden ? '#a78bfa' : '#a3a3a3';
    toggleThumbsBtn.style.background = isHidden ? 'rgba(124, 58, 237, 0.1)' : 'transparent';
  };

  toggleThumbsBtn.onmouseover = () => {
    if (thumbnailStrip.style.display === 'none') {
      toggleThumbsBtn.style.color = '#e5e5e5';
      toggleThumbsBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    }
  };

  toggleThumbsBtn.onmouseout = () => {
    if (thumbnailStrip.style.display === 'none') {
      toggleThumbsBtn.style.color = '#a3a3a3';
      toggleThumbsBtn.style.background = 'transparent';
    }
  };

  headerRight.appendChild(toggleThumbsBtn);
  headerRight.appendChild(openFileBtn);

  header.appendChild(headerLeft);
  header.appendChild(tabBar);
  header.appendChild(headerRight);

  container.appendChild(header);
  container.appendChild(viewerArea);
  container.appendChild(thumbnailStrip);
  mainContent.appendChild(container);

  // Helper to create nav buttons
  function createNavButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e5e5e5;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    `;
    btn.onclick = onClick;
    return btn;
  }

  // Tab Management Functions
  function renderTabs() {
    tabBar.innerHTML = '';
    state.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      const isActive = tab.id === state.activeTabId;

      tabEl.className = `tab ${isActive ? 'active' : ''}`;
      tabEl.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: ${isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent'};
        border: 1px solid ${isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
        min-width: 100px;
        max-width: 160px;
        position: relative;
      `;

      const name = document.createElement('span');
      name.textContent = tab.name;
      name.style.cssText = `
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: ${isActive ? '#e5e5e5' : '#a3a3a3'};
        font-size: 12px;
        font-weight: ${isActive ? '500' : '400'};
      `;

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: #737373;
        cursor: pointer;
        font-size: 16px;
        padding: 0 2px;
        line-height: 1;
        border-radius: 3px;
        opacity: ${isActive ? '1' : '0'};
        transition: opacity 0.2s;
      `;

      tabEl.onmouseover = () => { if (!isActive) closeBtn.style.opacity = '1'; };
      tabEl.onmouseout = () => { if (!isActive) closeBtn.style.opacity = '0'; };

      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      };

      tabEl.onclick = () => switchTab(tab.id);

      tabEl.appendChild(name);
      tabEl.appendChild(closeBtn);
      tabBar.appendChild(tabEl);
    });
  }

  async function addTab(file) {
    const id = Date.now().toString() + Math.random();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);

    try {
      const pdfDoc = await loadingTask.promise;
      const newTab = {
        id,
        name: file.name,
        file,
        pdfDoc,
        pageNum: 1,
        scale: 1.5,
        thumbnailsRendered: false
      };

      state.tabs.push(newTab);
      switchTab(id);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }

  function closeTab(id) {
    const index = state.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    state.tabs.splice(index, 1);

    if (state.activeTabId === id) {
      if (state.tabs.length > 0) {
        const newIndex = Math.min(index, state.tabs.length - 1);
        switchTab(state.tabs[newIndex].id);
      } else {
        state.activeTabId = null;
        emptyState.style.display = 'block';
        pageInfo.textContent = 'Page 0 / 0';
        state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
        thumbnailStrip.innerHTML = '';
      }
    }
    renderTabs();
  }

  function switchTab(id) {
    state.activeTabId = id;
    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return;

    emptyState.style.display = 'none';
    renderTabs();
    renderPage(tab.pageNum);

    // Render thumbnails if not already done for this tab
    // Or simply re-render them to show correct active state
    renderThumbnails();
  }

  function renderPage(num) {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    state.pageRendering = true;

    tab.pdfDoc.getPage(num).then(function (page) {
      const viewport = page.getViewport({ scale: tab.scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: state.ctx,
        viewport: viewport
      };
      const renderTask = page.render(renderContext);

      renderTask.promise.then(function () {
        state.pageRendering = false;
        if (state.pageNumPending !== null) {
          renderPage(state.pageNumPending);
          state.pageNumPending = null;
        }
      });
    });

    pageInfo.textContent = `Page ${num} / ${tab.pdfDoc.numPages}`;

    // Update active thumbnail style
    const thumbs = thumbnailStrip.querySelectorAll('.thumbnail-item');
    thumbs.forEach(t => t.classList.remove('active'));
    if (thumbs[num - 1]) {
      thumbs[num - 1].classList.add('active');
      thumbs[num - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function queueRenderPage(num) {
    if (state.pageRendering) {
      state.pageNumPending = num;
    } else {
      renderPage(num);
    }
  }

  function onPrevPage() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || tab.pageNum <= 1) return;
    tab.pageNum--;
    queueRenderPage(tab.pageNum);
  }

  function onNextPage() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || tab.pageNum >= tab.pdfDoc.numPages) return;
    tab.pageNum++;
    queueRenderPage(tab.pageNum);
  }

  async function renderThumbnails() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    thumbnailStrip.innerHTML = '';

    // Optimization: Render thumbnails only once per tab if possible, 
    // but for now re-rendering is safer to ensure correct context.
    // To optimize, we could cache the canvas elements in the tab object.

    for (let i = 1; i <= tab.pdfDoc.numPages; i++) {
      const page = await tab.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnail

      const thumbContainer = document.createElement('div');
      thumbContainer.className = 'thumbnail-item';
      if (i === tab.pageNum) thumbContainer.classList.add('active');

      thumbContainer.style.cssText = `
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        transition: background 0.2s;
      `;

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.height = viewport.height;
      thumbCanvas.width = viewport.width;
      thumbCanvas.style.cssText = `
        border: 1px solid #333;
        border-radius: 2px;
        background: #fff;
      `;

      const ctx = thumbCanvas.getContext('2d');
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      const label = document.createElement('span');
      label.textContent = i;
      label.style.cssText = 'font-size: 11px; color: #737373;';

      thumbContainer.appendChild(thumbCanvas);
      thumbContainer.appendChild(label);

      thumbContainer.onclick = () => {
        tab.pageNum = i;
        queueRenderPage(i);

        // AI Integration: Extract full page image and attach
        extractPageImage(i);
      };

      thumbnailStrip.appendChild(thumbContainer);
    }
  }

  async function extractPageImage(pageNum) {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    const page = await tab.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 }); // Good quality for AI

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;

    await page.render({
      canvasContext: tempCanvas.getContext('2d'),
      viewport: viewport
    }).promise;

    const base64 = tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // Add to chat
    if (chatManager) {
      chatManager.addAttachmentFromData(
        `Page ${pageNum} - ${tab.name}`,
        'image/jpeg',
        base64
      );

      // Optional: Focus chat input
      const chatInput = document.querySelector('.chat-input input');
      if (chatInput) chatInput.focus();
    }
  }

  // Add styles for active state
  const style = document.createElement('style');
  style.textContent = `
    .thumbnail-item.active {
      background: rgba(124, 58, 237, 0.1);
    }
    .thumbnail-item.active canvas {
      border-color: #7c3aed !important;
      box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
    }
    .thumbnail-item.active span {
      color: #a78bfa !important;
      font-weight: 600;
    }
    .thumbnail-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }
  `;
  document.head.appendChild(style);
}