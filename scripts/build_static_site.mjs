// Build exclusively from the public delivery repository. No provider collector is imported.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const privateKey=/^(?:.*token|authorization|cookie|password|secret|apiKey|headers|request|response|raw|params|paramsDefaults|priceFactors|userId|accountId|email|imageUrl|videoUrl|lastFrameUrl|sourceEvidence)$/i;
function assertPublic(value){
  if(Array.isArray(value))return value.forEach(assertPublic);
  if(value&&typeof value==='object')return Object.entries(value).forEach(([key,item])=>{
    if(privateKey.test(key))throw new Error('Private field in public deployment: '+key);assertPublic(item);
  });
  if(typeof value==='string'&&/(?:[A-Z]:[\\/]Users[\\/]|\.local[\\/]|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b)/i.test(value))
    throw new Error('Private value in public deployment');
}
async function regularFile(file){if(!(await fs.lstat(file)).isFile())throw new Error('Only regular static files can be published');}
export async function buildStaticSite({root=process.cwd(),output='site',platform,commit}={}){
  if(!['cloudflare','github'].includes(platform))throw new Error('Specify cloudflare or github');
  root=path.resolve(root);const destination=path.resolve(root,output);
  const within=value=>value.startsWith(root+path.sep)&&value!==root;
  if(!within(destination))throw new Error('Publish directory must be a project subdirectory');
  const read=async file=>{await regularFile(path.join(root,file));return fs.readFile(path.join(root,file),'utf8');};
  const config=JSON.parse(await read('deploy-config.json'));
  const declared=JSON.parse(await read('data-version.json'));
  const manifest=JSON.parse(await read('data/manifest.json'));
  if(!/^[a-f0-9]{16}$/.test(declared.version)||!/^[a-f0-9]{64}$/.test(declared.sha256)
    ||manifest.version!==declared.version||manifest.sha256!==declared.sha256
    ||manifest.dataset!=='releases/'+declared.version+'.json')throw new Error('Invalid public dataset manifest');
  const releaseNames=(await fs.readdir(path.join(root,'data/releases'))).sort();let current;
  for(const name of releaseNames){
    if(!/^[a-f0-9]{16}\.json$/.test(name))throw new Error('Unexpected file in public release directory');
    const pkg=JSON.parse(await read('data/releases/'+name));
    if(pkg.schemaVersion!==1||pkg.version!==name.slice(0,-5)||sha(pkg.data)!==pkg.sha256
      ||pkg.sha256.slice(0,16)!==pkg.version)throw new Error('Public release checksum mismatch');
    assertPublic(pkg.data);if(pkg.version===declared.version)current=pkg;
  }
  if(!current||current.sha256!==declared.sha256)throw new Error('Current data release missing');
  let html=await read('index.html');const encoded=html.match(/const DATA=(.*?);\r?\n/)?.[1];
  if(!encoded)throw new Error('Static page has no embedded dataset');
  const data=JSON.parse(encoded);assertPublic(data);
  for(const [key,value]of Object.entries(current.data))if(JSON.stringify(data[key])!==JSON.stringify(value))
    throw new Error('HTML and public dataset differ: '+key);
  commit=commit??process.env.CF_PAGES_COMMIT_SHA??process.env.GITHUB_SHA
    ??execFileSync('git',['-c','safe.directory='+root,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Source commit must be a full Git SHA');
  const base=platform==='cloudflare'?'/':'/aigc-pricing/';
  if(config[platform]?.basePath!==base)throw new Error('Unexpected deployment base path');
  let primary=config.cloudflare.url;
  if(primary){const url=new URL(primary);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')
    throw new Error('Invalid canonical deployment URL');primary=url.href;}
  html=html.replace(/<link rel="canonical"[^>]*>/g,'').replace(/<meta name="robots"[^>]*>/g,'');
  if(primary)html=html.replace('</head>','<link rel="canonical" href="'+primary+'">'+(platform==='github'?'<meta name="robots" content="noindex,follow">':'')+'</head>');
  html=html.replace(/<footer id="deployment-version"[^>]*>[\s\S]*?<\/footer>/g,'');
  html=html.replace('</body>','<footer id="deployment-version" style="max-width:1440px;margin:0 auto;padding:12px 24px 24px;font-size:11px;opacity:.65">'
    +'数据版本 '+declared.version+' · 发布版本 '+commit.slice(0,7)+' · <a href="version.json">版本记录</a></footer></body>');
  const now=new Date();const version={schemaVersion:1,platform,repository:config.repository,commit,
    dataVersion:declared.version,dataSha256:declared.sha256,basePath:base,builtAt:now.toISOString(),
    builtAtBeijing:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(now),
    dataCapturedAt:current.data.capturedAt};
  const staging=destination+'.staging-'+randomUUID();
  if(!within(staging))throw new Error('Invalid staging directory');
  await fs.mkdir(staging,{recursive:true});
  try{
    await fs.writeFile(path.join(staging,'index.html'),html);
    for(const file of ['LICENSE','.nojekyll','data-version.json','repository-stats.json']){
      await regularFile(path.join(root,file));await fs.copyFile(path.join(root,file),path.join(staging,file));}
    await fs.mkdir(path.join(staging,'data/releases'),{recursive:true});
    for(const file of ['manifest.json','changes.json']){
      const text=await read('data/'+file);assertPublic(JSON.parse(text));await fs.writeFile(path.join(staging,'data',file),text);}
    for(const file of releaseNames)await fs.copyFile(path.join(root,'data/releases',file),path.join(staging,'data/releases',file));
    await fs.writeFile(path.join(staging,'version.json'),JSON.stringify(version,null,2)+'\n');
    await fs.writeFile(path.join(staging,'404.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面不存在 · AIGC pricing</title></head><body style="font-family:system-ui;padding:48px"><h1>页面不存在</h1><p>请检查地址，或返回比价页面。</p><a href="'+base+'">返回 AIGC pricing</a></body></html>');
    if(platform==='cloudflare')await fs.writeFile(path.join(staging,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
    const files=await fs.readdir(staging,{recursive:true});
    for(const file of files){const info=await fs.lstat(path.join(staging,file));
      if(info.isFile()&&info.size>25*1024*1024)throw new Error('Static file exceeds Pages limit');}
    // Both resolved paths are verified children of the selected public project.
    // The old output is replaced only after all public inputs have passed review.
    const old=await fs.lstat(destination).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(old?.isSymbolicLink())throw new Error('Publish directory cannot be a symbolic link');
    await fs.rm(destination,{recursive:true,force:true});await fs.rename(staging,destination);
    return {platform,output:destination,commit,dataVersion:declared.version,fileCount:files.length,coreDependencies:'same-origin/embedded'};
  }catch(error){if(within(staging))await fs.rm(staging,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
  try{console.log(JSON.stringify(await buildStaticSite({platform:option('--platform'),output:option('--out','site')})));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
