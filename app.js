import './style.css';
import * as db from './db.js';
import { blank, imageScene, sample, thumbnail, validateScene, MAX_PIXELS } from './scenes.js';

const app = document.querySelector('#app'), modal = document.querySelector('#modal'), input = document.querySelector('#import-input');
let projects = [], current = null, editor = null, view = 'all', query = '', sort = 'recent', dirty = false, saving = false, timer, toastTimer, revision = 0, saveQueue = Promise.resolve(), busy = false;
const paths = { plus: 'M12 5v14M5 12h14', arrow: 'M5 12h14m-5-5 5 5-5 5', upload: 'M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', star: 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L3.1 9.7l6.1-.9z', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6', download: 'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4', back: 'M19 12H5m5-5-5 5 5 5', more: 'M5 12h.1M12 12h.1M19 12h.1', copy: 'M8 8h13v13H8zM16 8V3H3v13h5', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', close: 'M6 6l12 12M18 6 6 18', check: 'm5 12 4 4L19 6', image: 'M3 3h18v18H3zM3 17l6-6 4 4 4-5 4 6M8 7h.1' };
const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + paths[name] + '"/></svg>';
const escape = text => String(text ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function toast(message) { clearTimeout(toastTimer); const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('visible'); toastTimer = setTimeout(() => node.classList.remove('visible'), 4200); }
function fail(error) { console.error(error); toast(error.message || 'Something went wrong. Please try again.'); }
const brand = '<img src="./assets/prism.svg" width="34" height="34" alt=""/> <span>prism<span class="brand-dot">.</span></span>';
function date(timestamp) { const days = Math.floor((Date.now() - timestamp) / 86400000); return days === 0 ? 'Edited today' : days === 1 ? 'Edited yesterday' : 'Edited ' + new Date(timestamp).toLocaleDateString(undefined, {month:'short',day:'numeric'}); }
function gallery() {
  editor = null; current = null; dirty = false; clearTimeout(timer);
  app.innerHTML = '<div class="studio"><aside class="rail"><a class="brand" href="#" data-action="home" aria-label="Prism studio">' + brand + '</a><div class="rail-label">WORKSPACE</div><nav class="studio-nav" aria-label="Studio navigation"><button data-view="all" class="' + (view === 'all' ? 'active' : '') + '">' + icon('grid') + 'Your studio<span>' + projects.length + '</span></button><button data-view="favorites" class="' + (view === 'favorites' ? 'active' : '') + '">' + icon('star') + 'Favorites<span>' + projects.filter(p => p.favorite).length + '</span></button><button data-action="new">' + icon('plus') + 'New canvas</button></nav><div class="rail-foot"><div class="device-mark">' + icon('shield') + '</div><strong>Your space. Your files.</strong><p>Saved on this device.<br>Never sent to a server.</p><button data-action="about">' + icon('info') + 'About & licenses</button></div></aside><main class="library"><header class="library-top"><span>WORKSPACE <span class="slash">/</span> YOUR STUDIO</span><span class="local-tag"><i></i> LOCAL FIRST</span></header><section class="welcome"><div><p class="eyebrow">A LITTLE LIGHT. A NEW PERSPECTIVE.</p><h1>Your private<br>photo studio<span>.</span></h1><p class="intro">Make something worth a second look.<br>All your tools. All on your device.</p><div class="welcome-actions"><button class="primary" data-action="import">' + icon('upload') + 'Open an image</button><button class="secondary" data-action="new">' + icon('plus') + 'Blank canvas</button></div></div><div class="welcome-art"><img src="./assets/prism-cover.png" alt="A glass prism refracting warm light into a spectrum" /><span class="art-caption">A DIFFERENT WAY TO SEE.</span></div></section><section class="formats"><div class="format-intro"><span class="eyebrow">START WITH A SIZE</span><p>A canvas for every idea.</p></div><button data-preset="1080,1080" class="format-card"><span class="ratio square"></span><span><strong>Social square</strong><small>1080 × 1080</small></span>' + icon('arrow') + '</button><button data-preset="1280,720" class="format-card"><span class="ratio wide"></span><span><strong>Thumbnail</strong><small>1280 × 720</small></span>' + icon('arrow') + '</button><button data-preset="1080,1350" class="format-card"><span class="ratio portrait"></span><span><strong>Portrait post</strong><small>1080 × 1350</small></span>' + icon('arrow') + '</button></section><section class="projects"><div class="projects-heading"><h2>' + (view === 'favorites' ? 'Your favorites' : 'Recent projects') + '<span id="project-count"></span></h2><div class="project-controls"><label class="search">' + icon('search') + '<input aria-label="Search projects" placeholder="Find a project…" value="' + escape(query) + '"/></label><select aria-label="Sort projects"><option value="recent">Last edited</option><option value="name">Name A to Z</option></select><button class="icon-button" data-action="import" aria-label="Import image or project">' + icon('upload') + '</button></div></div><div id="project-grid" class="project-grid"></div></section><footer class="studio-footer"><span>NO ACCOUNTS. NO UPLOADS. JUST YOU AND YOUR IDEAS.</span><span>Powered by <a href="https://github.com/viliusle/miniPaint" target="_blank" rel="noopener noreferrer">miniPaint</a> · MIT licensed</span></footer></main></div>';
  app.querySelector('[aria-label="Sort projects"]').value = sort;
  renderProjects();
}
function renderProjects() {
  const favoriteCount = app.querySelector('[data-view="favorites"] span');
  if(favoriteCount) favoriteCount.textContent = projects.filter(project => project.favorite).length;
  const list = projects.filter(p => (view !== 'favorites' || p.favorite) && p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updated - a.updated);
  app.querySelector('#project-count').textContent = list.length;
  app.querySelector('#project-grid').innerHTML = list.map(p => '<article class="project-card"><button class="project-preview" data-open="' + p.id + '" aria-label="Open ' + escape(p.name) + '">' + (p.thumbnail ? '<img src="' + p.thumbnail + '" alt="" loading="lazy"/>' : '<span class="blank-preview">' + icon('image') + '<span>Room for something new</span></span>') + '<span class="preview-open">Open in studio ' + icon('arrow') + '</span></button><div class="project-meta"><button class="project-name" data-open="' + p.id + '">' + escape(p.name) + '</button><button class="icon-button favorite ' + (p.favorite ? 'selected' : '') + '" data-favorite="' + p.id + '" aria-label="' + (p.favorite ? 'Unfavorite ' : 'Favorite ') + escape(p.name) + '" aria-pressed="' + !!p.favorite + '">' + icon('star') + '</button><button class="icon-button" data-options="' + p.id + '" aria-label="Options for ' + escape(p.name) + '">' + icon('more') + '</button><p>' + date(p.updated) + ' <span>·</span> ' + p.width + ' × ' + p.height + '</p></div></article>').join('') + '<button class="new-project-card" data-action="new"><span>' + icon('plus') + '</span><strong>A fresh perspective</strong><small>Create a new project</small></button>';
  if (!list.length) app.querySelector('#project-grid').insertAdjacentHTML('afterbegin', '<div class="empty"><h3>' + (query ? 'No matches just yet.' : 'Make this space yours.') + '</h3><p>' + (query ? 'Try another project name.' : 'Open an image or start with a blank canvas.') + '</p></div>');
}
function showModal(html, handler) {
  modal.innerHTML = '<button class="modal-close icon-button" aria-label="Close dialog">' + icon('close') + '</button>' + html;
  modal.querySelector('.modal-close').onclick = () => modal.close();
  modal.querySelectorAll('label > select,label > input').forEach(control => {
    const label = [...control.parentElement.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim();
    if(label) control.setAttribute('aria-label',label);
  });
  if (handler) modal.querySelector('form').onsubmit = async event => { event.preventDefault(); const button = event.submitter; if(button) button.disabled = true; try { await handler(new FormData(event.target)); modal.close(); } catch (error) { fail(error); } finally { if(button) button.disabled = false; } };
  modal.showModal();
}
function newDialog(width = 1280, height = 720) {
  showModal('<p class="eyebrow">BEGIN ANYWHERE</p><h2>A fresh canvas.</h2><p class="modal-copy">Give your next idea a little room.</p><form><label>Project name<input name="name" value="Untitled project" maxlength="120" required /></label><div class="field-pair"><label>Width in pixels<input name="width" type="number" min="1" max="8000" value="' + width + '" required /></label><label>Height in pixels<input name="height" type="number" min="1" max="8000" value="' + height + '" required /></label></div><p class="form-note">Transparent canvas · Up to 16 megapixels</p><button class="primary" type="submit">Create project ' + icon('arrow') + '</button></form>', async fields => {
    const w = Number(fields.get('width')), h = Number(fields.get('height'));
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w * h > MAX_PIXELS) throw new Error('Choose dimensions up to 16 megapixels.');
    const project = await create(fields.get('name').trim() || 'Untitled project', blank(w,h));
    await openProject(project.id);
  });
}
async function create(name, scene, thumb = '') {
  const project = { id: crypto.randomUUID(), name: name.slice(0,120), width: scene.info.width, height: scene.info.height, thumbnail: thumb, favorite: false, created: Date.now(), updated: Date.now() };
  await db.save(project,scene); projects.push(project); return project;
}
async function openProject(id) {
  if (busy) return;
  busy = true;
  try {
    if(current) await flush();
    const project = projects.find(p => p.id === id), scene = await db.read('scenes',id);
    if (!project || !scene) throw new Error('This project could not be found.');
    current = project; dirty = false; revision = 0;
    app.innerHTML = '<div class="editor-shell"><header class="editor-header"><button class="icon-button back" data-action="back" aria-label="Back to studio">' + icon('back') + '</button><a href="#" data-action="back" class="brand compact">' + brand + '</a><span class="editor-divider"></span><input id="project-title" aria-label="Project title" value="' + escape(project.name) + '" maxlength="120"/><div class="editor-header-actions"><span id="save-status" role="status"><i></i>Saved locally</span><button class="secondary small backup" data-action="backup">' + icon('download') + 'Project backup</button><button class="primary small" data-action="export">' + icon('download') + 'Export image</button></div></header><div class="editor-stage"><div id="editor-loading">Opening your studio…</div><iframe id="editor-frame" title="Prism image editor" src="./editor/index.html"></iframe></div><footer class="editor-footer"><span id="canvas-info">' + project.width + ' × ' + project.height + ' PX</span><span>Ctrl / ⌘ Z to undo <span class="footer-divider">·</span> Changes stay on this device</span><button data-action="about">miniPaint engine · MIT</button></footer></div>';
    const frame = app.querySelector('#editor-frame');
    await new Promise((resolve,reject) => {
      const timeout = setTimeout(() => reject(new Error('The editor did not load. Please refresh and try again.')), 15000);
      frame.onload = async () => {
        try {
          const api = frame.contentWindow.PrismEditor;
          if(!api) throw new Error('The editor could not start.');
          await api.load(scene); editor = api; api.onChange = markDirty;
          app.querySelector('#editor-loading')?.remove(); updateStatus(); clearTimeout(timeout); resolve();
        } catch(error) { clearTimeout(timeout); reject(error); }
      };
    });
  } catch(error) { current = null; editor = null; gallery(); fail(error); } finally { busy = false; }
}
function markDirty() { if(!current || !editor) return; dirty = true; revision++; updateStatus('Saving locally…'); clearTimeout(timer); timer = setTimeout(() => flush().catch(fail), 1000); }
function updateStatus(text = dirty ? 'Saving locally…' : 'Saved locally') {
  const node = app.querySelector('#save-status'); if(node) { node.textContent = text; node.classList.toggle('unsaved', dirty); }
  if(editor) { const info = editor.info(); app.querySelector('#canvas-info').textContent = info.width + ' × ' + info.height + ' PX · ' + info.layers + ' LAYERS'; }
}
function flush() {
  clearTimeout(timer);
  const job = async () => {
    while(dirty && current && editor) {
    const project = current, api = editor, version = revision; saving = true;
    try {
      const scene = api.scene(), preview = api.thumbnail();
      const updated = {...project, name: app.querySelector('#project-title')?.value.trim() || project.name, width:scene.info.width, height:scene.info.height, thumbnail:preview, updated:Date.now()};
      await db.save(updated,scene);
      Object.assign(project,updated); if(revision === version) dirty = false;
      updateStatus();
    } catch(error) { updateStatus('Save failed · download a backup'); throw new Error('Local save failed. Download a project backup before leaving. ' + error.message); }
    finally { saving = false; }
    }
  };
  saveQueue = saveQueue.catch(() => {}).then(job); return saveQueue;
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url),30000);
}
async function backup(project = current) {
  if(!project) return;
  const scene = project === current && editor ? editor.scene() : await db.read('scenes',project.id);
  const name = project === current ? app.querySelector('#project-title').value.trim() || project.name : project.name;
  download(new Blob([JSON.stringify({app:'prism',version:1,name,scene},null,2)],{type:'application/json'}),name.replace(/[^\p{L}\p{N}\s_-]/gu,'').slice(0,80) + '.prism');
  toast('Editable project backup downloaded.');
}
function exportDialog() {
  if(!editor) return;
  showModal('<p class="eyebrow">MADE TO BE SHARED</p><h2>Export your image.</h2><p class="modal-copy">Your original layers stay untouched.</p><form><label>File format<select name="type"><option value="image/png">PNG · transparency supported</option><option value="image/jpeg">JPEG · smaller image</option><option value="image/webp">WebP · modern and lightweight</option></select></label><label>Quality<input name="quality" type="range" min="10" max="100" value="92"/></label><p class="form-note">JPEG uses a white background. Exports use full canvas resolution.</p><button class="primary" type="submit">' + icon('download') + 'Download image</button></form>', async fields => {
    const type = fields.get('type'), extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type];
    const blob = await editor.export(type,Number(fields.get('quality')) / 100);
    download(blob,(app.querySelector('#project-title').value.trim() || current.name) + '.' + extension); toast('Your image is ready.');
  });
}
async function importFiles(files) {
  if(busy) return;
  busy = true;
  try {
    if(current) { await flush(); gallery(); }
    let last;
    for(const file of files) {
      if(file.size > 30_000_000) throw new Error('Choose files smaller than 30 MB.');
      const name = file.name.replace(/\.[^.]+$/,'');
      if(/\.(prism|json)$/i.test(file.name)) {
        const value = JSON.parse(await file.text()), scene = validateScene(value.scene || value);
        last = await create(typeof value.name === 'string' ? value.name : name,scene);
      } else {
        if(!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, WebP, GIF, BMP or Prism project.');
        const image = await createImageBitmap(file);
        if(image.width * image.height > MAX_PIXELS) { image.close(); throw new Error('Choose images up to 16 megapixels.'); }
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').drawImage(image,0,0); image.close();
        last = await create(name,imageScene(canvas.toDataURL('image/png'),canvas.width,canvas.height,file.name),thumbnail(canvas));
      }
    }
    busy = false;
    if(last) await openProject(last.id);
  } finally { busy = false; input.value = ''; }
}
function options(id) {
  const project = projects.find(p => p.id === id);
  showModal('<p class="eyebrow">PROJECT OPTIONS</p><h2>' + escape(project.name) + '</h2><div class="option-list"><button data-edit="rename">' + icon('image') + 'Rename project</button><button data-edit="duplicate">' + icon('copy') + 'Duplicate project</button><button data-edit="backup">' + icon('download') + 'Download editable backup</button><button data-edit="delete" class="danger">' + icon('trash') + 'Delete project</button></div>');
  modal.querySelectorAll('[data-edit]').forEach(button => button.onclick = async () => {
    const action = button.dataset.edit; modal.close();
    try {
      if(action === 'rename') showModal('<h2>Rename project.</h2><form><label>Name<input name="name" value="' + escape(project.name) + '" maxlength="120" required/></label><button class="primary" type="submit">Save name</button></form>',async fields => { const updated={...project,name:fields.get('name').trim() || project.name}; await db.save(updated); Object.assign(project,updated); renderProjects(); });
      if(action === 'duplicate') { await create(project.name + ' copy',await db.read('scenes',id),project.thumbnail); gallery(); toast('Project duplicated.'); }
      if(action === 'backup') await backup(project);
      if(action === 'delete') showModal('<h2>Delete this project?</h2><p class="modal-copy">“' + escape(project.name) + '” will be removed from this browser. Download a backup first if you want to keep it.</p><form><button class="primary destructive" type="submit">Delete project</button></form>',async () => { await db.remove(id); projects=projects.filter(p => p.id !== id); gallery(); toast('Project deleted from this browser.'); });
    } catch(error) { fail(error); }
  });
}
function about() {
  showModal('<p class="eyebrow">YOUR PRIVATE PHOTO STUDIO</p><h2>A little more about Prism.</h2><p class="modal-copy">Prism is an independent browser photo editor powered by the MIT-licensed miniPaint engine by Vilius L. It is not an official miniPaint product.</p><h3>Your files stay with you.</h3><p>Projects save in this browser’s IndexedDB storage. Closing and reopening the browser keeps saved projects. Clearing site data, private browsing, storage eviction or a different website address can remove or isolate them. Download editable backups for important work.</p><h3>Built to be local.</h3><p>No account, API keys, cloud sync, stock-image search or AI generation. System fonts keep text editing local. GIF imports use a still frame; advanced animation export is available in the editor’s File menu.</p><p class="about-links"><a href="./licenses/miniPaint-MIT.txt" target="_blank" rel="noopener">miniPaint MIT license</a><a href="./THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener">Dependency notices</a><a href="https://github.com/viliusle/miniPaint" target="_blank" rel="noopener">Original source</a></p>');
}
app.addEventListener('click', async event => {
  const target = event.target.closest('button,a'); if(!target) return;
  try {
    if(target.dataset.open) await openProject(target.dataset.open);
    if(target.dataset.view) { view = target.dataset.view; gallery(); }
    if(target.dataset.preset) { const [w,h] = target.dataset.preset.split(',').map(Number); newDialog(w,h); }
    if(target.dataset.favorite) { const project = projects.find(p => p.id === target.dataset.favorite), updated = {...project,favorite:!project.favorite}; await db.save(updated); Object.assign(project,updated); renderProjects(); }
    if(target.dataset.options) options(target.dataset.options);
    switch(target.dataset.action) {
      case 'home': event.preventDefault(); gallery(); break;
      case 'new': newDialog(); break;
      case 'import': input.click(); break;
      case 'about': about(); break;
      case 'back': event.preventDefault(); await flush(); gallery(); break;
      case 'backup': await backup(); break;
      case 'export': exportDialog(); break;
    }
  } catch(error) { fail(error); }
});
app.addEventListener('input', event => {
  if(event.target.matches('[aria-label="Search projects"]')) { query = event.target.value; renderProjects(); }
  if(event.target.id === 'project-title') markDirty();
});
app.addEventListener('change', event => { if(event.target.matches('[aria-label="Sort projects"]')) { sort = event.target.value; renderProjects(); } });
input.onchange = () => importFiles([...input.files]).catch(fail);
document.addEventListener('dragover', event => { if(!current) event.preventDefault(); });
document.addEventListener('drop', event => { if(!current) { event.preventDefault(); importFiles([...event.dataTransfer.files]).catch(fail); } });
document.addEventListener('keydown', event => { if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && current) { event.preventDefault(); flush().then(() => toast('Saved on this device.')).catch(fail); } });
document.addEventListener('visibilitychange', () => { if(document.hidden && dirty) flush().catch(fail); });
window.addEventListener('beforeunload', event => { if(dirty || saving) { event.preventDefault(); event.returnValue = ''; } });
async function init() {
  app.innerHTML = '<div class="startup"><img src="./assets/prism.svg" alt="Prism"/><p>Opening your private studio…</p></div>';
  try {
    projects = await db.read('projects');
    if(!projects.length && !localStorage.getItem('prism-welcomed')) {
      for(const [kind,name] of [['dunes','Desert studies'],['poster','Make room']]) { const result=sample(kind); await create(name,result.scene,result.thumb); }
      localStorage.setItem('prism-welcomed','1');
    }
    gallery();
  } catch(error) {
    app.innerHTML = '<div class="startup"><h1>Local storage is unavailable.</h1><p>Enable browser storage or open Prism outside private browsing, then refresh.</p><button class="primary" onclick="location.reload()">Try again</button></div>'; fail(error);
  }
}
init();
