/* Prism's same-origin adapter. The actual editor remains miniPaint (MIT). */
window.addEventListener('load', () => {
  const config = window.AppConfig, gui = window.FileOpen.Base_gui;
  let loading = false, ready = false;
  config.pixabay_key = ''; config.google_webfonts_key = '';
  config.FONTS.splice(8);
  const fontTool = config.TOOLS.find(tool => tool.name === 'text');
  if(fontTool?.attributes?.font?.values) fontTool.attributes.font.values = () => config.FONTS;
  gui.Tools_settings.save_setting('exit_confirm', false);
  gui.Tools_settings.save_setting('theme', 'dark');
  gui.change_theme('dark');
  config.COLOR = '#fb9d50';
  gui.GUI_colors.set_color({hex:'#fb9d50'});
  const disabled = new Set(['file/open.search', 'file/open.open_url', 'file/open.open_template_test', 'file/open.open_webcam', 'file/quicksave.quicksave', 'file/quickload.quickload']);
  const generateMenu = gui.GUI_menu.generate_menu_dropdown_item_template.bind(gui.GUI_menu);
  gui.GUI_menu.generate_menu_dropdown_item_template = function(definition, level, index) {
    if(disabled.has(definition.target)) return '';
    return generateMenu(definition, level, index);
  };
  // Replace upstream remote media search with a local file picker.
  const media = gui.GUI_tools.tools_modules.media?.object;
  if(media?.on_activate) media.on_activate = () => window.FileOpen.open_file();
  gui.modules['file/open'].search = () => window.FileOpen.open_file();
  const emitChange = () => { if(!loading && ready) window.PrismEditor.onChange?.(); };
  const viewActions = new Set(['select_layer', 'activate_tool', 'set_zoom', 'init_canvas_zoom', 'prepare_canvas', 'refresh_action_attributes']);
  const original = window.State.do_action.bind(window.State);
  window.State.do_action = async function(action, options) {
    const result = await original(action,options);
    if(result?.status === 'completed' && !viewActions.has(action.action_id)) emitChange();
    return result;
  };
  for(const method of ['undo_action','redo_action']) {
    const handler = window.State[method].bind(window.State);
    window.State[method] = async (...args) => { const result = await handler(...args); emitChange(); return result; };
  }
  for(const name of ['pointerup','touchend','keyup','change','input']) document.addEventListener(name, event => {
    if(event.target.closest?.('#canvas_minipaint,#action_attributes,#toggle_details,#popups,#text_tool_keyboard_input')) setTimeout(emitChange,0);
  });
  // Keyboard access to the upstream tool buttons, which are spans.
  document.querySelectorAll('#tools_container .item').forEach(node => {
    node.setAttribute('role','button'); node.tabIndex = 0; node.setAttribute('aria-label',node.title || node.id);
    node.addEventListener('keydown',event => { if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click(); } });
  });
  function fullCanvas(background) {
    const canvas = document.createElement('canvas'); canvas.width = config.WIDTH; canvas.height = config.HEIGHT;
    const ctx = canvas.getContext('2d');
    if(background) { ctx.fillStyle = background; ctx.fillRect(0,0,canvas.width,canvas.height); }
    window.Layers.convert_layers_to_canvas(ctx,null,false);
    return canvas;
  }
  window.PrismEditor = {
    onChange: null,
    async load(scene) {
      loading = true;
      try {
        await window.FileOpen.load_json(structuredClone(scene));
        config.TRANSPARENCY = true;
        gui.prepare_canvas(); config.need_render = true;
        await gui.GUI_preview.zoom_auto(true);
        await gui.GUI_tools.activate_tool('select');
        ready = true;
      } finally { loading = false; }
    },
    scene() {
      if(config.layer?.type === 'text') {
        const tool = gui.GUI_tools.tools_modules.text?.object;
        const active = tool?.get_editor(config.layer);
        if(active) config.layer.data = structuredClone(active.document.lines);
      }
      return JSON.parse(window.FileSave.export_as_json());
    },
    info() { return { width:config.WIDTH,height:config.HEIGHT,layers:config.layers.length }; },
    thumbnail() {
      const original = fullCanvas(), small = document.createElement('canvas');
      const ratio = Math.min(1,520 / Math.max(original.width,original.height));
      small.width = Math.max(1,Math.round(original.width * ratio)); small.height = Math.max(1,Math.round(original.height * ratio));
      small.getContext('2d').drawImage(original,0,0,small.width,small.height);
      const url = small.toDataURL('image/webp',.8); original.width = 1; original.height = 1; return url;
    },
    export(type,quality) {
      const canvas = fullCanvas(type === 'image/jpeg' ? '#ffffff' : null);
      return new Promise((resolve,reject) => canvas.toBlob(blob => {
        canvas.width = 1; canvas.height = 1;
        if(!blob) return reject(new Error('This browser could not export the image.'));
        if(blob.type !== type) return reject(new Error('This browser does not support that image format. Try PNG.'));
        resolve(blob);
      },type,quality));
    }
  };
});
