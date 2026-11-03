/* Walking RPG: local-first static PWA. */
const APP_VERSION='v1.2.5';
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
  const newState = () => ({ version:1, daily:[], walks:[], earnedSteps:0, earnedDistance:0, spent:0, items:Object.fromEntries(catalog.map(i=>[i.id,{count:0,main:null,info:null,text:''}])) });
  const totalSteps = s => s.daily.reduce((a,r)=>a+(Number(r.steps)||0),0);
  const totalDistance = s => s.walks.reduce((a,r)=>a+(Number(r.distance)||0),0);
  function award(s) {
    s.earnedSteps = Math.max(s.earnedSteps, Math.floor(totalSteps(s)/1000));
    s.earnedDistance = Math.max(s.earnedDistance, Math.floor(totalDistance(s)));
  }
  const available = s => Math.max(0,s.earnedSteps+s.earnedDistance-s.spent);
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
    const validDate=value=>{
      if(typeof value!=='string')return false;
      const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return false;
      const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
      if(month<1||month>12)return false;
      const leap=year%4===0&&(year%100!==0||year%400===0);
      const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
      return day>=1&&day<=days[month-1];
    };
    const dailyDates=new Set();for (const row of s.daily){
      if(!validDate(row.date))throw Error(`日次記録の日付形式が不正です（${String(row.date)}）。`);
      if(!Number.isInteger(row.steps)||row.steps<0)throw Error(`日次記録の歩数が不正です（${row.date}）。`);
      if(dailyDates.has(row.date))throw Error(`日次記録が同じ日付で重複しています（${row.date}）。データは変更していません。`);
      dailyDates.add(row.date);
    }
    const walkIds=new Set();for (const row of s.walks){if(typeof row.id!=='string'||!row.id||!validDate(row.date)||!Number.isFinite(row.distance)||row.distance<0||walkIds.has(row.id))throw Error('散歩記録に不正または重複したID・日付・距離があります。');walkIds.add(row.id);}
    for (const key of ['earnedSteps','earnedDistance','spent']) if (!Number.isInteger(s[key]) || s[key]<0) throw Error('ガチャ状態の値が不正です。');
    if(s.spent>s.earnedSteps+s.earnedDistance||s.earnedSteps<Math.floor(totalSteps(s)/1000)||s.earnedDistance<Math.floor(totalDistance(s)))throw Error('ガチャ回数の状態が記録と整合しません。');
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
  return {catalog,byId,newState,totalSteps,totalDistance,award,available,pick,validate,parseDaily,parseWalks};
})();

(() => {
  const $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
  $('appVersion').textContent=APP_VERSION;
  let state, db, worker, mode='daily', sourceImage=null, sourceUrl='', category='all', ownership='owned', activeItem=null, editing=false, editDraft=null, toastTimer;
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
    $('drawOne').disabled=Core.available(state)<1||!state.items||!Core.catalog.some(i=>state.items[i.id].count<3);
    $('drawTen').disabled=Core.available(state)<10||!Core.catalog.some(i=>state.items[i.id].count<3);
    $('gachaHint').textContent=Core.catalog.every(i=>state.items[i.id].count>=3)?'すべてのアイテムが3回獲得済みです。ガチャ回数は保持されます。':'';
    renderSaved();renderCollection();
  }
  function renderSaved(){
    const root=$('savedRecords');root.replaceChildren();
    const year=shownMonth.getFullYear(),month=shownMonth.getMonth()+1;
    $('savedMonthLabel').textContent=`${year}年${month}月`;
    const now=new Date(),isCurrent=year===now.getFullYear()&&month===now.getMonth()+1;
    const isFuture=year>now.getFullYear()||(year===now.getFullYear()&&month>now.getMonth()+1);
    $('savedNextMonth').disabled=isCurrent||isFuture;
    const monthKey=`${year}-${String(month).padStart(2,'0')}`;
    const daily=state.daily.filter(row=>row.date.startsWith(monthKey)).sort((a,b)=>b.date.localeCompare(a.date));
    const walks=state.walks.map((row,index)=>({row,index})).filter(x=>x.row.date.startsWith(monthKey)).sort((a,b)=>b.row.date.localeCompare(a.row.date)||a.index-b.index);
    if(!daily.length&&!walks.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='この月の記録はありません';root.append(empty);return;}

    if(daily.length){const dailyTitle=document.createElement('h3');dailyTitle.className='saved-subheading';dailyTitle.textContent='日次歩数';root.append(dailyTitle);daily.forEach(row=>root.append(renderDailyRow(row)));}
    if(walks.length){const walksTitle=document.createElement('h3');walksTitle.className='saved-subheading';walksTitle.textContent='散歩記録';root.append(walksTitle);let lastDate='';walks.forEach(({row})=>{if(row.date!==lastDate){lastDate=row.date;const heading=document.createElement('h4');heading.className='walk-date-heading';heading.textContent=formatSavedDate(row.date);root.append(heading);}root.append(renderWalkRow(row));});}
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
  function renderDailyRow(row){
    const wrap=document.createElement('div');wrap.className='saved-entry';
    if(editingSaved?.row===row&&editingSaved.type==='daily'){wrap.append(savedEditForm(row,'daily'));return wrap;}
    const line=document.createElement('div');line.className='saved-compact-row';const summary=document.createElement('span');summary.textContent=`${formatSavedDate(row.date)}　${row.steps.toLocaleString()}歩`;const edit=document.createElement('button');edit.type='button';edit.className='secondary small-button saved-edit-icon';edit.textContent='✎';edit.setAttribute('aria-label',`日次記録 ${formatSavedDate(row.date)} ${row.steps.toLocaleString()}歩を編集`);edit.title='編集';edit.onclick=()=>{editingSaved={type:'daily',row};renderSaved();};line.append(summary,edit);wrap.append(line);return wrap;
  }
  function renderWalkRow(row){
    const wrap=document.createElement('div');wrap.className='saved-entry walk-entry';
    if(editingSaved?.row===row&&editingSaved.type==='walk'){wrap.append(savedEditForm(row,'walk'));return wrap;}
    const line=document.createElement('div');line.className='saved-compact-row';const summary=document.createElement('span');summary.textContent=`${Number(row.distance).toFixed(2)}km`;const edit=document.createElement('button');edit.type='button';edit.className='secondary small-button saved-edit-icon';edit.textContent='✎';edit.setAttribute('aria-label',`散歩記録 ${formatSavedDate(row.date)} ${Number(row.distance).toFixed(2)}kmを編集`);edit.title='編集';edit.onclick=()=>{editingSaved={type:'walk',row};renderSaved();};line.append(summary,edit);wrap.append(line);return wrap;
  }
  function moveSavedMonth(amount){editingSaved=null;shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+amount,1);renderSaved();}
  $('savedPrevMonth').onclick=()=>moveSavedMonth(-1);$('savedNextMonth').onclick=()=>{const now=new Date();if(shownMonth.getFullYear()<now.getFullYear()||(shownMonth.getFullYear()===now.getFullYear()&&shownMonth.getMonth()<now.getMonth()))moveSavedMonth(1);};
  $('savedThisMonth').onclick=()=>{editingSaved=null;const now=new Date();shownMonth=new Date(now.getFullYear(),now.getMonth(),1);renderSaved();};
  window.addEventListener('pageshow',()=>{editingSaved=null;const now=new Date();shownMonth=new Date(now.getFullYear(),now.getMonth(),1);if(state)renderSaved();});

  function setMode(next){mode=next;$('dailyMode').classList.toggle('selected',mode==='daily');$('walkMode').classList.toggle('selected',mode==='walk');$('ocrResults').classList.add('hidden');}
  $('dailyMode').onclick=()=>setMode('daily');$('walkMode').onclick=()=>setMode('walk');
  function loadImage(file){if(!file||!file.type.startsWith('image/')){toast('画像を取得できませんでした');return;}sourceImage=file;if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=URL.createObjectURL(file);$('screenshotPreview').src=sourceUrl;$('screenshotPreview').classList.remove('hidden');$('runOcr').disabled=false;$('ocrStatus').textContent=`画像を読み込みました（${Math.round(file.size/1024)}KB）`;}
  $('screenshot').onchange=e=>loadImage(e.target.files?.[0]);
  $('pasteTarget').addEventListener('paste',e=>{const f=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'))?.getAsFile();e.preventDefault();if(f)loadImage(f);else toast('クリップボードに画像がありません');});
  $('pasteImage').onclick=async()=>{try{if(!navigator.clipboard?.read)throw Error('画像貼り付けボタンはHTTPSで利用できます。貼り付け領域を長押しして「ペースト」するか、ファイルを選んでください。');for(const item of await navigator.clipboard.read()){const type=item.types.find(t=>t.startsWith('image/'));if(type){loadImage(await item.getType(type));return;}}throw Error('クリップボードに画像がありません');}catch(e){toast(e.message);}};
  $('dailyToday').onclick=()=>{$('dailyDate').value=todayISO();};
  $('runOcr').onclick=async()=>{if(!sourceImage)return;const start=performance.now();$('runOcr').disabled=true;$('ocrProgress').classList.remove('hidden');$('ocrProgress').value=0;$('ocrError').classList.add('hidden');$('ocrStatus').textContent='OCRを準備しています…';$('ocrTime').textContent='処理中…';
    try{if(!window.Tesseract)throw Error('Tesseract.jsを読み込めません。インターネット接続を確認してください。');if(!worker){worker=await Tesseract.createWorker('jpn+eng',1,{logger:m=>{if(m.status)$('ocrStatus').textContent=m.status;if(typeof m.progress==='number')$('ocrProgress').value=m.progress;}});await worker.setParameters({preserve_interword_spaces:'1'});}const result=await worker.recognize(sourceImage),text=result.data.text||'';$('ocrText').textContent=text||'（文字を取得できませんでした）';$('ocrResults').classList.remove('hidden');if(mode==='daily'){const parsed=Core.parseDaily(text);$('dailyDate').value=parsed.date;$('dailySteps').value=parsed.steps;$('dailyResult').classList.remove('hidden');$('walkResult').classList.add('hidden');}else{renderCandidates(Core.parseWalks(text));$('dailyResult').classList.add('hidden');$('walkResult').classList.remove('hidden');}$('ocrStatus').textContent='読み取り完了。登録前に確認してください。';}
    catch(e){$('ocrError').textContent=e.stack||String(e);$('ocrError').classList.remove('hidden');$('ocrStatus').textContent='OCRに失敗しました';}finally{$('ocrTime').textContent=`処理時間：${((performance.now()-start)/1000).toFixed(2)}秒`;$('ocrProgress').classList.add('hidden');$('runOcr').disabled=false;}};
  function isDuplicate(date,distance){return state.walks.some(w=>w.date===date&&Number(w.distance)===Number(distance));}
  let candidates=[];
  function renderCandidates(rows){candidates=rows.map(r=>{const duplicate=!!r.date&&isDuplicate(r.date,r.distance);return {...r,duplicate,selected:!duplicate,touched:false};});const root=$('walkCandidates');root.replaceChildren();
    if(!candidates.length){const p=document.createElement('p');p.className='empty';p.textContent='散歩候補を読み取れませんでした。別の画像を選ぶか、生テキストを確認してください。';root.append(p);}
    candidates.forEach((r,index)=>{const block=document.createElement('div');block.className='candidate';const head=document.createElement('div');head.className='candidate-header';const check=document.createElement('input');check.type='checkbox';check.checked=r.selected;check.onchange=()=>{r.selected=check.checked;r.touched=true;updateCandidateTotal();};const name=document.createElement('strong');name.textContent=`記録 ${index+1}`;head.append(check,name);block.append(head);const fields=document.createElement('div');fields.className='candidate-fields';const date=document.createElement('input');date.type='date';date.value=r.date;date.setAttribute('aria-label','散歩日付');const distance=document.createElement('input');distance.type='number';distance.min='0';distance.step='.01';distance.value=r.distance;distance.setAttribute('aria-label','距離 km');fields.append(date,distance);block.append(fields);const duplicate=document.createElement('p');duplicate.className='duplicate';block.append(duplicate);
      const refresh=()=>{r.date=date.value;r.distance=Number(distance.value);r.duplicate=!!r.date&&isDuplicate(r.date,r.distance);duplicate.textContent=r.duplicate?'登録済み候補（日付＋距離が一致）':'';if(!r.touched){r.selected=!r.duplicate;check.checked=r.selected;}updateCandidateTotal();};date.oninput=refresh;distance.oninput=refresh;refresh();root.append(block);});updateCandidateTotal();}
  function updateCandidateTotal(){$('selectedDistance').textContent=candidates.filter(c=>c.selected).reduce((a,c)=>a+(Number(c.distance)||0),0).toFixed(2);}
  $('saveDaily').onclick=async()=>{const date=$('dailyDate').value,steps=Number($('dailySteps').value);if(!date||$('dailySteps').value===''||!Number.isInteger(steps)||steps<0){toast('日付と歩数を確認してください');return;}const matches=state.daily.reduce((n,r)=>n+(r.date===date?1:0),0);if(matches>1){toast('同じ日付の日次記録が重複しているため保存を中止しました。データを変更していません');return;}const old=state.daily.findIndex(r=>r.date===date);if(old>=0)state.daily[old]={date,steps};else state.daily.push({date,steps});rewardUpdate();await persist();$('ocrResults').classList.add('hidden');toast('日次記録を保存しました');};
  $('saveWalks').onclick=async()=>{const selected=candidates.filter(c=>c.selected);if(!selected.length){toast('追加する散歩を選択してください');return;}if(selected.some(r=>!r.date||!Number.isFinite(Number(r.distance))||Number(r.distance)<=0)){toast('選択した記録の日付・距離を確認してください');return;}for(const r of selected)state.walks.push({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,date:r.date,distance:Number(r.distance)});rewardUpdate();await persist();$('ocrResults').classList.add('hidden');toast(`${selected.length}件の散歩を追加しました`);};

  $('drawOne').onclick=()=>draw(1);$('drawTen').onclick=()=>draw(10);
  async function draw(amount){const actual=Math.min(amount,Core.available(state));if(!actual)return;const result=[];for(let i=0;i<actual;i++){const item=Core.pick(state,amount===10&&i===9);if(!item)break;const record=state.items[item.id],isNew=record.count===0;record.count++;result.push({item,isNew});}if(!result.length){toast('抽選対象がありません');return;}state.spent+=result.length;await persist();renderDraw(result);setScreen('gacha');}
  function renderDraw(results){const root=$('drawResults');root.replaceChildren();results.forEach(({item,isNew})=>{const card=document.createElement('article');card.className='draw-card';if(item.rarity>=4)card.classList.add(`rarity-card-${item.rarity}`);const data=state.items[item.id];if(data.main){const img=document.createElement('img');img.src=data.main;img.alt=item.name;card.append(img);}else{const ph=document.createElement('div');ph.className='placeholder';ph.textContent=item.category==='spell'?'✦':'◇';card.append(ph);}const title=document.createElement('strong');title.textContent=item.name;card.append(title);const meta=document.createElement('small');meta.className='rarity-meta';meta.append(rarityStars(item.rarity),acquisitionCount(`${data.count}/3`));card.append(meta);if(isNew){const badge=document.createElement('span');badge.className='new-badge';badge.textContent='NEW';card.append(badge);}root.append(card);});}

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
      if(data.count&&data.main){const img=document.createElement('img');img.src=data.main;img.alt='';tile.append(img);}
      else{const ph=document.createElement('div');ph.className='tile-empty';if(data.count)ph.textContent='◇';else ph.append(lockIcon());tile.append(ph);}
      const name=document.createElement('strong');name.textContent=data.count?item.name:'？？？';tile.append(name);
      const meta=document.createElement('small');if(data.count){meta.className='rarity-meta';meta.append(rarityStars(item.rarity),acquisitionCount(`${data.count}/3`));}else meta.textContent='未獲得';tile.append(meta);
      tile.onclick=()=>{if(!data.count){toast('ガチャで獲得すると詳細を開けます');return;}openItem(item);};root.append(tile);
    });
  }
  document.querySelectorAll('[data-ownership]').forEach(b=>b.onclick=()=>{ownership=b.dataset.ownership;document.querySelectorAll('[data-ownership]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderCollection();});
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('selected',x===b));renderCollection();});

  function hasMaterial(data){return !!(data.main||data.info||data.text.trim());}
  function openItem(item){activeItem=item;editDraft=clone(state.items[item.id]);editing=!hasMaterial(editDraft);renderItem();$('itemDialog').showModal();}
  $('closeDetail').onclick=()=>$('itemDialog').close();
  function renderItem(){const item=activeItem,data=editing?editDraft:state.items[item.id];$('detailName').textContent=item.name;$('detailMeta').replaceChildren(rarityStars(item.rarity),document.createTextNode(`　獲得 ${state.items[item.id].count}/3回`));
    const root=$('detailBody');root.replaceChildren();
    if(!editing){const edit=document.createElement('button');edit.textContent='編集';edit.onclick=()=>{editDraft=clone(state.items[item.id]);editing=true;renderItem();};root.append(edit);if(item.category!=='spell'&&data.main){const im=document.createElement('img');im.className='detail-image';im.src=data.main;im.alt='メイン画像';root.append(im);}if(data.info){const im=document.createElement('img');im.className='detail-image';im.src=data.info;im.alt='情報画像';root.append(im);}if(data.text.trim()){const p=document.createElement('p');p.className='detail-text';p.textContent=data.text;root.append(p);}return;}
    if(item.category!=='spell')renderImageSlot(root,'main','メイン画像',512);
    renderImageSlot(root,'info','情報画像',1600);
    const textSlot=document.createElement('section');textSlot.className='edit-slot';const label=document.createElement('label');label.textContent='情報テキスト';const textarea=document.createElement('textarea');textarea.className='edit-text';textarea.value=editDraft.text;textarea.placeholder='紹介文や自分用のメモ';textarea.oninput=()=>editDraft.text=textarea.value;textSlot.append(label,textarea);root.append(textSlot);
    const links=document.createElement('div');links.className='search-links';if(item.category!=='spell')links.append(searchLink('Google画像検索',`${item.name} ドラクエ1 イラスト`,true));links.append(searchLink('Google情報検索',`${item.name} ドラクエ1 紹介`,false));root.append(links);
    const actions=document.createElement('div');actions.className='actions';const save=document.createElement('button');save.textContent='保存';save.onclick=async()=>{state.items[item.id]=editDraft;await persist();editing=false;renderItem();toast('図鑑資料を保存しました');};const cancel=document.createElement('button');cancel.className='secondary';cancel.textContent='キャンセル';cancel.onclick=()=>{editDraft=clone(state.items[item.id]);editing=hasMaterial(editDraft)?false:true;renderItem();};actions.append(save,cancel);root.append(actions);
  }
  function searchLink(label,query,images){const a=document.createElement('a');a.textContent=label;a.target='_blank';a.rel='noopener';a.href=`https://www.google.com/search?q=${encodeURIComponent(query)}${images?'&tbm=isch':''}`;return a;}
  function renderImageSlot(root,key,label,maxSide){const section=document.createElement('section');section.className='edit-slot';const title=document.createElement('strong');title.textContent=label;section.append(title);if(editDraft[key]){const img=document.createElement('img');img.src=editDraft[key];img.alt=label;section.append(img);}const row=document.createElement('div');row.className='slot-actions';const choose=document.createElement('label');choose.className='button secondary';choose.textContent='画像を選択';const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.onchange=async()=>{if(input.files[0]){editDraft[key]=await compressImage(input.files[0],maxSide);renderItem();}};choose.append(input);row.append(choose);if(editDraft[key]){const remove=document.createElement('button');remove.className='secondary';remove.textContent='削除';remove.onclick=()=>{editDraft[key]=null;renderItem();};row.append(remove);}section.append(row);const paste=document.createElement('div');paste.className='paste-target';paste.contentEditable='true';paste.textContent='ここをタップして長押し →「ペースト」';paste.addEventListener('paste',async e=>{const file=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'))?.getAsFile();e.preventDefault();if(file){editDraft[key]=await compressImage(file,maxSide);renderItem();}else toast('画像が含まれていません');});section.append(paste);root.append(section);}
  async function compressImage(file,maxSide){let image,release=()=>{};if(window.createImageBitmap){image=await createImageBitmap(file);release=()=>image.close?.();}else{const url=URL.createObjectURL(file);release=()=>URL.revokeObjectURL(url);image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}const scale=Math.min(1,maxSide/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);release();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob)throw Error('画像を圧縮できませんでした');return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}

  $('backupOpen').onclick=()=>$('backupDialog').showModal();document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('exportBackup').onclick=()=>{const payload={app:'walking-rpg',version:1,exportedAt:new Date().toISOString(),data:state};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;const date=new Date();const stamp=`${String(date.getFullYear()).slice(-2)}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;a.download=`WRPG_BKUP_${stamp}.json`;a.click();URL.revokeObjectURL(url);$('backupStatus').textContent='バックアップをダウンロードしました。';};
  $('restoreFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const payload=JSON.parse(await file.text());if(payload.app!=='walking-rpg'||payload.version!==1)throw Error('対応していないバックアップです');const next=Core.validate(clone(payload.data));if(!confirm('現在の記録・ガチャ・図鑑資料をすべてバックアップの内容で上書きします。復元しますか？'))return;await dbWrite(next);state=next;render();$('backupStatus').textContent='復元しました。';toast('バックアップを復元しました');}catch(err){$('backupStatus').textContent=`復元しませんでした：${err.message}`;toast(`復元できません：${err.message}`);}finally{e.target.value='';}};

  (async()=>{try{db=await openDB();state=Core.validate(await dbRead());rewardUpdate();await dbWrite(state);render();}catch(e){toast(`起動または保存に失敗しました：${e.message}`);}})();
})();
