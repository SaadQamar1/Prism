export const MAX_PIXELS = 16_000_000;
export function blank(width = 1280, height = 720) {
  return { info: { width, height, version: '4.14.3', layer_active: 1, guides: [] }, user_fonts: {}, layers: [layer()], data: [] };
}
function layer(properties = {}) {
  return { id: 1, parent_id: 0, name: 'Layer 1', type: null, link: null, x: 0, y: 0, width: null, width_original: null, height: null, height_original: null, visible: true, is_vector: false, hide_selection_if_active: false, opacity: 100, order: 1, composition: 'source-over', rotate: 0, data: null, params: {}, status: null, color: '#fb9d50', filters: [], render_function: null, ...properties };
}
export function imageScene(data, width, height, name) {
  const scene = blank(width, height);
  scene.layers = [layer({ name, type: 'image', width, height, width_original: width, height_original: height })];
  scene.data = [{ id: 1, data }];
  return scene;
}
export function validateScene(scene) {
  if (!scene || !Number.isInteger(scene.info?.width) || !Number.isInteger(scene.info?.height)
      || scene.info.width < 1 || scene.info.height < 1 || scene.info.width * scene.info.height > MAX_PIXELS
      || !Array.isArray(scene.layers) || !scene.layers.length || scene.layers.length > 500
      || !Array.isArray(scene.data) || scene.data.length > 500) throw new Error('Invalid project, or canvas exceeds 16 megapixels.');
  const ids = new Set();
  const safeTypes = new Set([null, 'image', 'brush', 'pencil', 'line', 'arrow', 'rectangle', 'ellipse', 'text', 'gradient', 'polygon', 'star', 'heart', 'bezier_curve', 'triangle', 'right_triangle', 'trapezoid', 'romb', 'rhombus', 'pentagon', 'hexagon', 'octagon', 'plus', 'cross', 'parallelogram', 'cylinder', 'human', 'moon', 'smile', 'tear', 'callout', 'cog', 'gear', 'borders']);
  const systemFonts = new Set(['Arial','Courier','Impact','Helvetica','Monospace','Tahoma','Times New Roman','Verdana']);
  for (const item of scene.layers) {
    if (!Number.isInteger(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !safeTypes.has(item.type)) throw new Error('Unsupported layer in imported project.');
    ids.add(item.id);
    // Uploaded projects never execute code or load remote image/font addresses.
    item.link = null; delete item.link_canvas;
    if (item.type === 'image') item.data = null;
    if (item.type === 'text' && Array.isArray(item.data)) {
      for (const line of item.data) for (const span of line) {
        if (span.meta?.family && !systemFonts.has(span.meta.family)) throw new Error('This project uses a remote font. Change it to a system font before importing.');
      }
    }
    if (item.render_function !== null && item.render_function !== undefined
      && (!Array.isArray(item.render_function) || ![item.type,'shapes/' + item.type].includes(item.render_function[0]) || item.render_function[1] !== 'render')) throw new Error('Unsupported layer renderer.');
    if (Array.isArray(item.filters) && item.filters.some(filter => typeof filter.name !== 'string' || !/^[a-z_-]+$/i.test(filter.name))) throw new Error('Invalid filter.');
  }
  for (const item of scene.data) {
    if (!ids.has(item.id) || typeof item.data !== 'string' || !/^data:image\/(png|jpeg|webp|gif|bmp);base64,/i.test(item.data)) throw new Error('Only embedded raster images can be imported.');
  }
  scene.user_fonts = {};
  return scene;
}
export function thumbnail(canvas) {
  const small = document.createElement('canvas');
  const ratio = Math.min(1, 520 / Math.max(canvas.width, canvas.height));
  small.width = Math.max(1, Math.round(canvas.width * ratio)); small.height = Math.max(1, Math.round(canvas.height * ratio));
  small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL('image/webp', .8);
}
export function sample(kind) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (kind === 'dunes') {
    const sky = ctx.createLinearGradient(0, 0, 0, 800); sky.addColorStop(0, '#242637'); sky.addColorStop(.6, '#b56743'); sky.addColorStop(1, '#edd09c'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#f7cf9a'; ctx.beginPath(); ctx.arc(880, 260, 86, 0, Math.PI * 2); ctx.fill();
    ['#a57767','#76574e','#503b38','#292929'].forEach((color, i) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 440 + i * 85);
      ctx.bezierCurveTo(240, 260 + i * 80, 580, 760 - i * 20, 1200, 370 + i * 100); ctx.lineTo(1200, 800); ctx.lineTo(0, 800); ctx.fill();
    });
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 1200, 800); gradient.addColorStop(0, '#ba5e38'); gradient.addColorStop(1, '#ecb176'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#edc89e'; ctx.beginPath(); ctx.arc(710, 380, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b4036'; ctx.beginPath(); ctx.moveTo(560, 0); ctx.lineTo(940, 800); ctx.lineTo(750, 800); ctx.lineTo(370, 0); ctx.fill();
    ctx.font = 'bold 86px Arial'; ctx.fillStyle = '#f7edde'; ctx.fillText('MAKE', 70, 450); ctx.fillText('ROOM.', 70, 548);
    ctx.font = '16px Arial'; ctx.fillText('A STUDY IN COLOUR AND SPACE', 75, 725);
  }
  return { scene: imageScene(canvas.toDataURL('image/png'), 1200, 800, kind === 'dunes' ? 'Desert illustration' : 'Colour study'), thumb: thumbnail(canvas) };
}
