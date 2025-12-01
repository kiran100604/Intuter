// reading-mode/pdfViewer.js
// Enhanced Full-Screen PDF Viewer with Modern UI - FIXED HEIGHT

export function setupReadingMode(mainContent) {
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
    tabs: [],
    activeTabId: null,
    isFullscreen: false,
    ocrPanelOpen: false
  };

  // Main Container - Full viewport
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

  // Header Bar - Compact & Modern
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
    backdrop-filter: blur(10px);
  `;

  const headerLeft = document.createElement('div');
  headerLeft.className = 'header-left-placeholder';
  headerLeft.style.cssText = `
    display: none;
    align-items: center;
    gap: 12px;
    min-width: 120px;
  `;

  // Center section - Tabs (Compact)
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  tabBar.style.cssText = `
    display: flex;
    gap: 4px;
    overflow-x: auto;
    max-width: 500px;
    padding: 0 8px;
    scrollbar-width: none;
  `;
  
  // Hide scrollbar
  const hideScrollbarStyle = document.createElement('style');
  hideScrollbarStyle.textContent = `.tab-bar::-webkit-scrollbar { display: none; }`;
  document.head.appendChild(hideScrollbarStyle);

  // Right section - Controls
  const headerRight = document.createElement('div');
  headerRight.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  // Add File Button - Compact & Modern
  const addFileBtn = document.createElement('button');
  addFileBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 5v14M5 12h14"></path>
    </svg>
  `;
  addFileBtn.title = 'Open PDF';
  addFileBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(124, 58, 237, 0.1);
    color: #a78bfa;
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  `;

  addFileBtn.onmouseover = () => {
    addFileBtn.style.background = 'rgba(124, 58, 237, 0.2)';
    addFileBtn.style.borderColor = 'rgba(124, 58, 237, 0.4)';
    addFileBtn.style.color = '#c4b5fd';
  };
  addFileBtn.onmouseout = () => {
    addFileBtn.style.background = 'rgba(124, 58, 237, 0.1)';
    addFileBtn.style.borderColor = 'rgba(124, 58, 237, 0.2)';
    addFileBtn.style.color = '#a78bfa';
  };

  // File Input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.multiple = true;
  fileInput.style.display = 'none';

  addFileBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file && file.type === 'application/pdf') {
        addTab(file);
      }
    });
    fileInput.value = '';
  };

  // Close/Minimize Button - Minimal
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.title = 'Close Reader';
  closeBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #737373;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  `;

  closeBtn.onmouseover = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    closeBtn.style.color = '#e5e5e5';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#737373';
  };

  closeBtn.onclick = () => {
    // Cleanup URLs
    state.tabs.forEach(tab => URL.revokeObjectURL(tab.url));
    mainContent.innerHTML = '';
    mainContent.style.cssText = ''; // Reset styles
    // You can add your own logic to return to previous view
  };

  headerRight.appendChild(addFileBtn);
  headerRight.appendChild(closeBtn);

  header.appendChild(headerLeft);
  header.appendChild(tabBar);
  header.appendChild(headerRight);

  // Viewer Area - CRITICAL: Takes remaining height
  const viewerArea = document.createElement('div');
  viewerArea.className = 'viewer-area';
  viewerArea.style.cssText = `
    flex: 1;
    display: flex;
    position: relative;
    background: #181818;
    overflow: hidden;
    min-height: 0;
  `;

  // Empty State
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #666;
    gap: 20px;
  `;

  emptyState.innerHTML = `
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity: 0.3;">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="12" y1="11" x2="12" y2="17"></line>
      <line x1="9" y1="14" x2="15" y2="14"></line>
    </svg>
    <div style="text-align: center;">
      <p style="font-size: 18px; margin: 0 0 8px 0; color: #999;">No PDF Open</p>
      <p style="font-size: 14px; margin: 0; color: #666;">Click "Open PDF" to get started</p>
    </div>
  `;

  viewerArea.appendChild(emptyState);

  container.appendChild(header);
  container.appendChild(viewerArea);
  mainContent.appendChild(container);

  // Functions
  function renderTabs() {
    tabBar.innerHTML = '';

    state.tabs.forEach((tab, index) => {
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
        min-width: 120px;
        max-width: 180px;
        position: relative;
      `;

      const icon = document.createElement('span');
      icon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
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
        font-size: 18px;
        padding: 0 2px;
        line-height: 1;
        border-radius: 3px;
        transition: all 0.15s;
        opacity: ${isActive ? '1' : '0'};
      `;

      closeBtn.onmouseover = (e) => {
        e.stopPropagation();
        closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        closeBtn.style.color = '#e5e5e5';
      };
      closeBtn.onmouseout = (e) => {
        e.stopPropagation();
        closeBtn.style.background = 'transparent';
        closeBtn.style.color = '#737373';
      };
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      };

      tabEl.onmouseover = () => {
        closeBtn.style.opacity = '1';
        if (!isActive) {
          tabEl.style.background = 'rgba(255, 255, 255, 0.04)';
          tabEl.style.borderColor = 'rgba(255, 255, 255, 0.06)';
        }
      };
      tabEl.onmouseout = () => {
        if (!isActive) {
          closeBtn.style.opacity = '0';
          tabEl.style.background = 'transparent';
          tabEl.style.borderColor = 'transparent';
        }
      };

      tabEl.onclick = () => switchTab(tab.id);

      tabEl.appendChild(icon);
      tabEl.appendChild(name);
      tabEl.appendChild(closeBtn);
      tabBar.appendChild(tabEl);
    });
  }

  function addTab(file) {
    const id = Date.now().toString() + Math.random();
    const url = URL.createObjectURL(file);
    const newTab = {
      id,
      name: file.name,
      file,
      url,
      ocrText: null
    };

    state.tabs.push(newTab);
    switchTab(id);
  }

  function closeTab(id) {
    const index = state.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = state.tabs[index];
    URL.revokeObjectURL(tab.url);
    state.tabs.splice(index, 1);

    if (state.activeTabId === id) {
      if (state.tabs.length > 0) {
        const newIndex = Math.min(index, state.tabs.length - 1);
        switchTab(state.tabs[newIndex].id);
      } else {
        state.activeTabId = null;
        renderViewer();
      }
    }
    renderTabs();
  }

  function switchTab(id) {
    state.activeTabId = id;
    renderTabs();
    renderViewer();
  }

  function renderViewer() {
    viewerArea.innerHTML = '';
    
    // Update header left section with Extract button
    const headerLeft = container.querySelector('.header-left-placeholder');
    headerLeft.innerHTML = '';

    if (!state.activeTabId) {
      headerLeft.style.display = 'none'; 
      viewerArea.appendChild(emptyState);
      return;
    }
    headerLeft.style.display = 'flex'; 

    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    // Create Extract Button for Header
    const headerExtractBtn = document.createElement('button');
    headerExtractBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      <span>${tab.ocrText ? 'View Text' : 'Extract'}</span>
    `;
    headerExtractBtn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: ${tab.ocrText ? 'rgba(34, 197, 94, 0.1)' : 'rgba(124, 58, 237, 0.1)'};
      color: ${tab.ocrText ? '#4ade80' : '#a78bfa'};
      border: 1px solid ${tab.ocrText ? 'rgba(34, 197, 94, 0.2)' : 'rgba(124, 58, 237, 0.2)'};
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    `;

    const headerStatusText = document.createElement('span');
    headerStatusText.style.cssText = `
      font-size: 11px;
      color: #737373;
    `;

    headerLeft.appendChild(headerExtractBtn);
    headerLeft.appendChild(headerStatusText);

    // Main content container
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      display: flex;
      flex: 1;
      width: 100%;
      height: 100%;
      position: relative;
      min-height: 0;
    `;

    // PDF Container
    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #202020;
      position: relative;
      height: 100%;
      min-width: 0;
    `;


    // PDF Iframe - CRITICAL: Takes remaining height
    const iframe = document.createElement('iframe');
    iframe.src = tab.url;
    iframe.style.cssText = `
      flex: 1;
      width: 100%;
      border: none;
      background: #181818;
      min-height: 0;
    `;

    pdfContainer.appendChild(iframe);

    // OCR Side Panel
    const ocrPanel = document.createElement('div');
    ocrPanel.style.cssText = `
      width: 0;
      background: #1a1a1a;
      border-left: 1px solid #2a2a2a;
      display: flex;
      flex-direction: column;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      flex-shrink: 0;
    `;

    const ocrHeader = document.createElement('div');
    ocrHeader.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #2a2a2a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;

    const ocrTitle = document.createElement('div');
    ocrTitle.textContent = 'Extracted Text';
    ocrTitle.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #fff;
    `;

    const closeOcrBtn = document.createElement('button');
    closeOcrBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeOcrBtn.style.cssText = `
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
    `;
    closeOcrBtn.onmouseover = () => {
      closeOcrBtn.style.background = '#2a2a2a';
      closeOcrBtn.style.color = '#fff';
    };
    closeOcrBtn.onmouseout = () => {
      closeOcrBtn.style.background = 'transparent';
      closeOcrBtn.style.color = '#666';
    };
    closeOcrBtn.onclick = () => {
      ocrPanel.style.width = '0';
      state.ocrPanelOpen = false;
    };

    ocrHeader.appendChild(ocrTitle);
    ocrHeader.appendChild(closeOcrBtn);

    const ocrContent = document.createElement('textarea');
    ocrContent.readOnly = true;
    ocrContent.value = tab.ocrText || '';
    ocrContent.style.cssText = `
      flex: 1;
      resize: none;
      border: none;
      padding: 20px;
      background: #1a1a1a;
      color: #e0e0e0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      outline: none;
      min-height: 0;
    `;

    ocrPanel.appendChild(ocrHeader);
    ocrPanel.appendChild(ocrContent);

    contentWrapper.appendChild(pdfContainer);
    contentWrapper.appendChild(ocrPanel);
    viewerArea.appendChild(contentWrapper);

    // Extract Button Logic (in header)
    headerExtractBtn.onclick = async () => {
      if (tab.ocrText) {
        // Toggle panel
        if (state.ocrPanelOpen) {
          ocrPanel.style.width = '0';
          state.ocrPanelOpen = false;
        } else {
          ocrPanel.style.width = '400px';
          state.ocrPanelOpen = true;
        }
        return;
      }

      // Extract text
      headerExtractBtn.disabled = true;
      headerExtractBtn.style.opacity = '0.6';
      headerExtractBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        <span>Processing...</span>
      `;
      headerStatusText.textContent = 'Analyzing...';
      headerStatusText.style.color = '#a78bfa';

      try {
        const formData = new FormData();
        formData.append('file', tab.file);

        const response = await fetch('http://localhost:5000/ocr', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          tab.ocrText = result.text.trim();
          ocrContent.value = tab.ocrText;
          headerExtractBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>View Text</span>
          `;
          headerExtractBtn.style.background = 'rgba(34, 197, 94, 0.1)';
          headerExtractBtn.style.color = '#4ade80';
          headerExtractBtn.style.borderColor = 'rgba(34, 197, 94, 0.2)';
          headerStatusText.textContent = 'Complete';
          headerStatusText.style.color = '#4ade80';
          ocrPanel.style.width = '400px';
          state.ocrPanelOpen = true;
        } else {
          headerStatusText.textContent = `Error: ${result.error}`;
          headerStatusText.style.color = '#f87171';
          headerExtractBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Retry</span>
          `;
        }
      } catch (error) {
        console.error('OCR Error:', error);
        headerStatusText.textContent = 'Server error';
        headerStatusText.style.color = '#f87171';
        headerExtractBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Retry</span>
        `;
      } finally {
        headerExtractBtn.disabled = false;
        headerExtractBtn.style.opacity = '1';
      }
    };
  }

  // Add spinning animation for loading state
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .tab-bar::-webkit-scrollbar {
      height: 6px;
    }
    
    .tab-bar::-webkit-scrollbar-track {
      background: #1a1a1a;
    }
    
    .tab-bar::-webkit-scrollbar-thumb {
      background: #3a3a3a;
      border-radius: 3px;
    }
    
    .tab-bar::-webkit-scrollbar-thumb:hover {
      background: #4a4a4a;
    }
  `;
  document.head.appendChild(style);
}