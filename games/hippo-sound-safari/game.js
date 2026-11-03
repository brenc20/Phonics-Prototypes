const DATA_URL = '../outputs/FPR_Word_Sort_Game_Data_Expanded.csv';
const $ = (id) => document.getElementById(id);
const state = { rows: [], activities: [], current: null, chosenFruit: null, selectedHippo: null, eaten: new Set(), score: 0, busy: false, feedbackTimer: 0 };

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const split = (line) => { const cells=[]; let value='', quoted=false; for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){value+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}cells.push(value);return cells; };
  const headers=split(lines.shift()); return lines.map(line=>Object.fromEntries(split(line).map((value,i)=>[headers[i],value])));
}
function uniqueActivities(rows) {
  const map=new Map();
  for(const row of rows){if(!map.has(row.activity_id))map.set(row.activity_id,{...row,words:[]});map.get(row.activity_id).words.push(row);}
  return [...map.values()].map(a=>({...a,words:a.words.sort((x,y)=>Number(x.word_order_in_bank)-Number(y.word_order_in_bank))}));
}
function availableBooks(){return [...new Set(state.activities.map(a=>a.book))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
function lessonKey(a){return `${a.lesson}::${a.lesson_sound_concept}`;}
function fillMenu(keepLesson=false){
  const book=$('bookSelect').value;const bookActs=state.activities.filter(a=>a.book===book);
  const oldLesson=keepLesson?$('soundSelect').value:'';const lessons=[...new Map(bookActs.map(a=>[lessonKey(a),a])).values()].sort((a,b)=>Number(a.lesson)-Number(b.lesson));
  $('soundSelect').innerHTML=lessons.map(a=>`<option value="${lessonKey(a)}">Lesson ${a.lesson} · ${esc(a.lesson_sound_concept)}</option>`).join('');
  if(keepLesson&&lessons.some(a=>lessonKey(a)===oldLesson))$('soundSelect').value=oldLesson;
  fillSets();
}
function fillSets(){
  const book=$('bookSelect').value,key=$('soundSelect').value;const matches=state.activities.filter(a=>a.book===book&&lessonKey(a)===key);
  $('setSelect').innerHTML=matches.map((a,i)=>`<option value="${esc(a.activity_id)}">Word sort ${i+1} · ${a.words.length} fruits${a.activity_type==='Source'?' · book sort':' · extra practice'}</option>`).join('');
  $('startButton').disabled=!matches.length;
}
function hippoLabel(category,categories){
  if(category!=='Other beginning sound')return {text:category,not:false};
  const focus=categories.find(x=>/^Begins with /i.test(x));
  if(!focus)return {text:'NOT that sound',not:true};
  const phoneme=focus.match(/\((\/[^)]+\/)\)/)?.[1]||focus.match(/\/(.*?)\//)?.[0]||focus.match(/^Begins with ([^ ]+)/i)?.[1]||'that sound';
  return {text:`NOT ${phoneme}`,not:true};
}
function startGame(){
  const activity=state.activities.find(a=>a.activity_id===$('setSelect').value);if(!activity)return;
  state.current=activity;state.eaten=new Set();state.score=0;state.chosenFruit=null;state.selectedHippo=null;state.busy=false;
  $('menuScreen').classList.add('hidden');$('gameScreen').classList.remove('hidden');$('completeCard').classList.add('hidden');
  $('roundLabel').textContent=`${activity.book} · Lesson ${activity.lesson}`;$('totalValue').textContent=activity.words.length;$('scoreValue').textContent='0';$('soundHint').textContent=activity.lesson_sound_concept;
  renderHippos();renderFruits();
}
function renderHippos(){
  const a=state.current,categories=(a.all_sort_categories||'').split('|').map(x=>x.trim()).filter(Boolean);
  $('hippoRow').innerHTML=categories.map((cat,index)=>{const label=hippoLabel(cat,categories);return `<button class="hippo-card" data-category="${esc(cat)}" aria-label="Hippo sound box: ${esc(label.text)}"><div class="hippo-caught" id="caught-${index}"></div><div class="hippo-face"><img class="hippo-art hippo-art-closed" src="assets/hippo_closed.png" alt=""><img class="hippo-art hippo-art-open" src="assets/hippo_open.png" alt=""></div><img class="water-splash" src="assets/water_splash_burst.png" alt=""><span class="hippo-label ${label.not?'not-label':''}">${esc(label.text)}</span><span class="hippo-reaction" aria-live="polite"><span class="reaction-copy"></span></span></button>`;}).join('');
  for(const hippo of document.querySelectorAll('.hippo-card')){hippo.addEventListener('click',()=>{if(state.busy)return;if(state.chosenFruit)submitToHippo(hippo);else{document.querySelectorAll('.hippo-card').forEach(h=>h.classList.remove('selected'));hippo.classList.add('selected');state.selectedHippo=hippo.dataset.category;}});hippo.addEventListener('dragover',e=>{if(state.busy)return;e.preventDefault();hippo.classList.add('selected')});hippo.addEventListener('dragleave',()=>hippo.classList.remove('selected'));hippo.addEventListener('drop',e=>{e.preventDefault();hippo.classList.remove('selected');if(state.busy)return;const id=e.dataTransfer.getData('text/plain');const fruit=document.querySelector(`[data-word-id="${CSS.escape(id)}"]`);if(fruit)placeFruit(fruit,hippo);});}
}
function renderFruits(){
  $('fruitTray').innerHTML=state.current.words.filter(r=>!state.eaten.has(r.word_order_in_bank)).map(r=>{const sprite=(Number(r.word_order_in_bank)-1)%15;return `<div class="fruit-card" draggable="true" tabindex="0" role="button" aria-label="${esc(r.word)}, fruit word" data-word-id="${esc(r.word_order_in_bank)}" data-word="${esc(r.word)}" data-category="${esc(r.correct_sort_category)}"><span class="fruit-art" style="--x:${(sprite%5)*25}%;--y:${Math.floor(sprite/5)*50}%"></span><span class="fruit-word">${esc(r.word)}</span></div>`;}).join('');
  for(const fruit of document.querySelectorAll('.fruit-card')){
    fruit.addEventListener('click',()=>selectFruit(fruit));fruit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFruit(fruit);}});
    fruit.addEventListener('dragstart',e=>{clearReactions();e.dataTransfer.setData('text/plain',fruit.dataset.wordId);e.dataTransfer.effectAllowed='move';fruit.classList.add('dragging')});fruit.addEventListener('dragend',()=>fruit.classList.remove('dragging'));
    fruit.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')beginTouchDrag(e,fruit)});
  }
}
function selectFruit(fruit){if(state.busy)return;clearReactions();document.querySelectorAll('.fruit-card').forEach(x=>x.classList.remove('selected'));fruit.classList.add('selected');state.chosenFruit=fruit.dataset.wordId;if(state.selectedHippo){const target=[...document.querySelectorAll('.hippo-card')].find(h=>h.dataset.category===state.selectedHippo);if(target){submitToHippo(target);return;}}}
function placeFruit(fruit,hippo){state.chosenFruit=fruit.dataset.wordId;submitToHippo(hippo);}
async function submitToHippo(hippo){
  if(state.busy)return;const fruit=document.querySelector(`[data-word-id="${CSS.escape(state.chosenFruit||'')}" ]`);if(!fruit)return;state.busy=true;
  const correct=fruit.dataset.category===hippo.dataset.category;document.querySelectorAll('.hippo-card').forEach(h=>h.classList.remove('selected','correct','wrong','splash'));clearReactions();
  hippo.classList.add(correct?'correct':'wrong');
  const reaction=hippo.querySelector('.hippo-reaction');reaction.querySelector('.reaction-copy').textContent=correct?'Yes! Yum!':'Yuck! Try Again!';reaction.classList.add(correct?'positive':'negative','show');hippo.classList.add('splash');
  const heading=document.querySelector('.scene-heading');heading.classList.add('reaction-hidden');
  reaction._hideTimer=window.setTimeout(()=>{reaction.classList.remove('show','positive','negative');reaction.querySelector('.reaction-copy').textContent='';if(!document.querySelector('.hippo-reaction.show'))heading.classList.remove('reaction-hidden');},1050);
  const flight=animateFruitFlight(fruit,hippo,correct);await flight;
  if(correct){state.eaten.add(fruit.dataset.wordId);state.score++;$('scoreValue').textContent=state.score;const target=hippo.querySelector('.hippo-caught');const chip=document.createElement('span');chip.className='caught-word';chip.textContent=fruit.dataset.word;target.append(chip);fruit.classList.add('used');}
  state.chosenFruit=null;state.selectedHippo=null;
  await new Promise(resolve=>window.setTimeout(resolve,correct?720:100));
  hippo.classList.remove('correct','wrong','splash');if(correct){renderFruits();if(state.score===state.current.words.length)finishGame();}state.busy=false;
}
function animateFruitFlight(fruit,hippo,correct){
  return new Promise(resolve=>{
    const from=fruit.getBoundingClientRect(),to=hippo.querySelector('.hippo-face').getBoundingClientRect(),clone=fruit.cloneNode(true);
    clone.classList.add('fruit-flight');clone.setAttribute('aria-hidden','true');Object.assign(clone.style,{position:'fixed',left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`,margin:0,zIndex:1000,pointerEvents:'none'});
    const dx=to.left+to.width/2-from.left-from.width/2,dy=to.top+to.height*.70-from.top-from.height/2;fruit.classList.add('in-flight');document.body.append(clone);
    const finish=()=>{clone.remove();if(!correct)fruit.classList.remove('in-flight');resolve();};
    if(correct){clone.style.setProperty('--fly-x',`${dx}px`);clone.style.setProperty('--fly-y',`${dy}px`);requestAnimationFrame(()=>clone.classList.add('fly'));window.setTimeout(finish,560);}
    else {const animation=clone.animate([
      {transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1,offset:0},
      {transform:`translate(${dx}px,${dy-28}px) scale(.52) rotate(22deg)`,opacity:1,offset:.42},
      {transform:`translate(${dx*.52}px,${dy*.48-34}px) scale(.8) rotate(10deg)`,opacity:1,offset:.68},
      {transform:'translate(0,0) scale(1) rotate(-7deg)',opacity:1,offset:1}
    ],{duration:850,easing:'cubic-bezier(.22,.72,.28,1)'});animation.onfinish=finish;animation.oncancel=finish;}
  });
}
function clearReactions(){document.querySelectorAll('.hippo-reaction').forEach(r=>{window.clearTimeout(r._hideTimer);r._hideTimer=0;r.querySelector('.reaction-copy').textContent='';r.className='hippo-reaction';});document.querySelector('.scene-heading')?.classList.remove('reaction-hidden');}
function beginTouchDrag(event,fruit){
  event.preventDefault();selectFruit(fruit);const ghost=fruit.cloneNode(true);ghost.className='fruit-card';Object.assign(ghost.style,{position:'fixed',zIndex:99,pointerEvents:'none',width:'90px',opacity:.9,transform:'scale(1.05)',left:`${event.clientX-45}px`,top:`${event.clientY-38}px`});document.body.append(ghost);fruit.setPointerCapture(event.pointerId);
  const move=e=>{ghost.style.left=`${e.clientX-45}px`;ghost.style.top=`${e.clientY-38}px`;};const up=e=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);ghost.remove();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.hippo-card');if(target)placeFruit(fruit,target);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
}
function finishGame(){$('completeText').textContent=`You helped the hippos eat all ${state.score} sound fruits!`;window.setTimeout(()=>$('completeCard').classList.remove('hidden'),350);}
function backToMenu(){$('gameScreen').classList.add('hidden');$('menuScreen').classList.remove('hidden');state.current=null;}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function init(){try{let csv=window.FPR_WORD_SORT_CSV;if(!csv){const res=await fetch(DATA_URL);if(!res.ok)throw new Error(`Could not load word-sort data (${res.status})`);csv=await res.text();}state.rows=parseCSV(csv);state.activities=uniqueActivities(state.rows);const books=availableBooks();$('bookSelect').innerHTML=books.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');$('bookSelect').value=books.includes('FPR A')?'FPR A':books[0];fillMenu();$('menuStatus').textContent=`${state.activities.length} word sorts ready · ${books.join(' · ')}`;}catch(err){$('menuStatus').textContent=`Could not load the word list. ${err.message}`;console.error(err);}}
$('bookSelect').addEventListener('change',()=>fillMenu());$('soundSelect').addEventListener('change',fillSets);$('startButton').addEventListener('click',startGame);$('menuButton').addEventListener('click',backToMenu);$('againButton').addEventListener('click',startGame);
window.render_game_to_text=()=>JSON.stringify({mode:state.current?'game':'menu',book:state.current?.book||$('bookSelect').value,lesson:state.current?.lesson||null,sound:state.current?.lesson_sound_concept||null,score:state.score,remaining:state.current?state.current.words.length-state.score:null,selectedFruit:state.chosenFruit?document.querySelector(`[data-word-id="${CSS.escape(state.chosenFruit)}"]`)?.dataset.word||null:null,categories:state.current?(state.current.all_sort_categories||'').split('|').map(x=>x.trim()):[],visibleWords:[...document.querySelectorAll('.fruit-card')].map(x=>x.dataset.word)});
window.advanceTime=(ms)=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,500)));
init();
