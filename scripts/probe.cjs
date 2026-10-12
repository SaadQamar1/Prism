const { chromium } = require(process.env.PRISM_PLAYWRIGHT_PATH || 'playwright');
const { mkdir } = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PRISM_BROWSER_EXECUTABLE,args:['--disable-gpu','--disable-background-networking']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') console.log('CONSOLE',message.text().slice(0,200));});
    await page.goto('http://127.0.0.1:3002/');
    await page.getByRole('heading',{name:'Your private photo studio.'}).waitFor();
    await mkdir('.verification',{recursive:true});
    await page.screenshot({path:'.verification/studio.png',fullPage:true});
    await page.getByRole('button',{name:'Open Desert studies',exact:true}).click();
    await page.locator('#editor-frame').waitFor({timeout:20000});
    await page.locator('#editor-loading').waitFor({state:'detached',timeout:20000});
    const frame=page.frames().find(frame=>frame.url().includes('/editor/index.html'));
    console.log('API',await frame.evaluate(()=>({api:!!window.PrismEditor,info:window.PrismEditor.info(),config:!!window.AppConfig,fonts:window.AppConfig.FONTS})));
    await page.screenshot({path:'.verification/editor.png',fullPage:true});
    console.log('ERRORS',errors);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
