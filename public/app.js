function insert(text){
    const input=document.getElementById("fonction");
    const start=input.selectionStart;
    const end=input.selectionEnd;
    input.value=input.value.substring(0,start)+text+input.value.substring(end);
    input.focus();
    input.selectionEnd=start+text.length;
    previewFunction();
}

function previewFunction(){
    const fInput=document.getElementById("fonction").value;
    if(fInput.trim()===""){document.getElementById("mathDisplay").innerHTML="";return;}
    let formatted=fInput
        .replace(/\^/g,'^')
        .replace(/\*/g,'\\times ')
        .replace(/\//g,'\\div ')
        .replace(/sqrt\((.*?)\)/g,'\\sqrt{$1}')
        .replace(/cbrt\((.*?)\)/g,'\\sqrt[3]{$1}')
        .replace(/\|(.+?)\|/g,'|$1|');
    document.getElementById("mathDisplay").innerHTML=`\\[ f(x) = ${formatted} \\]`;
    MathJax.typesetPromise();
}

function analyser(){
    const fInput=document.getElementById("fonction").value;
    let expr;
    try{expr=math.parse(fInput);}
    catch(e){alert("Erreur dans la fonction !"); return;}
    const deriv=math.derivative(expr,"x");

    const xMin=-10, xMax=10, step=0.01;
    let pointsCritiques=[xMin,xMax];

    for(let x=xMin;x<=xMax;x+=step){
        try{
            const y=expr.evaluate({x:x});
            const dy=deriv.evaluate({x:x});
            if(!Number.isFinite(y) && !pointsCritiques.includes(x)) pointsCritiques.push(x);
            if(Math.abs(dy)<1e-5 && !pointsCritiques.includes(x)) pointsCritiques.push(x);
        } catch{ if(!pointsCritiques.includes(x)) pointsCritiques.push(x); }
    }
    pointsCritiques.sort((a,b)=>a-b);

    // Construction des intervalles pour tableau
    let intervals=[];
    for(let i=0;i<pointsCritiques.length-3;i++){
        intervals.push([pointsCritiques[i],pointsCritiques[i+1]]);
    }

    // Tableau HTML
    let tableHTML=`<table class="variation-table"><tr><th>Intervalle</th>`;
    intervals.forEach(([a,b])=>{
        tableHTML+=`<td>[${a.toFixed(2)}, ${b.toFixed(2)}]</td>`;
    });
    tableHTML+=`</tr><tr><th>f'(x)</th>`;
    intervals.forEach(([a,b])=>{
        const mid=(a+b)/2;
        let sign;
        try{
            const d=deriv.evaluate({x:mid});
            if(d>0) sign='+';
            else if(d<0) sign='-';
            else sign='0';
        } catch{ sign='?'; }
        tableHTML+=`<td>${sign}</td>`;
    });
    tableHTML+=`</tr><tr><th>f(x)</th>`;
    intervals.forEach(([a,b])=>{
        let fStart,fEnd;
        try{
            fStart=expr.evaluate({x:a});
            fStart=!Number.isFinite(fStart)?(fStart>0?'+\\infty':'-\\infty'):fStart.toFixed(2);
        } catch{ fStart='?'; }
        try{
            fEnd=expr.evaluate({x:b});
            fEnd=!Number.isFinite(fEnd)?(fEnd>0?'+\\infty':'-\\infty'):fEnd.toFixed(2);
        } catch{ fEnd='?'; }
        tableHTML+=`<td>${fStart} → ${fEnd}</td>`;
    });
    tableHTML+=`</tr></table>`;

    document.getElementById("variation").innerHTML=tableHTML;
    previewFunction();
    tracerGraph(expr,pointsCritiques);
}

function tracerGraph(expr,pointsCritiques){
    const canvas=document.getElementById("graph");
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const width=canvas.width,height=canvas.height,scale=40;

    drawAxes(ctx,width,height,scale);

    // Asymptotes verticales
    ctx.strokeStyle='yellow'; ctx.setLineDash([5,5]);
    pointsCritiques.forEach(x=>{
        try{expr.evaluate({x:x});}catch{
            let px=width/2+x*scale;
            ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,height); ctx.stroke();
        }
    });
    ctx.setLineDash([]);

    // Tracer fonction
    ctx.strokeStyle='#ff5733'; ctx.lineWidth=2; ctx.beginPath();
    let first=true;
    for(let px=0; px<=width; px++){
        const x=(px-width/2)/scale;
        try{
            const y=expr.evaluate({x:x});
            const py=height/2-y*scale;
            if(first){ctx.moveTo(px,py);first=false;} else ctx.lineTo(px,py);
        } catch{first=true;}
    }
    ctx.stroke();
}

function drawAxes(ctx,width,height,scale){
    ctx.strokeStyle='white'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,height/2); ctx.lineTo(width,height/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width/2,0); ctx.lineTo(width/2,height); ctx.stroke();
    ctx.fillStyle='white'; ctx.font='12px Arial';
    for(let i=-Math.floor(width/(2*scale));i<=Math.floor(width/(2*scale));i++){
        let xPos=width/2+i*scale;
        ctx.fillText(i,xPos-3,height/2+15);
        ctx.beginPath(); ctx.moveTo(xPos,height/2-5); ctx.lineTo(xPos,height/2+5); ctx.stroke();
    }
    for(let i=-Math.floor(height/(2*scale));i<=Math.floor(height/(2*scale));i++){
        if(i===0) continue;
        let yPos=height/2-i*scale;
        ctx.fillText(i,width/2+5,yPos+3);
        ctx.beginPath(); ctx.moveTo(width/2-5,yPos); ctx.lineTo(width/2+5,yPos); ctx.stroke();
    }
}