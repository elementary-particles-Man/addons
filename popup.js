import { openDB, getAll, clearAll } from './idb.js';
const q=s=>document.querySelector(s);const out=q('#out');const status=q('#status');const STORE='chunks';
const refreshStatus=()=>{chrome.runtime.sendMessage({type:'PING'},(res)=>{status.textContent=`status: ws=${res?.ws?'on':'off'} ready=${res?.wsReady?'yes':'no'}`;});};
const renderLatest=async()=>{const db=await openDB('gpt-capture',STORE);const rows=await getAll(db,STORE,200);out.value=rows.slice().reverse().map(r=>`[${new Date(r.ts).toISOString()}] ${r.text}`).join('\n');};
q('#flush').addEventListener('click',()=>{chrome.tabs.query({active:true,currentWindow:true},tabs=>{if(!tabs?.length)return;chrome.tabs.sendMessage(tabs[0].id,{type:'REQUEST_FULL_DUMP'},async()=>{await renderLatest();});});});
q('#copy').addEventListener('click',async()=>{await renderLatest();out.select();document.execCommand('copy');});
q('#clear').addEventListener('click',async()=>{const db=await openDB('gpt-capture',STORE);await clearAll(db,STORE);await renderLatest();});
refreshStatus();renderLatest();
