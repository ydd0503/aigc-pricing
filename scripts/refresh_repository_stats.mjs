// Public GitHub metadata only. This is not a video-platform collector.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const REPOSITORY = 'ydd0503/aigc-pricing';
export function validateRepositoryStats(value) {
  if(value?.schemaVersion!==1||value.repository!==REPOSITORY
    ||!Number.isSafeInteger(value.stargazersCount)||value.stargazersCount<0
    ||typeof value.checkedAt!=='string'||!Number.isFinite(Date.parse(value.checkedAt))
    ||Date.parse(value.checkedAt)>Date.now()+300_000)
    throw new Error('Invalid public repository statistics');
  return {schemaVersion:1,repository:REPOSITORY,stargazersCount:value.stargazersCount,checkedAt:new Date(value.checkedAt).toISOString()};
}
export function embedRepositoryStats(html, value) {
  const stats=validateRepositoryStats(value);
  const snapshot=/(<script type="application\/json" id="repository-stars-snapshot">)[\s\S]*?(<\/script>)/;
  const count=/(<span class="github-star-count" id="github-star-count"[^>]*>)[^<]*(<\/span>)/;
  if(!snapshot.test(html)||!count.test(html))throw new Error('Repository statistics slots missing');
  const stamp=new Date(stats.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
  const title='最近核对记录：'+stats.stargazersCount+' 个 Star；核对时间 '+stamp;
  return html.replace(snapshot,(_,start,end)=>start+JSON.stringify(stats)+end)
    .replace(count,()=>'<span class="github-star-count" id="github-star-count" title="'+title+'">'
      +stats.stargazersCount.toLocaleString('zh-CN')+'</span>');
}
export async function refreshRepositoryStats({output,htmlFile,fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}) {
  const response=await fetchImpl('https://api.github.com/repos/'+REPOSITORY,{
    method:'GET',headers:{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})},
    signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw new Error('GitHub repository metadata unavailable (HTTP '+response.status+')');
  const data=await response.json();
  if(data.full_name!==REPOSITORY)throw new Error('Unexpected GitHub repository');
  const stats=validateRepositoryStats({schemaVersion:1,repository:data.full_name,
    stargazersCount:data.stargazers_count,checkedAt:new Date().toISOString()});
  const html=htmlFile?embedRepositoryStats(await fs.readFile(htmlFile,'utf8'),stats):null;
  if(output){await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.writeFile(output+'.tmp',JSON.stringify(stats,null,2)+'\n');await fs.rename(output+'.tmp',output);}
  if(htmlFile){await fs.writeFile(htmlFile+'.tmp',html);await fs.rename(htmlFile+'.tmp',htmlFile);}
  return stats;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
  try{const result=await refreshRepositoryStats({output:option('--out','repository-stats.json'),htmlFile:option('--html',null)});
    console.log(JSON.stringify(result));}
  catch{console.error('GitHub Star refresh failed; previous verified snapshot is retained.');process.exitCode=1;}
}
