import{p as x}from"./chunk-XJHXZWCV.js";import"./chunk-X2Y5TGFK.js";import"./chunk-R6CCDRJP.js";import{F as B,G as T,I as ee,J as te,a as H,b as E,c as I,d as j,f as X,u as A,v as Z,x as F}from"./chunk-VNPMBALE.js";import{j as G,l as se,m as c,o as R,u as oe}from"./chunk-HAYBHQ35.js";import{A as W,B as Y,g as O,j as q,s as J,t as K,u as z,v as V,w as Q}from"./chunk-35RC7DVO.js";var de=new Map,U={"demo-hue":()=>25,"demo-lc":()=>60,"demo-tier":e=>e.settings.tiers.at(-1)??60,"demo-a":e=>M(e)[0]?.key??"","demo-b":e=>M(e)[1]?.key??"","demo-dtier":e=>T(e.settings,e.mode),"demo-amount":e=>Math.max(-12,Math.min(12,e.settings.colorfulnessPerHue[e.mode][0]?.amount??6)),"demo-center":e=>e.settings.colorfulnessPerHue[e.mode][0]?.center??20,"demo-width":e=>Math.max(20,Math.min(180,e.settings.colorfulnessPerHue[e.mode][0]?.width??60)),"demo-color":e=>e.palette?.[e.mode].colors[0]?.key??""};function S(e,t){return de.get(t)??String(U[t]?.(e)??"")}function he(e,t){let s=Number(S(e,t));return e.settings.tiers.includes(s)?s:Number(U[t](e))}function D(e,t,s,[n,l,i],a){return`<label for="${t}">${s} <input id="${t}" type="range" min="${String(n)}" max="${String(l)}" step="${String(i)}" value="${S(e,t)}" data-demo="${a}"></label>`}function P(e,t,s,n,l){let i=S(e,t),a=n.some(([d])=>d===i)?i:String(U[t]?.(e)??"");return`<label for="${t}">${s} <select id="${t}" data-demo="${l}">${n.map(([d,h])=>`<option value="${d}" ${d===a?"selected":""}>${h}</option>`).join("")}</select></label>`}var ne=e=>e.settings.tiers.map(t=>[String(t),`Lc ${String(t)}`]),ae=new Map;function L(e,t){let s=JSON.stringify([e.bases,e.rooms,t]),n=ae.get(s);return n||ae.set(s,n=q(e,t)),n}function M(e){let t=T(e.settings,e.mode);return(e.palette?.[e.mode].colors??[]).filter(s=>s.kind==="hue").map(s=>({key:s.key,hue:s.tiers[t].default.hue,color:s.tiers[t].default.color}))}function fe(e){let t=M(e)[0];if(!t)return"Solving\u2026";let s=e.settings.rooms[e.mode].surround,n=o=>{let g={lux:o,surround:s};return L({bases:e.settings.bases,rooms:{light:g,dark:g}},e.gamut).cam(e.mode,t.color).m},[l,i,a,d]=[44,540,12,180],[h,b]=[0,4],y=o=>l+(Math.log10(o)-h)/(b-h)*i,r=Array.from({length:41},(o,g)=>10**(h+g/40*(b-h))),f=r.map(n),[p,u]=[Math.floor(Math.min(...f)/10)*10,Math.ceil(Math.max(...f)/10)*10],$=o=>a+d-(o-p)/(u-p)*d,k=r.map((o,g)=>`${g?"L":"M"}${y(o).toFixed(1)} ${$(f[g]).toFixed(1)}`).join(" "),C=Array.from({length:(u-p)/10+1},(o,g)=>p+g*10).map(o=>`<line x1="${String(l)}" x2="${String(l+i)}" y1="${$(o).toFixed(1)}" y2="${$(o).toFixed(1)}" class="grid"></line>
      <text x="${String(l-8)}" y="${($(o)+4).toFixed(1)}" class="axis" text-anchor="end">${String(o)}</text>`),w=[[1,"Dark room"],[10,"10 lux"],[100,"100"],[1e3,"Office 1 000"],[1e4,"Daylight"]],m=["dark","light"].map(o=>{let g=e.settings.rooms[o].lux,N=n(g);return`<line x1="${y(g).toFixed(1)}" x2="${y(g).toFixed(1)}" y1="${String(a)}" y2="${String(a+d)}" class="target"></line>
      <circle cx="${y(g).toFixed(1)}" cy="${$(N).toFixed(1)}" r="6" style="fill:${t.color}" class="${o===e.mode?"":"other"}"></circle>
      <text x="${(y(g)+8).toFixed(1)}" y="${String(a+(o==="dark"?12:30))}" class="axis label">${o==="dark"?"Dark mode":"Light mode"} \u2022 ${String(g)} lux</text>`}),v=["dark","light"].map(o=>`M ${n(e.settings.rooms[o].lux).toFixed(0)} in ${o} mode's ${String(e.settings.rooms[o].lux)} lux`).join(", ");return`<svg class="chart" viewBox="0 0 ${String(l+i+20)} ${String(a+d+30)}" role="img" aria-label="How colorful ${e.label(t.key).toLowerCase()} looks as the room gets brighter: ${v}" aria-describedby="room-note">
      ${C.join("")}
      ${w.map(([o,g])=>`<text x="${y(o).toFixed(1)}" y="${String(a+d+20)}" class="axis" text-anchor="${o===1?"start":o===1e4?"end":"middle"}">${g}</text>`).join("")}
      <path d="${k}" fill="none" style="stroke:${t.color}" stroke-width="3" stroke-linecap="round"></path>
      ${m.join("")}
    </svg>
    <p class="soft" id="room-note">How colorful the palette's ${e.label(t.key).toLowerCase()} looks (M), from a dark room to daylight. The screen color never changes.</p>`}function $e(e){let[t,s]=[B(e.bases.light,e.tiers),B(e.bases.dark,e.tiers)];if(t===s)return`${c(`Lc ${String(t)}`)} on both bases`;let n=s<t?", since WCAG 2 rates colors on a dark base as more contrasty than APCA does":"";return`${c(`Lc ${String(t)}`)} on the light base and ${c(`Lc ${String(s)}`)} on the dark one${n}`}var re=["a dark room","a dim room","a normal lit room"];function ye(e){let t=M(e)[0];if(!t)return"Solving\u2026";let s=T(e.settings,"light"),n=L(e.settings,e.gamut),l=r=>{try{return n.cam(r,A(n,e.settings.bases[r],r,t.hue,200,s)).m}catch{return 0}},i=Math.floor(Math.min(30,l("light"),l("dark"))),a;try{a={light:A(n,e.settings.bases.light,"light",t.hue,i,s),dark:A(n,e.settings.bases.dark,"dark",t.hue,i,s)}}catch{return`<p class="soft">No color at this hue reaches ${c(`Lc ${String(s)}`)} on both bases.</p>`}let d=H.map(r=>{let f=a[r],p=n.cam(r,f);return`<figure class="on-base" style="--base:${e.settings.bases[r]};--c:${f};--ink:var(--fg-${r})">
      <span class="demo-swatch"></span><span class="on-base-sample">Aa</span>
      <figcaption><strong>${I[r]} mode</strong><span>Looks ${c(`M ${p.m.toFixed(0)}`)} \u2022 chroma ${c(`C ${p.chroma.toFixed(0)}`)}</span></figcaption>
    </figure>`}),[h,b]=H.map(r=>n.cam(r,a[r]).chroma),y=Math.abs(h-b)<1?"Both need about the same chroma on the screen: their rooms and bases make colors look alike.":`${I[b>h?"dark":"light"]} mode needs more chroma on the screen to look as colorful: its room and base make colors look quieter.`;return`<div class="demo-pair">${d.join("")}</div><p class="soft">${e.label(t.key)}'s hue at ${c(`M ${String(i)}`)} on ${c(`Lc ${String(s)}`)}, in each mode's room. ${y}</p>`}function ce(e){let t=Number(S(e,"demo-hue")),s=Number(S(e,"demo-lc")),n=e.settings.bases[e.mode],l;try{l=A(L(e.settings,e.gamut),n,e.mode,t,e.settings.colorfulness,s)}catch{return`<p class="soft">No color at this hue reaches Lc ${String(s)} on this base.</p>`}let i=L(e.settings,e.gamut).cam(e.mode,l),a=z(l,n);return`<span class="demo-swatch" style="--c:${l}"></span>
    <span class="demo-sample" style="color:${l}">Aa Palette</span>
    <dl class="demo-numbers">
      <div><dt>APCA</dt><dd class="mono">Lc ${K(l,n).toFixed(1)}</dd></div>
      <div><dt>WCAG 2</dt><dd class="mono">${a.toFixed(2)} \u2022 ${V(a)}</dd></div>
      <div><dt>Lightness J</dt><dd class="mono">${i.j.toFixed(1)}</dd></div>
      <div><dt>Colorfulness M</dt><dd class="mono">${i.m.toFixed(1)}</dd></div>
      <div><dt>Hue</dt><dd class="mono">${i.hue.toFixed(0)}\xB0 \u2022 ${Q(i.hue)}</dd></div>
    </dl>`}function ie(e,t){return t==="standard"?`color-mix(in oklch, ${e} 45%, var(--soft))`:t==="ultra"?`oklch(from ${e} l calc(c * 1.6) h)`:e}function me(e){let t=M(e);if(!t.length)return"Solving\u2026";let s=he(e,"demo-tier"),n=e.settings.bases[e.mode],l=t.map(m=>({...m,reach:E.map(v=>{let o=L(e.settings,v);try{return o.cam(e.mode,A(o,n,e.mode,m.hue,200,s)).m}catch{return 0}})})),i=E.indexOf(e.gamut),a=e.settings.colorfulness,d=l.reduce((m,v)=>v.reach[i]<m.reach[i]?v:m),h=e.settings.equalTiers&&d.reach[i]<a,b=h?d.reach[i]:a,y=Math.ceil(Math.max(a,...l.flatMap(m=>m.reach))/20)*20,[r,f,p]=[96,504,34],u=m=>r+Math.min(m,y)/y*f,$=l.length*p+40,k=Array.from({length:y/20+1},(m,v)=>v*20).map(m=>`<line x1="${String(u(m))}" x2="${String(u(m))}" y1="0" y2="${String($-24)}" class="grid"></line>
      <text x="${String(u(m))}" y="${String($-8)}" class="axis" text-anchor="middle">${String(m)}</text>`),C=l.map((m,v)=>{let o=v*p+6,g=h&&m===d;return`<g class="${g?"limiter":h?"follower":""}">
      <text x="0" y="${String(o+15)}" class="axis label">${e.label(m.key)}${h&&!g?" \u2193":""}</text>
      ${m.reach.map((N,_)=>`<rect x="${String(r)}" y="${String(o+_*8)}" width="${(u(N)-r).toFixed(1)}" height="6" rx="3" fill="${m.color}" style="fill:${ie(m.color,E[_])}"></rect>`).join("")}</g>`}),w=m=>`<span><i class="bar-key" style="background:${ie(d.color,m)}"></i>${j[m]}</span>`;return`<svg class="chart" viewBox="0 0 ${String(r+f+20)} ${String($)}" role="img" aria-label="How colorful each hue can be on Lc ${String(s)} in ${e.mode} mode, on Standard, Wide and Ultra" aria-describedby="reach-note">
      ${k.join("")}${C.join("")}
      <line x1="${String(u(a))}" x2="${String(u(a))}" y1="0" y2="${String($-24)}" class="target"></line>
      <line x1="${u(b).toFixed(1)}" x2="${u(b).toFixed(1)}" y1="0" y2="${String($-24)}" class="ceiling"></line>
    </svg>
    <p class="demo-verdict" id="reach-note">${h?`On ${j[e.gamut]}, <strong>${e.label(d.key)}</strong> can only reach ${c(`M ${b.toFixed(1)}`)} on ${c(`Lc ${String(s)}`)}, so every color on this tier stops there.`:d.reach[i]<a?`On ${j[e.gamut]}, <strong>${e.label(d.key)}</strong> can only reach ${c(`M ${d.reach[i].toFixed(1)}`)} on ${c(`Lc ${String(s)}`)}; with Equal per tier off, each color goes as far as it can.`:`On ${j[e.gamut]}, every hue reaches the target on ${c(`Lc ${String(s)}`)}.`}</p>
    <p class="legend-row soft">${E.map(w).join("")}
      <span><i class="line-key target"></i>Target ${c(`M ${String(a)}`)}</span><span><i class="line-key ceiling"></i>This tier on ${j[e.gamut]}</span>${h?"<span>\u2193 Lowered</span>":""}</p>`}function ue(e){let t=(e.palette?.[e.mode].colors??[]).filter(w=>w.kind==="hue");if(t.length<2)return"Solving\u2026";let s=he(e,"demo-dtier"),n=(w,m)=>t.find(v=>v.key===S(e,w))??t[m],[l,i]=[n("demo-a",0),n("demo-b",1)],[a,d]=[l.tiers[s].default.color,i.tiers[s].default.color],h=L(e.settings,e.gamut),[b,y]=[h.cam(e.mode,a),h.cam(e.mode,d)],r=b.distance(y),f=J(b,y),p=w=>`${String(Math.round(w*100))}%`,u=e.palette?.[e.mode].ring[s]??[],$=u.length?u.reduce((w,m)=>w+m,0)/u.length:0,k=Math.max(30,Math.ceil(r/10)*10),C=w=>`${(Math.min(w,k)/k*100).toFixed(1)}%`;return`<div class="demo-touch"><span style="--c:${a}"></span><span style="--c:${d}"></span></div>
    <p class="demo-sample"><span style="color:${a}">${e.label(l.key)}</span> <span style="color:${d}">${e.label(i.key)}</span></p>
    <dl class="demo-numbers">
      <div><dt>Difference</dt><dd class="mono">${r.toFixed(1)}</dd></div>
      <div><dt>From lightness</dt><dd class="mono">${p(f.lightness)}</dd></div>
      <div><dt>From colorfulness</dt><dd class="mono">${p(f.colorfulness)}</dd></div>
      <div><dt>From hue</dt><dd class="mono">${p(f.hue)}</dd></div>
    </dl>
    <div class="scale">
      <span class="scale-fill" style="width:${C(r)}"></span>
      <span class="scale-mark" style="left:${C(O)}"><span>Just visible</span></span>
      ${$?`<span class="scale-mark" style="left:${C($)}"><span>Neighbors on this tier</span></span>`:""}
    </div>
    <p class="soft">CAM16-UCS distance, and the share of it each part makes up. About ${String(O)} is the smallest difference most people see with two colors side by side.${u.length?` On ${c(`Lc ${String(s)}`)} here, neighbors are ${c(Math.min(...u).toFixed(1))} to ${c(Math.max(...u).toFixed(1))} apart, ${c($.toFixed(1))} on average: the uniform lineup spaces them as evenly as the screen allows, and placed hues and colorfulness per hue move them on purpose.`:""}</p>`}function be(e){let t=M(e),s=e.palette?.[e.mode].ring[T(e.settings,e.mode)]??[];if(!s.length)return"Solving\u2026";let n=Math.max(...s);return s.map((l,i)=>`<div class="bar-row"><span class="soft">${e.label(t[i].key)} \u2192 ${e.label(t[(i+1)%t.length].key)}</span>
        <span class="bar"><span style="width:${(l/n*100).toFixed(1)}%"></span></span><span class="mono">${l.toFixed(1)}</span></div>`).join("")}function ge(e){let t=M(e),s=T(e.settings,e.mode),n=e.palette?.[e.mode].targets[s];if(!t.length||n===void 0)return"Solving\u2026";let l={amount:Number(S(e,"demo-amount")),center:Number(S(e,"demo-center")),width:Number(S(e,"demo-width"))},i=o=>Z({colorfulnessPerHue:{light:[l],dark:[l]}},e.mode,o),[a,d,h,b,y]=[36,564,10,120,12],r=o=>a+o/360*d,f=o=>h+b/2-Math.max(-y,Math.min(y,o))/y*(b/2),p=Array.from({length:181},(o,g)=>`${g?"L":"M"}${r(g*2).toFixed(1)} ${f(i(g*2)).toFixed(1)}`).join(" "),u=[-12,-6,0,6,12].map(o=>`<line x1="${String(a)}" x2="${String(a+d)}" y1="${f(o).toFixed(1)}" y2="${f(o).toFixed(1)}" class="${o===0?"target":"grid"}"></line>
      <text x="${String(a-6)}" y="${(f(o)+4).toFixed(1)}" class="axis" text-anchor="end">${R(o)}</text>`),$=[0,90,180,270,360].map(o=>`<text x="${r(o).toFixed(1)}" y="${String(h+b+16)}" class="axis" text-anchor="middle">${String(o)}\xB0</text>`),k=t.map(o=>`<circle cx="${r(o.hue).toFixed(1)}" cy="${f(i(o.hue)).toFixed(1)}" r="6" style="fill:${o.color}" class="mark"></circle>`),C=L(e.settings,e.gamut),w=e.settings.bases[e.mode],m=(o,g)=>{try{return A(C,w,e.mode,o,g,s)}catch{return"transparent"}},v=o=>`<div class="demo-touch short">${t.map(g=>`<span style="--c:${m(g.hue,o(g.hue))}"></span>`).join("")}</div>`;return`<svg class="chart" viewBox="0 0 ${String(a+d+12)} ${String(h+b+24)}" role="img" aria-label="Colorfulness added over hue: ${R(l.amount)} at ${String(l.center)}\xB0, easing to none ${String(l.width)}\xB0 away" aria-describedby="bump-note">
      ${u.join("")}${$.join("")}<path d="${p}" fill="none" class="curve-line"></path>${k.join("")}
    </svg>
    <div class="swatch-rows"><span class="soft">Without</span>${v(()=>n)}<span class="soft">With</span>${v(o=>n+i(o))}</div>
    <p class="soft" id="bump-note">${c(`Lc ${String(s)}`)}, aiming at ${c(`M ${n.toFixed(1)}`)}. The colors move only where the bump reaches; this is a sandbox and changes nothing in the palette.</p>`}function we(e){let t=e.settings,s=M(e);if(!s.length)return"Solving\u2026";let{keys:n}=te(t),l=W(t),[i,a]=[12,576],d=r=>i+(r%360+360)%360/360*a,b=n.flatMap((r,f)=>{let p=s.find(k=>k.key===r);if(!p)return[];let u=l+f*360/n.length,$=f>0&&t.placed[r]!==void 0;return[{key:r,color:p.color,even:u,landed:p.hue,placed:$,anchor:f===0}]}).map((r,f)=>{let[p,u]=[d(r.even),d(r.landed)],$=Math.abs(u-p)>a/2?u<p?u+a:u-a:u;return`<line x1="${p.toFixed(1)}" y1="34" x2="${$.toFixed(1)}" y2="76" class="grid"></line>
        <line x1="${p.toFixed(1)}" x2="${p.toFixed(1)}" y1="26" y2="40" class="tick"></line>
        <circle cx="${u.toFixed(1)}" cy="80" r="7" style="fill:${r.color}" class="${r.placed||r.anchor?"pinned":"mark"}"></circle>
        <text x="${u.toFixed(1)}" y="${String(f%2?116:102)}" class="axis" text-anchor="middle">${e.label(r.key)}${r.anchor?" \u2022 anchor":""}</text>`}).join("");return`<svg class="chart" viewBox="0 0 600 124" role="img" aria-label="Even starting hues and where each color sits" aria-describedby="starts-key">
      ${[0,90,180,270,360].map(r=>`<text x="${d(r===360?359.99:r).toFixed(1)}" y="16" class="axis" text-anchor="middle">${String(r)}\xB0</text>`).join("")}<line x1="${String(i)}" x2="${String(i+a)}" y1="33" y2="33" class="grid"></line>${b}
    </svg>
    <p class="legend-row soft" id="starts-key"><span><i class="tick-key"></i>Even start from the anchor</span><span><i class="dot-key"></i>Where it sits</span><span><i class="dot-key pinned"></i>Placed by hand, or the anchor</span></p>`}function pe(e){let t=e.palette?.[e.mode].colors??[];if(!t.length)return"Solving\u2026";let s=t.find(i=>i.key===S(e,"demo-color"))??t[0],n=e.settings.tiers,l=i=>n.map(a=>{let d=s.tiers[a][i];return d?`<span class="ladder-cell"><span class="ladder-swatch" style="--c:${d.color}"></span><span class="mono">Lc ${String(a)}</span><span class="mono soft">M ${d.colorfulness.toFixed(1)}</span></span>`:"<span></span>"}).join("");return`<div class="ladder" style="--n:${String(n.length)}"><span class="soft">Default</span>${l("default")}<span class="soft">Muted</span>${l("muted")}</div>`}var le={tier:ce,reach:me,difference:ue,bump:ge,ladder:pe};function Ae(e,t){de.set(t.id,t.value);let s=t.dataset.demo,n=document.querySelector(`#demo-${s}-out`);n&&s in le&&(n.innerHTML=le[s](e))}function Fe(e){let t=e.settings,s=M(e).length,n=t.customColors.length,l=(s+n)*t.tiers.length*2*2*E.length,i=Y(t),a=M(e).map(h=>[h.key,e.label(h.key)]),d=x(e.mode);return`<section class="intro">
      <h1>How it works</h1>
      <p><strong>EK Colors</strong> solves color palettes instead of picking them by eye. A small program builds a palette from a handful of rules, so every color can be explained, and solved again when a rule changes. It starts from <strong>EK Palette</strong>, the palette it was made for; change the settings and it solves a palette of its own. This page walks through the rules one at a time; every demo runs the same code as the solver.</p>
      <p class="soft">This is the plain-words version. For every formula, constant and search rule, see <a href="#algorithm">the algorithm</a>; for the research and software it's built on, see <a href="#references">References</a>.</p>
    </section>

    <section class="step">
      <h2>What it makes</h2>
      <p>${c(String(s))} hues${n?` and ${c(String(n))} custom ${n===1?"color":"colors"}`:""}, each on ${c(String(t.tiers.length))} contrast tiers, in a default and a muted version, for light and dark, for three kinds of screen: ${c(String(l))} colors in all, with Gray on every tier${t.neutralColors.length?` and ${c(String(t.neutralColors.length))} neutral ${t.neutralColors.length===1?"color":"colors"}`:""} beside them. They all follow the same rules, so the rules only have to be learned once.</p>
    </section>

    <section class="step">
      <h2>Color depends on the room</h2>
      <p>The same red looks stronger in a bright room than in a dim one, and different on a light page than on a dark one. To compare colors fairly, the solver uses <strong>CAM16</strong>, a model of human color vision. It's told what the eye is looking at and where: the page's base color as the background, and the room's light. The light mode's base is always lighter than the dark mode's.</p>
      <p>Light mode is seen at ${c(`${String(t.rooms.light.lux)} lux`)}, ${re[t.rooms.light.surround]??"a room"}. Dark mode is seen at ${c(`${String(t.rooms.dark.lux)} lux`)}, ${re[t.rooms.dark.surround]??"a room"}. ${t.rooms.light.lux===200&&t.rooms.dark.lux===64?"Both come from the sRGB standard: its typical room and its reference room.":"By default they're 200 and 64 lux, the sRGB standard's typical and reference rooms."} CAM16 then gives three numbers people can feel: <em>lightness</em> (J), <em>colorfulness</em> (M) and <em>hue</em>.</p>
      <div class="demo"><div class="demo-out wide">${fe(e)}</div></div>
      <p>So the same target needs different screen colors in each mode. Both of these aim at the same colorfulness.</p>
      <div class="demo"><div class="demo-out wide">${ye(e)}</div></div>
    </section>

    <section class="step">
      <h2>Contrast decides lightness</h2>
      <p>Every color has a job, and the job decides how much it must stand out from the background. The solver measures that with <strong>APCA</strong>, a contrast method proposed for the next version of the web's accessibility guidelines. APCA reads light-on-dark and dark-on-light differently, the way eyes do. Its unit is Lc.</p>
      <div class="scroll"><table class="roles"><tbody>${t.tiers.map(h=>`<tr><th scope="row" class="mono">Lc ${String(h)}</th><td>${X[h]??""}</td></tr>`).join("")}</tbody></table></div>
      <p>For each hue and tier, the solver searches lightness until the color sits exactly on the tier: never below it, and only as far above as rounding forces. The older WCAG 2 contrast is reported beside every color too, because laws still point to it. Its badge says what that ratio allows: AAA and AA pass for text, AA large only for large text and for icons, borders and controls, and below 3:1 for nothing that must be read. Each badge opens its level.</p>
      <p>One tier stands for each hue: the <strong>identity tier</strong>. It's where the colors look most like themselves: clear enough to read, neither faint nor heavy. The solver picks it as the tier where APCA and WCAG 2, taken together, come closest to their minimum for text: ${$e(t)}.${H.filter(h=>t.identityTier[h]!=="auto").map(h=>` Here, ${h} mode's is set by hand to ${c(`Lc ${String(T(t,h))}`)}.`).join("")} Any tier can be made the identity on the Tiers page, or in Settings.</p>
      <div class="demo">
        <div class="demo-controls">
          ${D(e,"demo-hue","Hue",[0,359,1],"tier")}
          ${D(e,"demo-lc","Contrast",[15,90,1],"tier")}
        </div>
        <div id="demo-tier-out" class="demo-out">${ce(e)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Equally colorful</h2>
      <p>Every hue aims at the same colorfulness: ${c(`M ${String(t.colorfulness)}`)}, apart from what colorfulness per hue (below) adds or takes away. The screen doesn't always allow it. Near white, a screen can show a strong yellow but only a pale red; near black, the opposite. With <strong>Equal per tier</strong> on, each tier's target drops to what its least colorful hue can reach, and every color on the tier follows, so nothing stands out by accident. Switched off in Settings, each color goes as far as the screen allows instead, and a tier is no longer equally colorful.</p>
      <p>The chart shows how far each hue could go on one tier, on each kind of screen.</p>
      <div class="demo">
        <div class="demo-controls">
          ${P(e,"demo-tier","Tier",ne(e),"reach")}
        </div>
        <div id="demo-reach-out" class="demo-out wide">${me(e)}</div>
      </div>
      <p>Small marks say what happened to a color. <strong>Sets the tier</strong>, an amber flag, marks the color whose reach the tier was lowered to. <strong>Lowered</strong>, a gray \u2193, marks a color held below its own aim because of it. <strong>Gamut limit</strong>, a red !, marks a color the screen can't make as colorful as it should be at all. Tables show them in small chips beside the M value; on cards the flag sits beside the name, and a Lowered or Gamut limit color shows its M value in gray or red with its mark. A key under the colors says which is which, and each mark opens why, with the numbers.</p>
    </section>

    <section class="step">
      <h2>Colorfulness per hue (M)</h2>
      <p>The model isn't perfect: some parts of the circle can look weaker or stronger to the eye than CAM16 says. <strong>Colorfulness per hue</strong> adds or takes away colorfulness smoothly over the circle, as a few points that each ease to nothing on either side, so neighbors never jump. Light and dark each have their own curve.</p>
      <div class="demo">
        <div class="demo-controls">
          ${D(e,"demo-amount","Amount",[-12,12,1],"bump")}
          ${D(e,"demo-center","Center",[0,359,1],"bump")}
          ${D(e,"demo-width","Width",[20,180,5],"bump")}
        </div>
        <div id="demo-bump-out" class="demo-out wide">${ge(e)}</div>
      </div>
      <p>The <strong>blind colorfulness test</strong> in Settings measures where it's needed. It shows two colors at a time, without names, and asks which looks more colorful, nudging the color it's testing after each answer, apart from the occasional easy check, until it finds where each hue looks as colorful as the others. Its result can be applied as the curve.</p>
    </section>

    <section class="step">
      <h2>Evenly different</h2>
      <p>Two neighboring colors should be as easy to tell apart as any other two. CAM16 has a uniform space, CAM16-UCS, where distance matches how different colors look. The hues start evenly apart in angle, ${c(String(s))} hues ${c(`${(360/s).toFixed(s===8?0:1)}\xB0`)} apart. Angles aren't how differences are seen, though, so the solver nudges each one, a few degrees at a time, until the differences around the circle are as even as they can be. That's the <strong>uniform lineup</strong>.</p>
      <p>Evening out the differences doesn't say where the lineup sits, since turning all of it around the circle keeps them almost the same. So one hue, ${e.label(ee(t.hues)[0]).toLowerCase()}, is the <strong>anchor</strong>, and every other hue is spaced from it. It sits at ${c(`${W(t).toFixed(0)}\xB0`)} here, ${i}. It can be the yellow of CAM16, Munsell, NCS, unique-hue studies or the World Color Survey's focal colors, or any hue; the same systems can be drawn as guides on the hue graphs, to see where each puts its hues.</p>
      <div class="demo">
        <div class="demo-controls">
          ${P(e,"demo-a","First color",a,"difference")}
          ${P(e,"demo-b","Second color",a,"difference")}
          ${P(e,"demo-dtier","Tier",ne(e),"difference")}
        </div>
        <div id="demo-difference-out" class="demo-out wide">${ue(e)}</div>
      </div>
      <p>Around the circle on the tier that stands for each hue:</p>
      <div class="demo"><div class="demo-out wide">${be(e)}</div></div>
    </section>

    <section class="step">
      <h2>Placing hues (H)</h2>
      <p>A name fits some hues better than others: an even red can lean pink, an even blue can lean cyan. So any color can be <strong>placed</strong> by hand where its name fits best, by dragging it on the hue graph in Settings, and the others re-space evenly around it. Colors keep their order around the circle: a placed color stays between its neighbors. It can come as close to them as asked; once two neighbors are under a visible step apart (\u0394E ${String(O)}) on any tier, the graph says so in amber.</p>
      <div class="demo"><div class="demo-out wide">${we(e)}</div></div>
      <p>The <strong>blind hue test</strong> in Settings measures where each name fits. It shows one color at a time, without its name, and asks whether it leans toward the color before it or the one after it; the hue where it leans neither way is the middle of its name, and a color can be placed there.</p>
    </section>

    <section class="step">
      <h2>Reading changes</h2>
      <p>Placed hues and colorfulness per hue are edits on top of the uniform lineup. The <strong>H</strong> and <strong>M</strong> switches in the header turn them off and on across the pages, so the palette can be seen with and without them.</p>
      <p>At the top of Settings, a strip shows the palette a step at a time. <strong>Uniform</strong> is the evenly spaced lineup. <strong>Turned</strong> is the same lineup turned around the circle to best match the placed hues; turning keeps it uniform. <strong>+H</strong> adds the placed hues, and <strong>+M</strong> colorfulness per hue. How far the edits take the palette from the turned lineup is its <strong>bend</strong>, in gaps: one gap is the even difference between neighbors${d?`, ${c(`${d.toFixed(1)} \u0394E`)} in ${e.mode} mode here`:""}, \u0394E being how different two colors look in CAM16-UCS. Here's the strip for this palette; point at a swatch or a row for its numbers, and click a number for what it means.</p>
      <div class="demo"><div id="palette-strip" class="strip"></div></div>
      ${oe(x(e.mode))}
      <p>Bending colors is what placing is for, so bend isn't the risk in itself. Evenness is: when two neighbors end up closer than the even gap, they're easier to confuse. Under ${c(`${String(G(x(e.mode))[0])}%`)} closer is fine, ${c(String(G(x(e.mode))[0]))} to ${c(`${String(G(x(e.mode))[1])}%`)} is worth watching, and over ${c(`${String(G(x(e.mode))[1])}%`)} they're getting confusable, for this palette's gap of ${c(`${x(e.mode).toFixed(1)} \u0394E`)}. A change is also split into what it's made of, hue, colorfulness and lightness, as shares that add up to the whole.</p>
    </section>

    <section class="step">
      <h2>Muted and custom colors</h2>
      <p>Muted colors are the same hue on the same tier, at ${c(`${String(Math.round(t.mutedShare*100))}%`)} of the default's colorfulness: quieter, never weaker in contrast. Every tier of one color:</p>
      <div class="demo">
        <div class="demo-controls">
          ${P(e,"demo-color","Color",(e.palette?.[e.mode].colors??[]).map(h=>[h.key,e.label(h.key)]),"ladder")}
        </div>
        <div id="demo-ladder-out" class="demo-out wide">${pe(e)}</div>
      </div>
      <p><strong>Custom colors</strong> sit beside the hues${n?`, like ${t.customColors.map(h=>se(h.name)).join(" and ")} here`:""}. Each has a name, its own hue and a share of the colorfulness: on every tier it's the most colorful color of that hue, up to its share of the tier's target, exactly on the tier's contrast, with a muted version too. Custom colors aren't spaced with the hues and aren't measured by the blind tests; on the hue circle they're drawn as diamonds. Settings adds as many as needed, under Extra colors.</p>
    </section>

    <section class="step">
      <h2>Neutrals</h2>
      <p>Every palette has <strong>Gray</strong> on every tier: no hue at all, red, green and blue the same, exactly on the tier's contrast against the base, as every color is.</p>
      <p>A <strong>neutral color</strong> takes the base's hue at a share of the base's own colorfulness, so it belongs with a base of that hue. On warm paper, text in a warm neutral sits on the page instead of looking cold on it. A color's colorfulness puts it in a zone: under M ${String(F[0])} it reads as gray, from M ${String(F[0])} to ${String(F[1])} it shows the hue yet reads as a neutral, and past that it reads as a color. The limits come from color difference, measured on four test bases: M ${String(F[0])} is just past a visible step from Gray side by side, and M ${String(F[1])} a little past a different shade of it. A color's page gives its own distance from Gray. In Settings, a bar under every colorfulness slider shows the zones, and its readout explains them.</p>
      <p>A palette can have several neutral colors, each with its own share, added in Settings under Extra colors. Each mode follows its own base. A base under M ${String(F[0])}, gray or nearly, has no hue to give, so in that mode its neutral colors are Gray; when both bases are gray, there are none to add. Gray and each neutral color have pages of their own beside the colors'.</p>
    </section>

    <section class="step">
      <h2>Three kinds of screen</h2>
      <p>Screens differ in how much color they can show, their gamut; the Gamut switch in the header picks one of the three. <strong>Standard</strong> is what every screen shows. <strong>Wide</strong> is what most new phones and computers show, iPhones and Macs included. <strong>Ultra</strong> is the widest, which few screens fully reach yet.</p>
      <p>The palette is solved once per kind, each on its own, against its own base: the base itself where the screen can show it, else the closest color it can show, or one picked by hand. A wider screen keeps more color on the tiers where the standard one runs out, as the chart above shows. A website gives every screen the widest palette it can show.</p>
      <p>A dot on the Gamut switch marks the kind this screen shows. Picking a wider one still shows its palette, as closely as this screen can, with a note in red that the colors aren't exact.</p>
    </section>

    <section class="step">
      <h2>Every rule is a setting</h2>
      <p>The bases and rooms, the number of hues, the anchor and placed hues, the target colorfulness, whether tiers are equally colorful and the curve per hue, the tiers and the identity tier per mode, the muted share, and the custom and neutral colors are all settings. Change one in Settings and watch the palette follow; the changes stay in this browser.</p>
      <p>Settings also names the palette, resets it to EK Palette, and copies its settings to paste elsewhere. Compare shows a changed palette next to EK Palette. Export, near the end of Settings, gives the palette as JSON, CSV, Markdown or CSS, titled with its name.</p>
    </section>`}export{Fe as howPage,Ae as updateDemo};
