/* Walking RPG: local-first static PWA. */
const APP_VERSION='v1.6.18';
const Core = (() => {
  const catalog = [];
  const add = (category, rarityRows) => {
    let n = 0;
    rarityRows.forEach(([rarity, names]) => names.forEach(name => catalog.push({ id: `${category[0]}${String(++n).padStart(2,'0')}`, category, name, rarity })));
  };
  add('monster', [
    [1, ['スライム','スライムベス','ドラキー','ゴースト','まほうつかい','メイジドラキー','おおさそり','がいこつ','メーダ','メトロゴースト','ドロル','ドラキーマ']],
    [2, ['まどうし','てつのさそり','リカント','しりょう','リカントマムル','キメラ','ゴールドマン','ヘルゴースト','メーダロード','ドロルメイジ','しりょうのきし']],
    [3, ['しのさそり','よろいのきし','かげのきし','メイジキメラ','キラーリカント','ドラゴン','スターキメラ','だいまどう','ゴーレム']],
    [4, ['メタルスライム','あくまのきし','キースドラゴン','ストーンマン','しにがみのきし','ダースドラゴン']],
    [5, ['りゅうおう','りゅうおう（変身後）']]
  ]);
  add('weapon', [[1,['たけざお','こんぼう']],[2,['どうのつるぎ','てつのおの']],[3,['はがねのつるぎ']],[4,['ほのおのつるぎ']],[5,['ロトのつるぎ']]]);
  const addedEquipmentIds=[];
  let equipmentNo=0;
  const addEquipment = (category, rarityRows) => {
    rarityRows.forEach(([rarity, names]) => names.forEach(name => {
      const id=`e${String(++equipmentNo).padStart(2,'0')}`;
      addedEquipmentIds.push(id);
      catalog.push({id,category,name,rarity});
    }));
  };
  addEquipment('armor', [[1,['ぬののふく','かわのふく']],[2,['くさりかたびら','てつのよろい']],[3,['はがねのよろい']],[4,['まほうのよろい']],[5,['ロトのよろい']]]);
  addEquipment('shield', [[1,['かわのたて']],[2,['てつのたて']],[4,['みかがみのたて']]]);
  add('spell', [[1,['ホイミ','ギラ','ラリホー','レミーラ']],[2,['マホトーン','リレミト']],[3,['ルーラ','トヘロス']],[4,['ベホイミ']],[5,['ベギラマ']]]);
  const byId = Object.fromEntries(catalog.map(item => [item.id,item]));
  const legacyIds=catalog.filter(item=>!addedEquipmentIds.includes(item.id)).map(item=>item.id);
  const newState = () => ({ version:1, daily:[], walks:[], strength:[], earnedSteps:0, earnedDistance:0, earnedSquats:0, earnedPlank:0, spent:0, items:Object.fromEntries(catalog.map(i=>[i.id,{count:0,main:null,info:null,text:''}])) });
  const totalSteps = s => s.daily.reduce((a,r)=>a+(Number(r.steps)||0),0);
  const totalDistance = s => s.walks.reduce((a,r)=>a+(Number(r.distance)||0),0);
  const validDate=value=>{
    if(typeof value!=='string')return false;
    const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return false;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if(month<1||month>12)return false;
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    return day>=1&&day<=days[month-1];
  };
  function strengthTotals(rows) {
    return rows.reduce((total,row)=>{
      total.squats+=row.squats;
      total.plankSeconds+=row.plankSeconds;
      return total;
    },{squats:0,plankSeconds:0});
  }
  function validateStrength(rows) {
    if(!Array.isArray(rows))throw Error('筋トレ記録の形式が不正です。');
    const dates=new Set();
    for(const row of rows){
      if(!row||!validDate(row.date)||dates.has(row.date)||
         !Number.isSafeInteger(row.squats)||row.squats<0||
         !Number.isSafeInteger(row.plankSeconds)||row.plankSeconds<0){
        throw Error('日付と、0以上の整数の回数・秒数を確認してください。');
      }
      dates.add(row.date);
    }
    const totals=strengthTotals(rows);
    if(!Number.isSafeInteger(totals.squats)||!Number.isSafeInteger(totals.plankSeconds)){
      throw Error('筋トレの累計が保存できる範囲を超えています。');
    }
    return totals;
  }
  function setStrength(s,row) {
    const rows=s.strength.filter(other=>other.date!==row.date);
    rows.push(row);
    validateStrength(rows);
    s.strength=rows;
    award(s);
  }
  function award(s) {
    s.earnedSteps = Math.max(s.earnedSteps, Math.floor(totalSteps(s)/1000));
    s.earnedDistance = Math.max(s.earnedDistance, Math.floor(totalDistance(s))*2);
    const totals=strengthTotals(s.strength);
    s.earnedSquats=Math.max(s.earnedSquats,Math.floor(totals.squats/10));
    s.earnedPlank=Math.max(s.earnedPlank,Math.floor(totals.plankSeconds/60));
  }
  const earnedTotal = s => s.earnedSteps+s.earnedDistance+s.earnedSquats+s.earnedPlank;
  const available = s => Math.max(0,earnedTotal(s)-s.spent);
  function pick(s, boosted=false, rng=Math.random) {
    const weights = boosted ? [6,5,4,5,4] : [6,5,4,3,2];
    const eligible = catalog.filter(i=>s.items[i.id].count<3);
    const weighted = eligible.map(i=>[i,weights[i.rarity-1]]);
    const total = weighted.reduce((a,[,w])=>a+w,0);
    if (!total) return null;
    let point = rng()*total;
    for (const [item,weight] of weighted) { point -= weight; if (point < 0) return item; }
    return weighted.at(-1)[0];
  }
  function validate(s) {
    if (!s || s.version!==1 || !Array.isArray(s.daily) || !Array.isArray(s.walks) || !s.items || typeof s.items!=='object') throw Error('バックアップ形式が正しくありません。');
    const knownIds=new Set(catalog.map(item=>item.id)), itemIds=Object.keys(s.items);
    if(itemIds.some(id=>!knownIds.has(id))||legacyIds.some(id=>!Object.hasOwn(s.items,id)))throw Error('図鑑データ件数が一致しません。');
    for(const id of addedEquipmentIds)if(!Object.hasOwn(s.items,id))s.items[id]={count:0,main:null,info:null,text:''};
    const dailyDates=new Set();for (const row of s.daily){
      if(!validDate(row.date))throw Error(`日次記録の日付形式が不正です（${String(row.date)}）。`);
      if(!Number.isInteger(row.steps)||row.steps<0)throw Error(`日次記録の歩数が不正です（${row.date}）。`);
      if(dailyDates.has(row.date))throw Error(`日次記録が同じ日付で重複しています（${row.date}）。データは変更していません。`);
      dailyDates.add(row.date);
    }
    const walkIds=new Set();for (const row of s.walks){if(typeof row.id!=='string'||!row.id||!validDate(row.date)||!Number.isFinite(row.distance)||row.distance<0||walkIds.has(row.id))throw Error('散歩記録に不正または重複したID・日付・距離があります。');walkIds.add(row.id);}
    const strengthKeys=['strength','earnedSquats','earnedPlank'];
    if(strengthKeys.every(key=>!Object.hasOwn(s,key))){
      s.strength=[];s.earnedSquats=0;s.earnedPlank=0;
    }
    const strength=validateStrength(s.strength);
    if(!Number.isSafeInteger(s.earnedSquats)||s.earnedSquats<Math.floor(strength.squats/10)||
       !Number.isSafeInteger(s.earnedPlank)||s.earnedPlank<Math.floor(strength.plankSeconds/60)){
      throw Error('筋トレ報酬の状態が記録と整合しません。');
    }
    for (const key of ['earnedSteps','earnedDistance','spent']) if (!Number.isInteger(s[key]) || s[key]<0) throw Error('ガチャ状態の値が不正です。');
    // Accept legacy 1-per-km counters; award runs only after full validation, before saving.
    if(s.spent>earnedTotal(s)||s.earnedSteps<Math.floor(totalSteps(s)/1000)||s.earnedDistance<Math.floor(totalDistance(s)))throw Error('ガチャ回数の状態が記録と整合しません。');
    if (Object.keys(s.items).length!==catalog.length) throw Error('図鑑データ件数が一致しません。');
    for (const item of catalog) {
      const v=s.items[item.id];
      if (!v || !Number.isInteger(v.count) || v.count<0 || v.count>3 || !(v.main===null||(typeof v.main==='string'&&v.main.startsWith('data:image/'))) || !(v.info===null||(typeof v.info==='string'&&v.info.startsWith('data:image/'))) || typeof v.text!=='string') throw Error(`図鑑データが不正です：${item.name}`);
    }
    return s;
  }
  const normalize = t => t.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[，、]/g,',').replace(/[．。]/g,'.').replace(/[：]/g,':');
  function parseDaily(raw) {
    const t=normalize(raw), full=t.match(/(20\d{2})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/), partial=t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    let date=''; if(full) date=`${full[1]}-${String(full[2]).padStart(2,'0')}-${String(full[3]).padStart(2,'0')}`; else if(partial) { const now=new Date(); date=`${now.getFullYear()}-${String(partial[1]).padStart(2,'0')}-${String(partial[2]).padStart(2,'0')}`; }
    let steps=''; const lines=t.split(/\n+/);
    const stepNumbers=line=>[...(line||'').matchAll(/(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d{3,})(?![\d.,])/g)].map(m=>Number(m[0].replace(/,/g,''))).filter(n=>n>=100&&n<=999999&&!(n>=1900&&n<=2099));
    for(let i=0;i<lines.length;i++) if(/歩数|歩/.test(lines[i])) {
      // Prefer a number on the label line, then the preceding line (common OCR layout), then following.
      const candidates=[...stepNumbers(lines[i]),...stepNumbers(lines[i-1]),...stepNumbers(lines[i+1])];
      if(candidates.length){steps=String(candidates[0]);break;}
    }
    return {date,steps};
  }
  function parseWalks(raw) {
    const lines=normalize(raw).split(/\n+/).map(x=>x.trim()).filter(Boolean), out=[]; let year='',month='';
    const ym=/(20\d{2})\s*年\s*(\d{1,2})\s*月/, full=/(20\d{2})\s*[/.年-]\s*(\d{1,2})\s*[/.月-]\s*(\d{1,2})\s*日?/, md=/(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
    for(let i=0;i<lines.length;i++){
      const h=lines[i].match(ym); if(h){year=h[1];month=h[2];}
      const dm=lines[i].match(/(\d+(?:\.\d+)?)\s*(?:km|㎞|キロメートル)/i); if(!dm)continue;
      let date=''; for(let j=i;j>=Math.max(0,i-2);j--){const line=lines[j],f=line.match(full),m=line.match(md),day=line.match(/(?:^|\s)(\d{1,2})\s*日(?:\s|$)/),slash=line.match(/(?:^|\s)(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s|$)/);
        if(f){date=`${f[1]}-${String(f[2]).padStart(2,'0')}-${String(f[3]).padStart(2,'0')}`;break;} if(m&&year){date=`${year}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;break;} if(slash&&year){date=`${year}-${String(slash[1]).padStart(2,'0')}-${String(slash[2]).padStart(2,'0')}`;break;} if(day&&year&&month){date=`${year}-${String(month).padStart(2,'0')}-${String(day[1]).padStart(2,'0')}`;break;}
      }
      out.push({date,distance:Number(dm[1])});
    }
    return out;
  }
  return {catalog,byId,newState,totalSteps,totalDistance,strengthTotals,setStrength,award,available,pick,validate,parseDaily,parseWalks};
})();

(() => {
  const $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
  $('appVersion').textContent=APP_VERSION;
  let state, db, worker, mode='daily', category='all', ownership='owned', activeItem=null, editing=false, editDraft=null, toastTimer;
  let shownMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1), editingSaved=null;
  const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const toast=message=>{const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),2600);};
  function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('walking-rpg-local',1);req.onupgradeneeded=()=>req.result.createObjectStore('data',{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function dbRead(){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly'),r=tx.objectStore('data').get('root');r.onsuccess=()=>resolve(r.result?.value||Core.newState());r.onerror=()=>reject(r.error);});}
  function dbWrite(next){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put({key:'root',value:next});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存に失敗しました'));});}
  async function persist(){try{await dbWrite(state);render();}catch(e){toast(`保存できませんでした：${e.message}`);throw e;}}
  const rewardUpdate=()=>Core.award(state);
  function setScreen(name){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.screen===name));document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${name}`));}
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setScreen(b.dataset.screen)));

  function render(){
    const steps=Core.totalSteps(state),dist=Core.totalDistance(state);
    $('availableCount').textContent=Core.available(state);$('gachaCount').textContent=Core.available(state);
    $('stepProgress').textContent=`${steps.toLocaleString()}歩`;
    $('walkProgress').textContent=`${dist.toFixed(2)}km`;
    const totals=Core.strengthTotals(state.strength);
    $('squatProgress').textContent=`${totals.squats.toLocaleString()}回`;
    $('plankProgress').textContent=`${totals.plankSeconds.toLocaleString()}秒`;
    $('drawOne').disabled=Core.available(state)<1||!state.items||!Core.catalog.some(i=>state.items[i.id].count<3);
    $('drawTen').disabled=Core.available(state)<10||!Core.catalog.some(i=>state.items[i.id].count<3);
    $('gachaHint').textContent=Core.catalog.every(i=>state.items[i.id].count>=3)?'すべてのアイテムが3回獲得済みです。ガチャ回数は保持されます。':'';
    renderSaved();renderStrength();renderCollection();
  }
  function loadStrengthDate(date){
    const row=state?.strength.find(entry=>entry.date===date);
    $('strengthDate').value=date;
    $('squatCount').value=row?.squats??0;
    $('plankSeconds').value=row?.plankSeconds??0;
  }
  function renderStrength(){
    const root=$('strengthRecords');
    root.replaceChildren();
    if(!state.strength.length){
      const empty=document.createElement('p');
      empty.className='empty';empty.textContent='筋トレ記録はありません';root.append(empty);
      return;
    }
    const table=document.createElement('table');
    table.className='record-table';
    table.innerHTML='<thead><tr><th scope="col">日付</th><th scope="col">スクワット</th><th scope="col">プランク</th><th scope="col" aria-label="編集"></th></tr></thead>';
    const body=document.createElement('tbody');
    for(const row of [...state.strength].sort((a,b)=>b.date.localeCompare(a.date))){
      const entry=document.createElement('tr');
      for(const value of [formatSavedDate(row.date),`${row.squats.toLocaleString()}回`,`${row.plankSeconds.toLocaleString()}秒`]){
        const cell=document.createElement('td');
        cell.textContent=value;
        entry.append(cell);
      }
      const action=document.createElement('td');
      const edit=document.createElement('button');
      edit.type='button';edit.className='secondary small-button saved-edit-icon';edit.textContent='✎';edit.title='編集';
      edit.setAttribute('aria-label',`${formatSavedDate(row.date)}の筋トレ記録を編集`);
      edit.onclick=()=>{loadStrengthDate(row.date);$('squatCount').focus();};
      action.append(edit);entry.append(action);body.append(entry);
    }
    table.append(body);root.append(table);
  }
  $('strengthDate').value=todayISO();
  $('strengthDate').onchange=()=>loadStrengthDate($('strengthDate').value);
  $('strengthForm').onsubmit=async e=>{
    e.preventDefault();
    const save=$('saveStrength');
    if(!state||save.disabled)return;
    const date=$('strengthDate').value,squats=$('squatCount').value,plank=$('plankSeconds').value;
    if(squats===''||plank===''){toast('回数と秒数を入力してください');return;}
    const next={...state};
    try{Core.setStrength(next,{date,squats:Number(squats),plankSeconds:Number(plank)});}
    catch(error){toast(error.message);return;}
    // Keep other save actions from replacing the snapshot during this write.
    save.disabled=true;
    document.body.inert=true;
    try{
      await dbWrite(next);
      state=next;
      render();
      toast('筋トレ記録を保存しました');
    }catch(error){toast(`保存できませんでした：${error.message}`);}
    finally{document.body.inert=false;save.disabled=false;}
  };
  function renderSaved(){
    const root=$('savedRecords');root.replaceChildren();
    const year=shownMonth.getFullYear(),month=shownMonth.getMonth()+1;
    $('savedMonthLabel').textContent=`${year}年${month}月`;
    const now=new Date(),isCurrent=year===now.getFullYear()&&month===now.getMonth()+1;
    const isFuture=year>now.getFullYear()||(year===now.getFullYear()&&month>now.getMonth()+1);
    $('savedNextMonth').disabled=isCurrent||isFuture;
    const monthKey=`${year}-${String(month).padStart(2,'0')}`;
    const rows=[
      ...state.daily.map(row=>({row,type:'daily'})),
      ...state.walks.map(row=>({row,type:'walk'}))
    ].filter(({row})=>row.date.startsWith(monthKey))
      .sort((a,b)=>b.row.date.localeCompare(a.row.date));
    if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='この月の記録はありません';root.append(empty);return;}

    const table=document.createElement('table');
    table.className='record-table';
    table.innerHTML='<thead><tr><th scope="col">日付</th><th scope="col">日次歩数</th><th scope="col">散歩距離</th><th scope="col" aria-label="編集"></th></tr></thead>';
    const body=document.createElement('tbody');
    for(const {row,type} of rows)body.append(renderSavedRow(row,type));
    table.append(body);root.append(table);
  }
  function formatSavedDate(date){return date.replaceAll('-','/');}
  function savedEditForm(row,type){
    const form=document.createElement('div');form.className='saved-edit';
    const dateField=document.createElement('label');dateField.className='saved-edit-field';dateField.textContent='日付';
    const date=document.createElement('input');date.type='date';date.value=row.date;date.setAttribute('aria-label','記録の日付');const dateControl=document.createElement('div');dateControl.className='saved-edit-control';dateControl.append(date);dateField.append(dateControl);
    const valueField=document.createElement('label');valueField.className='saved-edit-field';valueField.textContent=type==='daily'?'歩数':'距離（km）';
    const value=document.createElement('input');value.type='number';value.min='0';value.step=type==='daily'?'1':'.01';value.value=type==='daily'?row.steps:row.distance;value.setAttribute('aria-label',type==='daily'?'歩数':'散歩距離 km');const valueControl=document.createElement('div');valueControl.className='saved-edit-control';valueControl.append(value);valueField.append(valueControl);
    form.append(dateField,valueField);const actions=document.createElement('div');actions.className='saved-edit-actions';
    const save=document.createElement('button');save.className='small-button';save.textContent='保存';
    save.onclick=async()=>{
      const numeric=Number(value.value);
      if(!date.value||value.value===''||!Number.isFinite(numeric)||numeric<0||(type==='daily'&&!Number.isInteger(numeric))){toast(type==='daily'?'日付と歩数を確認してください':'日付と距離を確認してください');return;}
      if(type==='daily'&&state.daily.some(other=>other!==row&&other.date===date.value)){toast('その日付の記録は既にあります。対象日の記録を修正してください');return;}
      row.date=date.value;if(type==='daily')row.steps=numeric;else row.distance=numeric;
      shownMonth=new Date(Number(date.value.slice(0,4)),Number(date.value.slice(5,7))-1,1);
      editingSaved=null;rewardUpdate();await persist();toast('記録を更新しました');
    };
    const cancel=document.createElement('button');cancel.className='secondary small-button';cancel.textContent='キャンセル';cancel.onclick=()=>{editingSaved=null;renderSaved();};
    actions.append(save,cancel);form.append(actions);return form;
  }
  function renderSavedRow(row,type){
    const entry=document.createElement('tr');
    if(editingSaved?.row===row&&editingSaved.type===type){
      const cell=document.createElement('td');
      cell.colSpan=4;cell.className='record-table-editor';
      cell.append(savedEditForm(row,type));entry.append(cell);
      return entry;
    }
    const daily=type==='daily',date=formatSavedDate(row.date);
    const value=daily?`${row.steps.toLocaleString()}歩`:`${Number(row.distance).toFixed(2)}km`;
    for(const text of [date,daily?value:'—',daily?'—':value]){
      const cell=document.createElement('td');
      cell.textContent=text;entry.append(cell);
    }
    const action=document.createElement('td'),edit=document.createElement('button');
    edit.type='button';edit.className='secondary small-button saved-edit-icon';edit.textContent='✎';edit.title='編集';
    edit.setAttribute('aria-label',`${date}の${daily?'日次歩数':'散歩距離'} ${value}を編集`);
    edit.onclick=()=>{editingSaved={type,row};renderSaved();};
    action.append(edit);entry.append(action);
    return entry;
  }
  function moveSavedMonth(amount){editingSaved=null;shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+amount,1);renderSaved();}
  $('savedPrevMonth').onclick=()=>moveSavedMonth(-1);$('savedNextMonth').onclick=()=>{const now=new Date();if(shownMonth.getFullYear()<now.getFullYear()||(shownMonth.getFullYear()===now.getFullYear()&&shownMonth.getMonth()<now.getMonth()))moveSavedMonth(1);};
  $('savedThisMonth').onclick=()=>{editingSaved=null;const now=new Date();shownMonth=new Date(now.getFullYear(),now.getMonth(),1);renderSaved();};
  window.addEventListener('pageshow',()=>{editingSaved=null;const now=new Date();shownMonth=new Date(now.getFullYear(),now.getMonth(),1);if(state)renderSaved();});

  let ocrBusy=false,activeImportJob=null;
  const emptyImport=()=>({file:null,url:'',status:'画像を選択してください',text:'',time:'',error:'',results:false,progress:0});
  const imports={daily:emptyImport(),walk:emptyImport()};
  const importLabel=type=>type==='daily'?'日次歩数':'散歩一覧';
  const validImportJob=job=>imports[job.type]===job.draft;
  function showImport(type){
    mode=type;const draft=imports[type],label=importLabel(type);
    for(const t of ['daily','walk'])$(`${t}ImportView`).classList.toggle('hidden',!imports[t].file);
    $('screenshotPreview').classList.toggle('hidden',!draft.file);
    if(draft.url)$('screenshotPreview').src=draft.url;else $('screenshotPreview').removeAttribute('src');
    $('screenshotPreview').alt=`${label}の選択画像`;
    $('runOcr').disabled=!draft.file||ocrBusy;$('runOcr').textContent=draft.file?`${label}をOCR`:'OCRを実行';
    $('cancelImport').classList.toggle('hidden',!draft.file);$('cancelImport').setAttribute('aria-label',`${label}の取り込みをキャンセル`);
    $('ocrHeading').textContent=`${label}の読み取り結果`;$('ocrStatus').textContent=draft.status;
    $('ocrText').textContent=draft.text;$('ocrTime').textContent=draft.time;$('ocrError').textContent=draft.error;
    $('ocrError').classList.toggle('hidden',!draft.error);$('ocrResults').classList.toggle('hidden',!draft.results);
    $('dailyResult').classList.toggle('hidden',type!=='daily');$('walkResult').classList.toggle('hidden',type!=='walk');
    $('ocrProgress').classList.toggle('hidden',!(activeImportJob&&validImportJob(activeImportJob)&&activeImportJob.type===type));$('ocrProgress').value=draft.progress;
  }
  function resetImport(type){
    const old=imports[type];if(old.url)URL.revokeObjectURL(old.url);imports[type]=emptyImport();
    $(`${type}Screenshot`).value='';$(`${type}PasteTarget`).textContent='画像を貼り付け';
    $(`${type}Screenshot`).closest('details').open=false;
    if(type==='daily'){$('dailyDate').value='';$('dailySteps').value='';}
    else{candidates=[];$('walkCandidates').replaceChildren();$('selectedDistance').textContent='0.00';}
  }
  function loadImage(file,type){
    if(!file||!file.type.startsWith('image/')){toast('画像を取得できませんでした');return;}
    resetImport(type);const draft=imports[type];draft.file=file;draft.url=URL.createObjectURL(file);
    draft.status=`${importLabel(type)}の画像を読み込みました（${Math.round(file.size/1024)}KB）`;showImport(type);
  }
  $('cancelImport').onclick=()=>{resetImport(mode);showImport(mode);};
  for(const type of ['daily','walk']){
    $(`${type}ImportView`).onclick=()=>showImport(type);
    $(`${type}Screenshot`).onchange=e=>{const file=e.target.files?.[0];if(file)loadImage(file,type);e.target.value='';};
    $(`${type}PasteTarget`).addEventListener('paste',e=>{
      const file=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'))?.getAsFile();
      e.preventDefault();if(file)loadImage(file,type);else toast('クリップボードに画像がありません');
    });
  }
  $('dailyToday').onclick=()=>{$('dailyDate').value=todayISO();};
  $('runOcr').onclick=async()=>{
    const type=mode,draft=imports[type];if(!draft.file||ocrBusy)return;
    const job={type,draft},start=performance.now();activeImportJob=job;ocrBusy=true;
    draft.status='OCRを準備しています…';draft.time='処理中…';draft.error='';draft.progress=0;showImport(mode);
    try{
      if(!window.Tesseract)throw Error('Tesseract.jsを読み込めません。インターネット接続を確認してください。');
      if(!worker){worker=await Tesseract.createWorker('jpn+eng',1,{logger:m=>{
        const current=activeImportJob;if(!current||!validImportJob(current))return;
        if(m.status)current.draft.status=m.status;if(typeof m.progress==='number')current.draft.progress=m.progress;
        if(mode===current.type)showImport(mode);
      }});await worker.setParameters({preserve_interword_spaces:'1'});}
      if(!validImportJob(job))return;
      const result=await worker.recognize(draft.file);if(!validImportJob(job))return;
      const text=result.data.text||'';draft.text=text||'（文字を取得できませんでした）';draft.results=true;
      if(type==='daily'){const parsed=Core.parseDaily(text);$('dailyDate').value=parsed.date;$('dailySteps').value=parsed.steps;}
      else renderCandidates(Core.parseWalks(text));
      draft.status='読み取り完了。登録前に確認してください。';
    }catch(e){if(validImportJob(job)){draft.error=e.stack||String(e);draft.status='OCRに失敗しました';}}
    finally{if(validImportJob(job))draft.time=`処理時間：${((performance.now()-start)/1000).toFixed(2)}秒`;activeImportJob=null;ocrBusy=false;showImport(mode);}
  };
  function isDuplicate(date,distance){return state.walks.some(w=>w.date===date&&Number(w.distance)===Number(distance));}
  let candidates=[];
  function renderCandidates(rows){candidates=rows.map(r=>{const duplicate=!!r.date&&isDuplicate(r.date,r.distance);return {...r,duplicate,selected:!duplicate,touched:false};});const root=$('walkCandidates');root.replaceChildren();
    if(!candidates.length){const p=document.createElement('p');p.className='empty';p.textContent='散歩候補を読み取れませんでした。別の画像を選ぶか、生テキストを確認してください。';root.append(p);}
    candidates.forEach((r,index)=>{const block=document.createElement('div');block.className='candidate';const head=document.createElement('div');head.className='candidate-header';const check=document.createElement('input');check.type='checkbox';check.checked=r.selected;check.onchange=()=>{r.selected=check.checked;r.touched=true;updateCandidateTotal();};const name=document.createElement('strong');name.textContent=`記録 ${index+1}`;head.append(check,name);block.append(head);const fields=document.createElement('div');fields.className='candidate-fields';const date=document.createElement('input');date.type='date';date.value=r.date;date.setAttribute('aria-label','散歩日付');const distance=document.createElement('input');distance.type='number';distance.min='0';distance.step='.01';distance.value=r.distance;distance.setAttribute('aria-label','距離 km');const dateControl=document.createElement('div');dateControl.className='candidate-date-control';dateControl.append(date);const today=document.createElement('button');today.type='button';today.className='secondary candidate-today';today.textContent='今日';today.setAttribute('aria-label',`記録 ${index+1} の日付を今日にする`);fields.append(dateControl,today,distance);block.append(fields);const duplicate=document.createElement('p');duplicate.className='duplicate';block.append(duplicate);
      const refresh=()=>{r.date=date.value;r.distance=Number(distance.value);r.duplicate=!!r.date&&isDuplicate(r.date,r.distance);duplicate.textContent=r.duplicate?'登録済み候補（日付＋距離が一致）':'';if(!r.touched){r.selected=!r.duplicate;check.checked=r.selected;}updateCandidateTotal();};date.oninput=refresh;distance.oninput=refresh;today.onclick=()=>{date.value=todayISO();refresh();};refresh();root.append(block);});updateCandidateTotal();}
  function updateCandidateTotal(){$('selectedDistance').textContent=candidates.filter(c=>c.selected).reduce((a,c)=>a+(Number(c.distance)||0),0).toFixed(2);}
  $('saveDaily').onclick=async()=>{const date=$('dailyDate').value,steps=Number($('dailySteps').value);if(!date||$('dailySteps').value===''||!Number.isInteger(steps)||steps<0){toast('日付と歩数を確認してください');return;}const matches=state.daily.reduce((n,r)=>n+(r.date===date?1:0),0);if(matches>1){toast('同じ日付の日次記録が重複しているため保存を中止しました。データを変更していません');return;}const old=state.daily.findIndex(r=>r.date===date);if(old>=0)state.daily[old]={date,steps};else state.daily.push({date,steps});rewardUpdate();await persist();imports.daily.results=false;showImport(mode);toast('日次記録を保存しました');};
  $('saveWalks').onclick=async()=>{const selected=candidates.filter(c=>c.selected);if(!selected.length){toast('追加する散歩を選択してください');return;}if(selected.some(r=>!r.date||!Number.isFinite(Number(r.distance))||Number(r.distance)<=0)){toast('選択した記録の日付・距離を確認してください');return;}for(const r of selected)state.walks.push({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,date:r.date,distance:Number(r.distance)});rewardUpdate();await persist();imports.walk.results=false;showImport(mode);toast(`${selected.length}件の散歩を追加しました`);};

  $('drawOne').onclick=()=>draw(1);$('drawTen').onclick=()=>draw(10);
  async function draw(amount){const actual=Math.min(amount,Core.available(state));if(!actual)return;const result=[];for(let i=0;i<actual;i++){const item=Core.pick(state,amount===10&&i===9);if(!item)break;const record=state.items[item.id],isNew=record.count===0;record.count++;result.push({item,isNew});}if(!result.length){toast('抽選対象がありません');return;}state.spent+=result.length;await persist();renderDraw(result);setScreen('gacha');}
  function renderDraw(results){const root=$('drawResults');root.replaceChildren();results.forEach(({item,isNew})=>{const card=document.createElement('article');card.className='draw-card';if(item.rarity>=4)card.classList.add(`rarity-card-${item.rarity}`);const data=state.items[item.id];if(data.main){const img=document.createElement('img');img.src=data.main;img.alt=item.name;card.append(img);}else{const ph=document.createElement('div');ph.className='placeholder';ph.textContent=item.category==='spell'?'✦':'◇';card.append(ph);}const title=document.createElement('strong');title.textContent=item.name;card.append(title);const meta=document.createElement('small');meta.className='rarity-meta';meta.append(rarityStars(item.rarity),acquisitionCount(String(data.count)));card.append(meta);if(isNew){const badge=document.createElement('span');badge.className='new-badge';badge.textContent='NEW';card.append(badge);}root.append(card);});}

  function acquisitionCount(text){const count=document.createElement('span');count.className='acquisition-count';count.textContent=text;return count;}
  function rarityStars(rarity){
    const stars=document.createElement('span');stars.className=`rarity-stars rarity-${rarity}`;
    stars.textContent='★'.repeat(rarity);stars.setAttribute('aria-label',`レア度${rarity}`);return stars;
  }
  function lockIcon(){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('collection-lock');
    const path=document.createElementNS(ns,'path');
    path.setAttribute('d','M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3');
    svg.append(path);return svg;
  }
  function renderCollection(){
    const owned=Core.catalog.filter(i=>state.items[i.id].count>0),root=$('collectionGrid');
    $('collectionCount').textContent=`${owned.length}/67種類`;root.replaceChildren();
    let items=Core.catalog.filter(i=>(category==='all'||i.category===category||(category==='equipment'&&['weapon','armor','shield'].includes(i.category)))&&(ownership==='all'||(ownership==='owned'?state.items[i.id].count>0:state.items[i.id].count===0)));
    if(!items.length){const empty=document.createElement('p');empty.className='empty collection-empty';empty.textContent='該当するアイテムはありません。';root.append(empty);return;}
    if(category==='equipment')items=['weapon','armor','shield'].flatMap(group=>{const matches=items.filter(i=>i.category===group);return matches.length?[{groupHeading:group},...matches]:[];});
    items.forEach(item=>{
      if(item.groupHeading){const heading=document.createElement('h3');heading.className='collection-group-heading';heading.textContent={weapon:'武器',armor:'鎧',shield:'盾'}[item.groupHeading];root.append(heading);return;}
      const data=state.items[item.id],tile=document.createElement('button');tile.className=`item-tile ${data.count?'':'locked'}`;if(data.count&&item.rarity>=4)tile.classList.add(`rarity-card-${item.rarity}`);
      const spellImage=item.category==='spell'?'./spell-staff-b.png':'';
      if(data.count&&(spellImage||data.main)){
        const img=document.createElement('img');img.src=spellImage||data.main;img.alt='';
        if(spellImage)img.className='spell-preview-image';
        tile.append(img);
      }
      else{const ph=document.createElement('div');ph.className='tile-empty';if(data.count)ph.textContent='◇';else ph.append(lockIcon());tile.append(ph);}
      const name=document.createElement('strong');name.textContent=data.count?item.name:'？？？';tile.append(name);
      const meta=document.createElement('small');if(data.count){meta.className='rarity-meta';meta.append(rarityStars(item.rarity),acquisitionCount(String(data.count)));}else meta.textContent='未獲得';tile.append(meta);
      tile.onclick=()=>{if(!data.count){toast('ガチャで獲得すると詳細を開けます');return;}openItem(item);};root.append(tile);
    });
  }
  document.querySelectorAll('[data-ownership]').forEach(b=>b.onclick=()=>{ownership=b.dataset.ownership;document.querySelectorAll('[data-ownership]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderCollection();});
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('selected',x===b));renderCollection();});

  function hasMaterial(data){return !!(data.main||data.info||data.text.trim());}
  function openItem(item){activeItem=item;editDraft=clone(state.items[item.id]);editing=!hasMaterial(editDraft);renderItem();$('itemDialog').showModal();}
  $('closeDetail').onclick=()=>$('itemDialog').close();
  const itemDialog=$('itemDialog');let detailBackdropDown=false;
  const isDetailBackdrop=e=>e.target===itemDialog;
  itemDialog.addEventListener('pointerdown',e=>{detailBackdropDown=isDetailBackdrop(e);});
  itemDialog.addEventListener('pointercancel',()=>{detailBackdropDown=false;});
  itemDialog.addEventListener('close',()=>{detailBackdropDown=false;});
  itemDialog.addEventListener('click',e=>{const close=!editing&&detailBackdropDown&&isDetailBackdrop(e);detailBackdropDown=false;if(close)itemDialog.close();});

  function renderItem(){const item=activeItem,data=editing?editDraft:state.items[item.id];$('detailName').textContent=item.name;$('detailMeta').replaceChildren(rarityStars(item.rarity),document.createTextNode(`　獲得 ${state.items[item.id].count}/3回`));
    const root=$('detailBody');root.replaceChildren();
    if(!editing){const edit=document.createElement('button');edit.className='detail-edit-button';edit.textContent='編集';edit.onclick=()=>{editDraft=clone(state.items[item.id]);editing=true;renderItem();};root.append(edit);if(item.category!=='spell'&&data.main){const im=document.createElement('img');im.className='detail-image';im.src=data.main;im.alt='メイン画像';root.append(im);}if(data.info){const im=document.createElement('img');im.className='detail-image';im.src=data.info;im.alt='情報画像';root.append(im);}if(data.text.trim()){const p=document.createElement('p');p.className='detail-text';p.textContent=data.text;root.append(p);}return;}
    if(item.category!=='spell')renderImageSlot(root,'main','メイン画像',512);
    renderImageSlot(root,'info','情報画像',1600);
    const textSlot=document.createElement('section');textSlot.className='edit-slot';const label=document.createElement('label');label.textContent='情報テキスト';const textarea=document.createElement('textarea');textarea.className='edit-text';textarea.value=editDraft.text;textarea.placeholder='紹介文や自分用のメモ';textarea.oninput=()=>editDraft.text=textarea.value;textSlot.append(label,textarea);root.append(textSlot);
    const links=document.createElement('div');links.className='search-links';if(item.category!=='spell')links.append(searchLink('Google画像検索',`${item.name} ドラクエ1 イラスト`,true));links.append(searchLink('Google情報検索',`${item.name} ドラクエ1 紹介`,false));root.append(links);
    const actions=document.createElement('div');actions.className='actions';const save=document.createElement('button');save.textContent='保存';save.onclick=async()=>{state.items[item.id]=editDraft;await persist();editing=false;renderItem();toast('図鑑資料を保存しました');};const cancel=document.createElement('button');cancel.className='secondary';cancel.textContent='キャンセル';cancel.onclick=()=>{editDraft=clone(state.items[item.id]);editing=false;if(hasMaterial(editDraft))renderItem();else $('itemDialog').close();};actions.append(save,cancel);root.append(actions);
  }
  function searchLink(label,query,images){const a=document.createElement('a');a.textContent=label;a.target='_blank';a.rel='noopener';a.href=`https://www.google.com/search?q=${encodeURIComponent(query)}${images?'&tbm=isch':''}`;return a;}
  function renderImageSlot(root,key,label,maxSide){
    const section=document.createElement('section');section.className='edit-slot';const title=document.createElement('strong');title.textContent=label;section.append(title);
    if(editDraft[key]){const img=document.createElement('img');img.src=editDraft[key];img.alt=label;section.append(img);}
    const row=document.createElement('div');row.className='slot-actions detail-image-actions';
    const choose=document.createElement('label');choose.className='button secondary';choose.textContent='画像を選択';
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;
    input.onchange=async()=>{if(input.files[0]){editDraft[key]=await compressImage(input.files[0],maxSide);renderItem();}};
    choose.append(input);row.append(choose);
    const paste=document.createElement('div');paste.className='detail-image-paste secondary';paste.contentEditable='true';paste.textContent='画像を貼り付け';paste.setAttribute('role','textbox');paste.setAttribute('aria-label',`${label}を長押ししてペースト`);paste.title='長押ししてペースト';paste.spellcheck=false;
    paste.addEventListener('paste',async e=>{const file=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'))?.getAsFile();e.preventDefault();if(file){editDraft[key]=await compressImage(file,maxSide);renderItem();}else toast('画像が含まれていません');});
    row.append(paste);
    if(editDraft[key]){const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='削除';remove.onclick=()=>{editDraft[key]=null;renderItem();};row.append(remove);}
    section.append(row);root.append(section);
  }
  async function compressImage(file,maxSide){let image,release=()=>{};if(window.createImageBitmap){image=await createImageBitmap(file);release=()=>image.close?.();}else{const url=URL.createObjectURL(file);release=()=>URL.revokeObjectURL(url);image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}const scale=Math.min(1,maxSide/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);release();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob)throw Error('画像を圧縮できませんでした');return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}

  $('backupOpen').onclick=()=>$('backupDialog').showModal();document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('exportBackup').onclick=()=>{const payload={app:'walking-rpg',version:1,exportedAt:new Date().toISOString(),data:state};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;const date=new Date();const stamp=`${String(date.getFullYear()).slice(-2)}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;a.download=`WRPG_BKUP_${stamp}.json`;a.click();URL.revokeObjectURL(url);$('backupStatus').textContent='バックアップをダウンロードしました。';};
  $('restoreFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const payload=JSON.parse(await file.text());if(payload.app!=='walking-rpg'||payload.version!==1)throw Error('対応していないバックアップです');const next=Core.validate(clone(payload.data));if(!confirm('現在の記録・ガチャ・図鑑資料をすべてバックアップの内容で上書きします。復元しますか？'))return;Core.award(next);await dbWrite(next);state=next;loadStrengthDate($('strengthDate').value);render();$('backupStatus').textContent='復元しました。';toast('バックアップを復元しました');}catch(err){$('backupStatus').textContent=`復元しませんでした：${err.message}`;toast(`復元できません：${err.message}`);}finally{e.target.value='';}};

  (async()=>{try{db=await openDB();state=Core.validate(await dbRead());rewardUpdate();await dbWrite(state);loadStrengthDate($('strengthDate').value);render();}catch(e){toast(`起動または保存に失敗しました：${e.message}`);}})();
})();
