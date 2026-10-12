const { chromium } = require(process.env.PRISM_PLAYWRIGHT_PATH || 'playwright');
const { mkdtemp, mkdir, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const profile = await mkdtemp(path.join(tmpdir(),'prism-verify-'));
  const launch = () => chromium.launchPersistentContext(profile,{headless:true,...(process.env.PRISM_BROWSER_EXECUTABLE ? {executablePath:process.env.PRISM_BROWSER_EXECUTABLE} : {}),viewport:{width:1440,height:1000},acceptDownloads:true,args:['--disable-gpu','--disable-background-networking']});
  let context;
  const errors=[], external=[];
  const attach = page => {
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:3002/')) external.push(request.url());});
  };
  const ready = async page => {
    await page.locator('#editor-frame').waitFor();
    await page.locator('#editor-loading').waitFor({state:'detached'});
    return page.frames().find(frame=>frame.url().includes('/editor/index.html'));
  };
  try {
    context = await launch(); context.setDefaultTimeout(15000);
    let page = await context.newPage(); attach(page);
    const response = await page.goto('http://127.0.0.1:3002/');
    assert.equal(response.status(),200);
    await page.getByRole('heading',{name:'Your private photo studio.'}).waitFor();
    await page.getByRole('button',{name:'Blank canvas',exact:true}).click();
    await page.getByLabel('Project name',{exact:true}).fill('Persistence check');
    await page.getByRole('button',{name:'Create project',exact:false}).click();
    let frame=await ready(page);
    await frame.getByRole('button',{name:'Brush',exact:true}).click();
    const box=await page.frameLocator('#editor-frame').locator('#canvas_minipaint').boundingBox();
    await page.mouse.move(box.x+120,box.y+140); await page.mouse.down(); await page.mouse.move(box.x+340,box.y+280,{steps:20}); await page.mouse.up();
    await page.locator('#project-title').fill('Saved artwork'); await page.locator('#project-title').press('Tab');
    await page.getByText('Saved locally',{exact:true}).waitFor();
    const scene=await frame.evaluate(()=>window.PrismEditor.scene());
    assert.ok(scene.layers.some(layer=>layer.type==='brush'),'Brush creates a real editable layer');
    console.log('PASS: actual miniPaint drawing and local autosave');
    await page.reload();
    await page.getByRole('button',{name:'Open Saved artwork',exact:true}).click();
    frame=await ready(page);
    assert.ok((await frame.evaluate(()=>window.PrismEditor.scene())).layers.some(layer=>layer.type==='brush'));
    console.log('PASS: drawing and project title survive reload');
    await context.close();
    context=await launch();context.setDefaultTimeout(15000);page=await context.newPage();attach(page);
    await page.goto('http://127.0.0.1:3002/');
    await page.getByRole('button',{name:'Open Saved artwork',exact:true}).click();frame=await ready(page);
    assert.ok((await frame.evaluate(()=>window.PrismEditor.scene())).layers.some(layer=>layer.type==='brush'));
    console.log('PASS: closing and reopening browser preserves editable project');
    // PNG, JPEG, WebP must be valid full-resolution files, not empty downloads.
    for(const [type,extension,magic] of [['image/png','png','89504e470d0a1a0a'],['image/jpeg','jpg','ffd8ff'],['image/webp','webp','52494646']]) {
      await page.getByRole('button',{name:'Export image',exact:true}).click();
      await page.getByLabel('File format',{exact:true}).selectOption(type);
      const wait=page.waitForEvent('download');
      await page.getByRole('button',{name:'Download image',exact:true}).click();
      const download=await wait, destination=path.join(profile,'export.'+extension);await download.saveAs(destination);
      const bytes=await readFile(destination);assert.equal(bytes.subarray(0,magic.length/2).toString('hex'),magic);
      const dimensions=await frame.evaluate(async ({bytes,type})=>{
        const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type}));const result={width:image.width,height:image.height};image.close();return result;
      },{bytes:[...bytes],type});
      assert.deepEqual(dimensions,{width:1280,height:720});
      console.log('PASS: full-resolution '+extension+' export');
    }
    const backupWait=page.waitForEvent('download');
    await page.getByRole('button',{name:'Project backup',exact:true}).click();
    const backup=await backupWait, backupPath=path.join(profile,'saved.prism');await backup.saveAs(backupPath);
    assert.ok(JSON.parse(await readFile(backupPath,'utf8')).scene.layers.some(layer=>layer.type==='brush'));
    await page.getByRole('button',{name:'Back to studio',exact:true}).click();
    await page.locator('#import-input').setInputFiles(backupPath);
    frame=await ready(page);
    assert.ok((await frame.evaluate(()=>window.PrismEditor.scene())).layers.some(layer=>layer.type==='brush'));
    console.log('PASS: editable backup and import');
    await page.getByRole('button',{name:'Back to studio',exact:true}).click();
    await page.locator('#import-input').setInputFiles(path.join(profile,'export.png'));
    frame=await ready(page);
    assert.ok((await frame.evaluate(()=>window.PrismEditor.scene())).layers.some(layer=>layer.type==='image'));
    console.log('PASS: image upload creates editable raster layer');
    await page.getByRole('button',{name:'Back to studio',exact:true}).click();
    await page.getByRole('button',{name:'Options for Desert studies',exact:true}).click();
    await page.getByRole('button',{name:'Duplicate project',exact:true}).click();
    await page.getByRole('button',{name:'Favorite Desert studies copy',exact:true}).click();
    await page.getByRole('button',{name:/Favorites/}).click();
    await page.getByRole('button',{name:'Open Desert studies copy',exact:true}).waitFor();
    await page.getByLabel('Search projects',{exact:true}).fill('not-a-project');
    await page.getByRole('heading',{name:'No matches just yet.'}).waitFor();
    await page.getByLabel('Search projects',{exact:true}).fill('');
    console.log('PASS: duplicate, favorites and search');
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile library has no horizontal overflow');
    await mkdir('.verification',{recursive:true});
    await page.screenshot({path:'.verification/mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:/Your studio/}).click();
    await page.screenshot({path:'.verification/studio.png',fullPage:true});
    await page.getByRole('button',{name:'Open Desert studies',exact:true}).click();await ready(page);
    await page.screenshot({path:'.verification/editor.png',fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('PASS: responsive layout, no browser errors, no external requests');
  } finally {if(context) await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
