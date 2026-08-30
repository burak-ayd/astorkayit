import type { RecordItem } from '@/types';
import { getRecordFolderName } from '@/database/db';
import MediaStorageModule from '../../modules/my-module/src/MediaStorageModule';

/**
 * Generates an interactive, standalone HTML viewer containing records and photos.
 */
export function generateExportHtml(records: RecordItem[], title: string = 'Astor Kayıt Arşivi'): string {
  const exportDate = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalPhotos = records.reduce((acc, r) => acc + (r.photos?.length || 0), 0);

  // Normalize photo paths to relative paths inside the ZIP (e.g., ./Files/record_1_title/photo_1.jpg)
  const normalizedRecords = records.map((r) => {
    const folderName = getRecordFolderName(r.id, r.title);
    const normalizedPhotos = (r.photos || []).map((p) => {
      const parts = p.split('/');
      const fileName = parts[parts.length - 1];
      return `./Files/${folderName}/${fileName}`;
    });

    return {
      id: r.id,
      title: r.title,
      description: r.description || '',
      is_hidden: r.is_hidden,
      is_pinned: r.is_pinned || false,
      created_at: r.created_at,
      updated_at: r.updated_at,
      photos: normalizedPhotos,
    };
  });

  const recordsJsonStr = JSON.stringify(normalizedRecords);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0F172A;
      --bg-card: #1E293B;
      --bg-card-hover: #273549;
      --bg-input: #141E33;
      --border: #334155;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --primary: #38BDF8;
      --primary-dark: #0284C7;
      --primary-glow: rgba(56, 189, 248, 0.15);
      --accent: #818CF8;
      --badge-bg: rgba(56, 189, 248, 0.12);
      --badge-border: rgba(56, 189, 248, 0.3);
      --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      --radius: 16px;
    }

    [data-theme="light"] {
      --bg: #F1F5F9;
      --bg-card: #FFFFFF;
      --bg-card-hover: #F8FAFC;
      --bg-input: #E2E8F0;
      --border: #CBD5E1;
      --text: #0F172A;
      --text-muted: #64748B;
      --primary: #0284C7;
      --primary-dark: #0369A1;
      --primary-glow: rgba(2, 132, 199, 0.15);
      --accent: #6366F1;
      --badge-bg: rgba(2, 132, 199, 0.1);
      --badge-border: rgba(2, 132, 199, 0.25);
      --shadow: 0 10px 20px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px 16px 60px;
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .brand-title {
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .header-sub {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .theme-toggle {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .theme-toggle:hover {
      background: var(--bg-card-hover);
      border-color: var(--primary);
    }

    /* Stats Banner */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: var(--shadow);
    }

    .stat-val {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Search & Filter Bar */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 28px;
    }

    .search-input-wrapper {
      flex: 1;
      min-width: 260px;
      position: relative;
    }

    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 12px 16px 12px 42px;
      border-radius: 14px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }

    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 18px;
    }

    /* Record Grid */
    .records-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 18px;
    }

    .record-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      box-shadow: var(--shadow);
      position: relative;
    }

    .record-card:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
      background: var(--bg-card-hover);
    }

    .card-top {
      position: relative;
      width: 100%;
      height: 180px;
      background: var(--bg-input);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .card-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .record-card:hover .card-thumb {
      transform: scale(1.04);
    }

    .placeholder-thumb {
      font-size: 40px;
      color: var(--text-muted);
    }

    .photo-badge {
      position: absolute;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pin-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: var(--primary);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }

    .card-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 8px;
    }

    .card-title {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--text);
    }

    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Modal / Detail View */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      max-width: 750px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow);
      animation: modalIn 0.2s ease;
    }

    @keyframes modalIn {
      from { transform: scale(0.96); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .modal-header {
      padding: 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      gap: 16px;
    }

    .modal-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text);
    }

    .modal-date {
      font-size: 13px;
      color: var(--primary);
      font-weight: 600;
      margin-top: 4px;
    }

    .modal-close {
      background: var(--bg-input);
      border: none;
      color: var(--text);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .modal-close:hover {
      background: var(--border);
    }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .modal-desc {
      font-size: 15px;
      line-height: 1.6;
      color: var(--text);
      white-space: pre-wrap;
      background: var(--bg-input);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .modal-photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }

    .modal-photo-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid var(--border);
    }

    .modal-photo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.2s ease;
    }

    .modal-photo-item:hover .modal-photo-img {
      transform: scale(1.05);
    }

    /* Lightbox Viewer */
    .lightbox-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 2000;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .lightbox-overlay.active {
      display: flex;
    }

    .lightbox-img {
      max-width: 90vw;
      max-height: 82vh;
      object-fit: contain;
      border-radius: 8px;
    }

    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      border: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .lightbox-nav:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .lightbox-prev { left: 24px; }
    .lightbox-next { right: 24px; }

    .lightbox-close {
      position: absolute;
      top: 24px;
      right: 24px;
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      border: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-size: 22px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lightbox-counter {
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      margin-top: 14px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div>
        <h1 class="brand-title">${title}</h1>
        <p class="header-sub">Dışa Aktarma Tarihi: ${exportDate}</p>
      </div>
      <div class="header-actions">
        <button class="theme-toggle" onclick="toggleTheme()">🌓 Tema Değiştir</button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-val">${records.length}</span>
        <span class="stat-label">Toplam Kayıt</span>
      </div>
      <div class="stat-card">
        <span class="stat-val">${totalPhotos}</span>
        <span class="stat-label">Toplam Fotoğraf</span>
      </div>
      <div class="stat-card">
        <span class="stat-val">${exportDate.split(' ')[0]}</span>
        <span class="stat-label">Arşiv Tarihi</span>
      </div>
    </div>

    <!-- Search / Filter -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" class="search-input" placeholder="Başlık veya açıklamada ara..." oninput="filterRecords()" />
      </div>
    </div>

    <!-- Records Grid -->
    <div class="records-grid" id="recordsGrid"></div>
    <div class="empty-state" id="emptyState" style="display: none;">
      <h3>Kayıt bulunamadı</h3>
      <p style="margin-top: 6px;">Arama kriterlerinizi değiştirmeyi deneyin.</p>
    </div>
  </div>

  <!-- Detail Modal -->
  <div class="modal-overlay" id="detailModal" onclick="closeModalOnOverlay(event)">
    <div class="modal-container">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="modalTitle"></h2>
          <p class="modal-date" id="modalDate"></p>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-desc" id="modalDesc" style="display: none;"></div>
        <div>
          <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 10px; color: var(--text-muted);">FOTOĞRAFLAR (<span id="modalPhotoCount">0</span>)</h4>
          <div class="modal-photos-grid" id="modalPhotosGrid"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Fullscreen Lightbox -->
  <div class="lightbox-overlay" id="lightboxModal">
    <button class="lightbox-close" onclick="closeLightbox()">✕</button>
    <button class="lightbox-nav lightbox-prev" onclick="prevLightbox(event)">❮</button>
    <img src="" alt="" class="lightbox-img" id="lightboxImg" />
    <button class="lightbox-nav lightbox-next" onclick="nextLightbox(event)">❯</button>
    <div class="lightbox-counter" id="lightboxCounter"></div>
  </div>

  <script>
    const records = ${recordsJsonStr};
    let currentLightboxPhotos = [];
    let currentLightboxIndex = 0;

    function renderRecords(list) {
      const grid = document.getElementById('recordsGrid');
      const empty = document.getElementById('emptyState');
      grid.innerHTML = '';

      if (list.length === 0) {
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      list.forEach((r) => {
        const card = document.createElement('div');
        card.className = 'record-card';
        card.onclick = () => openModal(r.id);

        const firstPhoto = r.photos && r.photos.length > 0 ? r.photos[0] : null;
        const dateObj = new Date(r.created_at);
        const formattedDate = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        card.innerHTML = \`
          <div class="card-top">
            \${firstPhoto ? \`<img src="\${firstPhoto}" class="card-thumb" alt="\${r.title}" onerror="this.src='';this.parentElement.innerHTML='<span class=\\\\'placeholder-thumb\\\\'>🖼️</span>'"/>\` : '<span class="placeholder-thumb">📝</span>'}
            \${r.is_pinned ? '<span class="pin-badge">📌 Sabit</span>' : ''}
            \${r.photos && r.photos.length > 1 ? \`<span class="photo-badge">📷 \${r.photos.length}</span>\` : ''}
          </div>
          <div class="card-body">
            <div class="card-title">\${escapeHtml(r.title)}</div>
            \${r.description ? \`<div class="card-desc">\${escapeHtml(r.description)}</div>\` : ''}
            <div class="card-footer">
              <span>📅 \${formattedDate} • \${formattedTime}</span>
              \${r.is_hidden ? '<span>🙈 Gizli</span>' : ''}
            </div>
          </div>
        \`;
        grid.appendChild(card);
      });
    }

    function filterRecords() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      const filtered = records.filter(r => 
        r.title.toLowerCase().includes(q) || 
        (r.description && r.description.toLowerCase().includes(q))
      );
      renderRecords(filtered);
    }

    function openModal(id) {
      const r = records.find(item => item.id === id);
      if (!r) return;

      document.getElementById('modalTitle').textContent = r.title;
      const dateObj = new Date(r.created_at);
      document.getElementById('modalDate').textContent = '📅 ' + dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const descEl = document.getElementById('modalDesc');
      if (r.description) {
        descEl.style.display = 'block';
        descEl.textContent = r.description;
      } else {
        descEl.style.display = 'none';
      }

      document.getElementById('modalPhotoCount').textContent = r.photos.length;
      const photosGrid = document.getElementById('modalPhotosGrid');
      photosGrid.innerHTML = '';

      if (r.photos && r.photos.length > 0) {
        r.photos.forEach((photoUrl, idx) => {
          const item = document.createElement('div');
          item.className = 'modal-photo-item';
          item.onclick = () => openLightbox(r.photos, idx);
          item.innerHTML = \`<img src="\${photoUrl}" class="modal-photo-img" alt="\${r.title}" />\`;
          photosGrid.appendChild(item);
        });
      }

      document.getElementById('detailModal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('detailModal').classList.remove('active');
    }

    function closeModalOnOverlay(e) {
      if (e.target.id === 'detailModal') {
        closeModal();
      }
    }

    function openLightbox(photos, index) {
      currentLightboxPhotos = photos;
      currentLightboxIndex = index;
      updateLightbox();
      document.getElementById('lightboxModal').classList.add('active');
    }

    function updateLightbox() {
      if (!currentLightboxPhotos || currentLightboxPhotos.length === 0) return;
      document.getElementById('lightboxImg').src = currentLightboxPhotos[currentLightboxIndex];
      document.getElementById('lightboxCounter').textContent = \`\${currentLightboxIndex + 1} / \${currentLightboxPhotos.length}\`;
    }

    function prevLightbox(e) {
      if (e) e.stopPropagation();
      if (currentLightboxIndex > 0) {
        currentLightboxIndex--;
      } else {
        currentLightboxIndex = currentLightboxPhotos.length - 1;
      }
      updateLightbox();
    }

    function nextLightbox(e) {
      if (e) e.stopPropagation();
      if (currentLightboxIndex < currentLightboxPhotos.length - 1) {
        currentLightboxIndex++;
      } else {
        currentLightboxIndex = 0;
      }
      updateLightbox();
    }

    function closeLightbox() {
      document.getElementById('lightboxModal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (document.getElementById('lightboxModal').classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevLightbox();
        if (e.key === 'ArrowRight') nextLightbox();
      } else if (document.getElementById('detailModal').classList.contains('active')) {
        if (e.key === 'Escape') closeModal();
      }
    });

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('astor_theme', next);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // Initialize
    const savedTheme = localStorage.getItem('astor_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    renderRecords(records);
  </script>
</body>
</html>`;
}

/**
 * Creates a ZIP archive containing all files and interactive HTML viewer for given records.
 */
export async function exportRecordsToZip(
  records: RecordItem[],
  customTitle?: string
): Promise<{ success: boolean; zipPath?: string; zipName?: string; zipSize?: number; error?: string }> {
  if (!MediaStorageModule) {
    return { success: false, error: 'MediaStorage native module is not available on this platform.' };
  }

  if (!records || records.length === 0) {
    return { success: false, error: 'Dışa aktarılacak kayıt bulunamadı.' };
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `AstorKayit_Yedek_${timestamp}.zip`;
    const zipRelativePath = `Backups/${zipFileName}`;

    const title = customTitle || `Astor Kayıt Arşivi (${records.length} Kayıt)`;
    const htmlContent = generateExportHtml(records, title);
    const jsonContent = JSON.stringify(records, null, 2);

    // Folders to include: Files/record_<id>_<title>
    const folderRelativePaths = records.map((r) => `Files/${getRecordFolderName(r.id, r.title)}`);

    const result = await MediaStorageModule.createZipExport(
      zipRelativePath,
      htmlContent,
      jsonContent,
      folderRelativePaths
    );

    return {
      success: true,
      zipPath: result.path,
      zipName: result.name,
      zipSize: result.size,
    };
  } catch (error) {
    console.error('ZIP Export failed:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}
