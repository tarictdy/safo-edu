const inputEl=document.getElementById("fonction");
const previewEl=document.getElementById("preview");
const variationEl=document.getElementById("variation");
const canvas=document.getElementById("graph");
const ctx=canvas.getContext("2d");

// ======= SAISIE =======
function insert(text){
  const start=inputEl.selectionStart;
  const end=inputEl.selectionEnd;
  inputEl.value=inputEl.value.slice(0,start)+text+inputEl.value.slice(end);
  inputEl.focus();
  let pos=text.indexOf('()')!==-1?start+text.indexOf('()')+1:start+text.length;
  inputEl.selectionStart=inputEl.selectionEnd=pos;
  previewFunction();
}

document.getElementById("btnPreview").addEventListener("click", previewFunction);
document.getElementById("btnReset").addEventListener("click",()=>{
  inputEl.value=''; previewEl.innerHTML=''; variationEl.innerHTML=''; clearCanvas();
});
document.getElementById("btnAnalyse").addEventListener("click", analyser);
function setExample(txt){inputEl.value=txt; previewFunction();}

// ======= PREVIEW MATHJAX =======
function sanitizeForMathJax(s){
  if(!s) return '';
  return s.replace(/\|(.+?)\|/g,'\\lvert $1 \\rvert')
          .replace(/sqrt\((.*?)\)/g,'\\sqrt{$1}')
          .replace(/cbrt\((.*?)\)/g,'\\sqrt[3]{$1}');
}

function previewFunction(){
  const fInput=inputEl.value.trim();
  if(!fInput){previewEl.innerHTML=''; return;}
  previewEl.innerHTML=`\\[ f(x) = ${sanitizeForMathJax(fInput)} \\]`;
  if(window.MathJax && MathJax.typesetPromise){MathJax.typesetPromise([previewEl]).catch(()=>{});}
}

// ======= ANALYSE =======
function analyser(){
  const fInput=inputEl.value.trim();
  if(!fInput){alert('Écris une fonction !'); return;}
  let fNode;
  try{ fNode=math.parse(fInput); }catch{alert('Syntaxe invalide'); return;}
  const fCompiled=fNode.compile();
  const derivNode=math.derivative(fNode,'x');
  const derivCompiled=derivNode.compile();

  const points=getCriticalPoints(fNode);

  // tableau de variation
  let html='<h3>Tableau de variation</h3><table class="variation-table">';
  html+='<tr><th>Intervalle</th>';
  for(let i=0;i<points.length-1;i++){html+=`<td>[${formatNumber(points[i])},${formatNumber(points[i+1])}]</td>`;}
  html+='</tr><tr><th>f\'(x)</th>';
  for(let i=0;i<points.length-1;i++){
    const mid=(points[i]+points[i+1])/2;
    let val='?';
    try{const d=derivCompiled.evaluate({x:mid}); val=d>1e-6?'+':d<-1e-6?'-':'0';}catch{val='?';}
    html+=`<td>${val}</td>`;
  }
  html+='</tr><tr><th>f(x)</th>';
  for(let i=0;i<points.length-1;i++){
    const l=approxLimit(fCompiled,points[i],+1);
    const r=approxLimit(fCompiled,points[i+1],-1);
    html+=`<td>${l} → ${r}</td>`;
  }
  html+='</tr></table>';
  variationEl.innerHTML=html+detectAsymptotes(fCompiled);

  previewFunction();
  drawGraph(fCompiled,points);
}

// ======= UTILITAIRES =======
function formatNumber(x){
  if(Number.isInteger(x)) return x;
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const denom=1000;
  let num=Math.round(x*denom);
  let d=gcd(Math.abs(num),denom);
  return `${num/d}/${denom/d}`;
}

function getCriticalPoints(fNode){
  const derivNode=math.derivative(fNode,'x');
  const derivCompiled=derivNode.compile();
  const pts=new Set([-10,10]);
  for(let x=-10;x<=10;x+=0.05){
    try{
      const y=fNode.compile().evaluate({x});
      const dy=derivCompiled.evaluate({x});
      if(!isFinite(y)) pts.add(parseFloat(x.toFixed(2)));
      if(Math.abs(dy)<1e-6) pts.add(parseFloat(x.toFixed(2)));
    }catch{pts.add(parseFloat(x.toFixed(2)));}
  }
  return Array.from(pts).sort((a,b)=>a-b);
}

function approxLimit(fCompiled,x,d=1){
  const eps=1e-6*d;
  try{
    const v=fCompiled.evaluate({x:x+eps});
    if(!isFinite(v)) return v>0?'+∞':'-∞';
    return formatNumber(v);
  }catch{return '?';}
}

// ======= ASYMPTOTES =======
function detectAsymptotes(fCompiled){
  let html='<h3>Asymptotes</h3><ul>';
  let verticals=[];
  for(let x=-10;x<=10;x+=0.1){try{if(!isFinite(fCompiled.evaluate({x}))) verticals.push(Math.round(x*100)/100);}catch{verticals.push(Math.round(x*100)/100);}}
  verticals=[...new Set(verticals)];
  html+=verticals.length?`<li>Verticales : x ≈ ${verticals.join(', ')}</li>`:`<li>Verticales : aucune sur [-10,10]</li>`;
  const limPos=limInfinity(fCompiled,1);
  const limNeg=limInfinity(fCompiled,-1);
  if(limPos.finite) html+=`<li>Horizontal x→+∞ : y=${limPos.value}</li>`;
  if(limNeg.finite) html+=`<li>Horizontal x→-∞ : y=${limNeg.value}</li>`;
  try{const x1=1000,x2=1001,y1=fCompiled.evaluate({x:x1}),y2=fCompiled.evaluate({x:x2});
    const a=(y2-y1)/(x2-x1);const b=y1-a*x1;if(Math.abs(a)>1e-6 && Math.abs(a)<1e6) html+=`<li>Oblique : y=${formatNumber(a)}x + ${formatNumber(b)}</li>`;}catch{}
  html+='</ul>';
  return html;
}

function limInfinity(fCompiled,s=1){
  const xs=[100,1000,10000];
  const vals=[];
  try{for(const x of xs){const v=fCompiled.evaluate({x:x*s}); if(!isFinite(v)) return {finite:false}; vals.push(v);} return {finite:true,value:formatNumber(vals[vals.length-1])};}catch{return {finite:false};}
}

// ======= GRAPHE =======
function clearCanvas(){ctx.clearRect(0,0,canvas.width,canvas.height);}
function drawGraph(fCompiled,points){
  const DPR=window.devicePixelRatio||1;
  const W=canvas.clientWidth;
  const H=canvas.clientHeight;
  canvas.width=W*DPR; canvas.height=H*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);

  const x0=W/2, y0=H/2, scale=40;

  // axes
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(0,y0); ctx.lineTo(W,y0);
  ctx.moveTo(x0,0); ctx.lineTo(x0,H);
  ctx.stroke();

  // graduation X
  ctx.fillStyle='white'; ctx.font='12px Arial';
  for(let i=-Math.floor(x0/scale); i<=Math.floor((W-x0)/scale); i++){
    const px=x0+i*scale;
    ctx.beginPath(); ctx.moveTo(px,y0-5); ctx.lineTo(px,y0+5); ctx.stroke();
    ctx.fillText(i,px-5,y0+15);
  }
  // graduation Y
  for(let i=-Math.floor(y0/scale); i<=Math.floor((H-y0)/scale); i++){
    const py=y0-i*scale;
    ctx.beginPath(); ctx.moveTo(x0-5,py); ctx.lineTo(x0+5,py); ctx.stroke();
    if(i!==0) ctx.fillText(i,x0+8,py+4);
  }

  // tracé fonction
  ctx.strokeStyle='#ff6f3c'; ctx.lineWidth=2;
  ctx.beginPath(); let gap=true;
  for(let px=0;px<=W;px++){
    const x=(px-x0)/scale;
    try{const y=fCompiled.evaluate({x}); if(!isFinite(y)||Math.abs(y)>1e6){gap=true; continue;}
      const py=y0-y*scale; if(gap){ctx.moveTo(px,py); gap=false;}else ctx.lineTo(px,py);}catch{gap=true;}
  }
  ctx.stroke();

  // asymptotes verticales
  ctx.strokeStyle='rgba(255,215,120,0.7)'; ctx.setLineDash([6,6]);
  for(const vx of points){const px=x0+vx*scale;if(px<0||px>W) continue; ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,H); ctx.stroke();}
  ctx.setLineDash([]);
}