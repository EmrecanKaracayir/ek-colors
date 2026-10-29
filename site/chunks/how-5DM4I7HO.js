import{p as C}from"./chunk-4J4ZH2OA.js";import"./chunk-X2Y5TGFK.js";import"./chunk-R6CCDRJP.js";import{D as W,E as F,G as Z,H as ee,a as P,b as L,c as N,d as E,f as Q,s as x,t as Y,v as A}from"./chunk-7JYMHWRG.js";import{j,l as te,n as B,t as se}from"./chunk-C34FQDYE.js";import{A as I,B as X,g as H,j as U,s as _,t as J,u as K,v as z,w as V}from"./chunk-35RC7DVO.js";var le=new Map,R={"demo-hue":()=>25,"demo-lc":()=>60,"demo-tier":e=>e.settings.tiers.at(-1)??60,"demo-a":e=>S(e)[0]?.key??"","demo-b":e=>S(e)[1]?.key??"","demo-dtier":e=>F(e.settings,e.mode),"demo-amount":e=>Math.max(-12,Math.min(12,e.settings.colorfulnessPerHue[e.mode][0]?.amount??6)),"demo-center":e=>e.settings.colorfulnessPerHue[e.mode][0]?.center??20,"demo-width":e=>Math.max(20,Math.min(180,e.settings.colorfulnessPerHue[e.mode][0]?.width??60)),"demo-color":e=>e.palette?.[e.mode].colors[0]?.key??""};function k(e,t){return le.get(t)??String(R[t]?.(e)??"")}function de(e,t){let s=Number(k(e,t));return e.settings.tiers.includes(s)?s:Number(R[t](e))}function G(e,t,s,[n,l,i],a){return`<label for="${t}">${s} <input id="${t}" type="range" min="${String(n)}" max="${String(l)}" step="${String(i)}" value="${k(e,t)}" data-demo="${a}"></label>`}function D(e,t,s,n,l){let i=k(e,t),a=n.some(([d])=>d===i)?i:String(R[t]?.(e)??"");return`<label for="${t}">${s} <select id="${t}" data-demo="${l}">${n.map(([d,h])=>`<option value="${d}" ${d===a?"selected":""}>${h}</option>`).join("")}</select></label>`}var oe=e=>e.settings.tiers.map(t=>[String(t),`Lc ${String(t)}`]),ne=new Map;function T(e,t){let s=JSON.stringify([e.bases,e.rooms,t]),n=ne.get(s);return n||ne.set(s,n=U(e,t)),n}function S(e){let t=F(e.settings,e.mode);return(e.palette?.[e.mode].colors??[]).filter(s=>s.kind==="hue").map(s=>({key:s.key,hue:s.tiers[t].default.hue,color:s.tiers[t].default.color}))}function pe(e){let t=S(e)[0];if(!t)return"Solving\u2026";let s=e.settings.rooms[e.mode].surround,n=o=>{let u={lux:o,surround:s};return T({bases:e.settings.bases,rooms:{light:u,dark:u}},e.gamut).cam(e.mode,t.color).m},[l,i,a,d]=[44,540,12,180],[h,y]=[0,4],$=o=>l+(Math.log10(o)-h)/(y-h)*i,r=Array.from({length:41},(o,u)=>10**(h+u/40*(y-h))),p=r.map(n),[g,m]=[Math.floor(Math.min(...p)/10)*10,Math.ceil(Math.max(...p)/10)*10],f=o=>a+d-(o-g)/(m-g)*d,v=r.map((o,u)=>`${u?"L":"M"}${$(o).toFixed(1)} ${f(p[u]).toFixed(1)}`).join(" "),M=Array.from({length:(m-g)/10+1},(o,u)=>g+u*10).map(o=>`<line x1="${String(l)}" x2="${String(l+i)}" y1="${f(o).toFixed(1)}" y2="${f(o).toFixed(1)}" class="grid"></line>
      <text x="${String(l-8)}" y="${(f(o)+4).toFixed(1)}" class="axis" text-anchor="end">${String(o)}</text>`),b=[[1,"Dark room"],[10,"10 lux"],[100,"100"],[1e3,"Office 1 000"],[1e4,"Daylight"]],c=["dark","light"].map(o=>{let u=e.settings.rooms[o].lux,O=n(u);return`<line x1="${$(u).toFixed(1)}" x2="${$(u).toFixed(1)}" y1="${String(a)}" y2="${String(a+d)}" class="target"></line>
      <circle cx="${$(u).toFixed(1)}" cy="${f(O).toFixed(1)}" r="6" style="fill:${t.color}" class="${o===e.mode?"":"other"}"></circle>
      <text x="${($(u)+8).toFixed(1)}" y="${String(a+(o==="dark"?12:30))}" class="axis label">${o==="dark"?"Dark mode":"Light mode"} \u2022 ${String(u)} lux</text>`}),w=["dark","light"].map(o=>`M ${n(e.settings.rooms[o].lux).toFixed(0)} in ${o} mode's ${String(e.settings.rooms[o].lux)} lux`).join(", ");return`<svg class="chart" viewBox="0 0 ${String(l+i+20)} ${String(a+d+30)}" role="img" aria-label="How colorful ${e.label(t.key).toLowerCase()} looks as the room gets brighter: ${w}" aria-describedby="room-note">
      ${M.join("")}
      ${b.map(([o,u])=>`<text x="${$(o).toFixed(1)}" y="${String(a+d+20)}" class="axis" text-anchor="${o===1?"start":o===1e4?"end":"middle"}">${u}</text>`).join("")}
      <path d="${v}" fill="none" style="stroke:${t.color}" stroke-width="3" stroke-linecap="round"></path>
      ${c.join("")}
    </svg>
    <p class="soft" id="room-note">How colorful the palette's ${e.label(t.key).toLowerCase()} looks (M), from a dark room to daylight. The screen color never changes.</p>`}function fe(e){let[t,s]=[W(e.bases.light,e.tiers),W(e.bases.dark,e.tiers)];if(t===s)return`Lc ${String(t)} on both bases`;let n=s<t?", since WCAG 2 rates colors on a dark base as more contrasty than APCA does":"";return`Lc ${String(t)} on the light base and Lc ${String(s)} on the dark one${n}`}var ae=["a dark room","a dim room","a normal lit room"];function $e(e){let t=S(e)[0];if(!t)return"Solving\u2026";let s=F(e.settings,"light"),n=T(e.settings,e.gamut),l=r=>{try{return n.cam(r,x(n,e.settings.bases[r],r,t.hue,200,s)).m}catch{return 0}},i=Math.floor(Math.min(30,l("light"),l("dark"))),a;try{a={light:x(n,e.settings.bases.light,"light",t.hue,i,s),dark:x(n,e.settings.bases.dark,"dark",t.hue,i,s)}}catch{return`<p class="soft">No color at this hue reaches Lc ${String(s)} on both bases.</p>`}let d=P.map(r=>{let p=a[r],g=n.cam(r,p);return`<figure class="on-base" style="--base:${e.settings.bases[r]};--c:${p};--ink:var(--fg-${r})">
      <span class="demo-swatch"></span><span class="on-base-sample">Aa</span>
      <figcaption><strong>${N[r]} mode</strong><span>Looks M ${g.m.toFixed(0)} \u2022 chroma C ${g.chroma.toFixed(0)}</span></figcaption>
    </figure>`}),[h,y]=P.map(r=>n.cam(r,a[r]).chroma),$=Math.abs(h-y)<1?"Both need about the same chroma on the screen: their rooms and bases make colors look alike.":`${N[y>h?"dark":"light"]} mode needs more chroma on the screen to look as colorful: its room and base make colors look quieter.`;return`<div class="demo-pair">${d.join("")}</div><p class="soft">${e.label(t.key)}'s hue at M ${String(i)} on Lc ${String(s)}, in each mode's room. ${$}</p>`}function he(e){let t=Number(k(e,"demo-hue")),s=Number(k(e,"demo-lc")),n=e.settings.bases[e.mode],l;try{l=x(T(e.settings,e.gamut),n,e.mode,t,e.settings.colorfulness,s)}catch{return`<p class="soft">No color at this hue reaches Lc ${String(s)} on this base.</p>`}let i=T(e.settings,e.gamut).cam(e.mode,l),a=K(l,n);return`<span class="demo-swatch" style="--c:${l}"></span>
    <span class="demo-sample" style="color:${l}">Aa Palette</span>
    <dl class="demo-numbers">
      <div><dt>APCA</dt><dd class="mono">Lc ${J(l,n).toFixed(1)}</dd></div>
      <div><dt>WCAG 2</dt><dd class="mono">${a.toFixed(2)} \u2022 ${z(a)}</dd></div>
      <div><dt>Lightness J</dt><dd class="mono">${i.j.toFixed(1)}</dd></div>
      <div><dt>Colorfulness M</dt><dd class="mono">${i.m.toFixed(1)}</dd></div>
      <div><dt>Hue</dt><dd class="mono">${i.hue.toFixed(0)}\xB0 \u2022 ${V(i.hue)}</dd></div>
    </dl>`}function re(e,t){return t==="standard"?`color-mix(in oklch, ${e} 45%, var(--soft))`:t==="ultra"?`oklch(from ${e} l calc(c * 1.6) h)`:e}function ce(e){let t=S(e);if(!t.length)return"Solving\u2026";let s=de(e,"demo-tier"),n=e.settings.bases[e.mode],l=t.map(c=>({...c,reach:L.map(w=>{let o=T(e.settings,w);try{return o.cam(e.mode,x(o,n,e.mode,c.hue,200,s)).m}catch{return 0}})})),i=L.indexOf(e.gamut),a=e.settings.colorfulness,d=l.reduce((c,w)=>w.reach[i]<c.reach[i]?w:c),h=e.settings.equalTiers&&d.reach[i]<a,y=h?d.reach[i]:a,$=Math.ceil(Math.max(a,...l.flatMap(c=>c.reach))/20)*20,[r,p,g]=[96,504,34],m=c=>r+Math.min(c,$)/$*p,f=l.length*g+40,v=Array.from({length:$/20+1},(c,w)=>w*20).map(c=>`<line x1="${String(m(c))}" x2="${String(m(c))}" y1="0" y2="${String(f-24)}" class="grid"></line>
      <text x="${String(m(c))}" y="${String(f-8)}" class="axis" text-anchor="middle">${String(c)}</text>`),M=l.map((c,w)=>{let o=w*g+6,u=h&&c===d;return`<g class="${u?"limiter":h?"follower":""}">
      <text x="0" y="${String(o+15)}" class="axis label">${e.label(c.key)}${h&&!u?" \u2193":""}</text>
      ${c.reach.map((O,q)=>`<rect x="${String(r)}" y="${String(o+q*8)}" width="${(m(O)-r).toFixed(1)}" height="6" rx="3" fill="${c.color}" style="fill:${re(c.color,L[q])}"></rect>`).join("")}</g>`}),b=c=>`<span><i class="bar-key" style="background:${re(d.color,c)}"></i>${E[c]}</span>`;return`<svg class="chart" viewBox="0 0 ${String(r+p+20)} ${String(f)}" role="img" aria-label="How colorful each hue can be on Lc ${String(s)} in ${e.mode} mode, on Standard, Wide and Ultra" aria-describedby="reach-note">
      ${v.join("")}${M.join("")}
      <line x1="${String(m(a))}" x2="${String(m(a))}" y1="0" y2="${String(f-24)}" class="target"></line>
      <line x1="${m(y).toFixed(1)}" x2="${m(y).toFixed(1)}" y1="0" y2="${String(f-24)}" class="ceiling"></line>
    </svg>
    <p class="demo-verdict" id="reach-note">${h?`On ${E[e.gamut]}, <strong>${e.label(d.key)}</strong> can only reach M ${y.toFixed(1)} on Lc ${String(s)}, so every color on this tier stops there.`:d.reach[i]<a?`On ${E[e.gamut]}, <strong>${e.label(d.key)}</strong> can only reach M ${d.reach[i].toFixed(1)} on Lc ${String(s)}; with Equal per tier off, each color goes as far as it can.`:`On ${E[e.gamut]}, every hue reaches the target on Lc ${String(s)}.`}</p>
    <p class="legend-row soft">${L.map(b).join("")}
      <span><i class="line-key target"></i>Target M ${String(a)}</span><span><i class="line-key ceiling"></i>This tier on ${E[e.gamut]}</span>${h?"<span>\u2193 Lowered</span>":""}</p>`}function me(e){let t=(e.palette?.[e.mode].colors??[]).filter(b=>b.kind==="hue");if(t.length<2)return"Solving\u2026";let s=de(e,"demo-dtier"),n=(b,c)=>t.find(w=>w.key===k(e,b))??t[c],[l,i]=[n("demo-a",0),n("demo-b",1)],[a,d]=[l.tiers[s].default.color,i.tiers[s].default.color],h=T(e.settings,e.gamut),[y,$]=[h.cam(e.mode,a),h.cam(e.mode,d)],r=y.distance($),p=_(y,$),g=b=>`${String(Math.round(b*100))}%`,m=e.palette?.[e.mode].ring[s]??[],f=m.length?m.reduce((b,c)=>b+c,0)/m.length:0,v=Math.max(30,Math.ceil(r/10)*10),M=b=>`${(Math.min(b,v)/v*100).toFixed(1)}%`;return`<div class="demo-touch"><span style="--c:${a}"></span><span style="--c:${d}"></span></div>
    <p class="demo-sample"><span style="color:${a}">${e.label(l.key)}</span> <span style="color:${d}">${e.label(i.key)}</span></p>
    <dl class="demo-numbers">
      <div><dt>Difference</dt><dd class="mono">${r.toFixed(1)}</dd></div>
      <div><dt>From lightness</dt><dd class="mono">${g(p.lightness)}</dd></div>
      <div><dt>From colorfulness</dt><dd class="mono">${g(p.colorfulness)}</dd></div>
      <div><dt>From hue</dt><dd class="mono">${g(p.hue)}</dd></div>
    </dl>
    <div class="scale">
      <span class="scale-fill" style="width:${M(r)}"></span>
      <span class="scale-mark" style="left:${M(H)}"><span>Just visible</span></span>
      ${f?`<span class="scale-mark" style="left:${M(f)}"><span>Neighbors on this tier</span></span>`:""}
    </div>
    <p class="soft">CAM16-UCS distance, and the share of it each part makes up. About ${String(H)} is the smallest difference most people see with two colors side by side.${m.length?` On Lc ${String(s)} here, neighbors are ${Math.min(...m).toFixed(1)} to ${Math.max(...m).toFixed(1)} apart, ${f.toFixed(1)} on average: the uniform lineup spaces them as evenly as the screen allows, and placed hues and colorfulness per hue move them on purpose.`:""}</p>`}function ye(e){let t=S(e),s=e.palette?.[e.mode].ring[F(e.settings,e.mode)]??[];if(!s.length)return"Solving\u2026";let n=Math.max(...s);return s.map((l,i)=>`<div class="bar-row"><span class="soft">${e.label(t[i].key)} \u2192 ${e.label(t[(i+1)%t.length].key)}</span>
        <span class="bar"><span style="width:${(l/n*100).toFixed(1)}%"></span></span><span class="mono">${l.toFixed(1)}</span></div>`).join("")}function ue(e){let t=S(e),s=F(e.settings,e.mode),n=e.palette?.[e.mode].targets[s];if(!t.length||n===void 0)return"Solving\u2026";let l={amount:Number(k(e,"demo-amount")),center:Number(k(e,"demo-center")),width:Number(k(e,"demo-width"))},i=o=>Y({colorfulnessPerHue:{light:[l],dark:[l]}},e.mode,o),[a,d,h,y,$]=[36,564,10,120,12],r=o=>a+o/360*d,p=o=>h+y/2-Math.max(-$,Math.min($,o))/$*(y/2),g=Array.from({length:181},(o,u)=>`${u?"L":"M"}${r(u*2).toFixed(1)} ${p(i(u*2)).toFixed(1)}`).join(" "),m=[-12,-6,0,6,12].map(o=>`<line x1="${String(a)}" x2="${String(a+d)}" y1="${p(o).toFixed(1)}" y2="${p(o).toFixed(1)}" class="${o===0?"target":"grid"}"></line>
      <text x="${String(a-6)}" y="${(p(o)+4).toFixed(1)}" class="axis" text-anchor="end">${B(o)}</text>`),f=[0,90,180,270,360].map(o=>`<text x="${r(o).toFixed(1)}" y="${String(h+y+16)}" class="axis" text-anchor="middle">${String(o)}\xB0</text>`),v=t.map(o=>`<circle cx="${r(o.hue).toFixed(1)}" cy="${p(i(o.hue)).toFixed(1)}" r="6" style="fill:${o.color}" class="mark"></circle>`),M=T(e.settings,e.gamut),b=e.settings.bases[e.mode],c=(o,u)=>{try{return x(M,b,e.mode,o,u,s)}catch{return"transparent"}},w=o=>`<div class="demo-touch short">${t.map(u=>`<span style="--c:${c(u.hue,o(u.hue))}"></span>`).join("")}</div>`;return`<svg class="chart" viewBox="0 0 ${String(a+d+12)} ${String(h+y+24)}" role="img" aria-label="Colorfulness added over hue: ${B(l.amount)} at ${String(l.center)}\xB0, easing to none ${String(l.width)}\xB0 away" aria-describedby="bump-note">
      ${m.join("")}${f.join("")}<path d="${g}" fill="none" class="curve-line"></path>${v.join("")}
    </svg>
    <div class="swatch-rows"><span class="soft">Without</span>${w(()=>n)}<span class="soft">With</span>${w(o=>n+i(o))}</div>
    <p class="soft" id="bump-note">Lc ${String(s)}, aiming at M ${n.toFixed(1)}. The colors move only where the bump reaches; this is a sandbox and changes nothing in the palette.</p>`}function be(e){let t=e.settings,s=S(e);if(!s.length)return"Solving\u2026";let{keys:n}=ee(t),l=I(t),[i,a]=[12,576],d=r=>i+(r%360+360)%360/360*a,y=n.flatMap((r,p)=>{let g=s.find(v=>v.key===r);if(!g)return[];let m=l+p*360/n.length,f=p>0&&t.placed[r]!==void 0;return[{key:r,color:g.color,even:m,landed:g.hue,placed:f,anchor:p===0}]}).map((r,p)=>{let[g,m]=[d(r.even),d(r.landed)],f=Math.abs(m-g)>a/2?m<g?m+a:m-a:m;return`<line x1="${g.toFixed(1)}" y1="34" x2="${f.toFixed(1)}" y2="76" class="grid"></line>
        <line x1="${g.toFixed(1)}" x2="${g.toFixed(1)}" y1="26" y2="40" class="tick"></line>
        <circle cx="${m.toFixed(1)}" cy="80" r="7" style="fill:${r.color}" class="${r.placed||r.anchor?"pinned":"mark"}"></circle>
        <text x="${m.toFixed(1)}" y="${String(p%2?116:102)}" class="axis" text-anchor="middle">${e.label(r.key)}${r.anchor?" \u2022 anchor":""}</text>`}).join("");return`<svg class="chart" viewBox="0 0 600 124" role="img" aria-label="Even starting hues and where each color sits" aria-describedby="starts-key">
      ${[0,90,180,270,360].map(r=>`<text x="${d(r===360?359.99:r).toFixed(1)}" y="16" class="axis" text-anchor="middle">${String(r)}\xB0</text>`).join("")}<line x1="${String(i)}" x2="${String(i+a)}" y1="33" y2="33" class="grid"></line>${y}
    </svg>
    <p class="legend-row soft" id="starts-key"><span><i class="tick-key"></i>Even start from the anchor</span><span><i class="dot-key"></i>Where it sits</span><span><i class="dot-key pinned"></i>Placed by hand, or the anchor</span></p>`}function ge(e){let t=e.palette?.[e.mode].colors??[];if(!t.length)return"Solving\u2026";let s=t.find(i=>i.key===k(e,"demo-color"))??t[0],n=e.settings.tiers,l=i=>n.map(a=>{let d=s.tiers[a][i];return d?`<span class="ladder-cell"><span class="ladder-swatch" style="--c:${d.color}"></span><span class="mono">Lc ${String(a)}</span><span class="mono soft">M ${d.colorfulness.toFixed(1)}</span></span>`:"<span></span>"}).join("");return`<div class="ladder" style="--n:${String(n.length)}"><span class="soft">Default</span>${l("default")}<span class="soft">Muted</span>${l("muted")}</div>`}var ie={tier:he,reach:ce,difference:me,bump:ue,ladder:ge};function xe(e,t){le.set(t.id,t.value);let s=t.dataset.demo,n=document.querySelector(`#demo-${s}-out`);n&&s in ie&&(n.innerHTML=ie[s](e))}function Ae(e){let t=e.settings,s=S(e).length,n=t.customColors.length,l=(s+n)*t.tiers.length*2*2*L.length,i=X(t),a=S(e).map(h=>[h.key,e.label(h.key)]),d=C(e.mode);return`<section class="intro">
      <h1>How it works</h1>
      <p><strong>EK Colors</strong> solves color palettes instead of picking them by eye. A small program builds a palette from a handful of rules, so every color can be explained, and solved again when a rule changes. It starts from <strong>EK Palette</strong>, the palette it was made for; change the settings and it solves a palette of its own. This page walks through the rules one at a time; every demo runs the same code as the solver.</p>
      <p class="soft">This is the plain-words version. For every formula, constant and search rule, see <a href="#algorithm">the algorithm</a>; for the research and software it's built on, see <a href="#references">References</a>.</p>
    </section>

    <section class="step">
      <h2>What it makes</h2>
      <p>${String(s)} hues${n?` and ${String(n)} custom ${n===1?"color":"colors"}`:""}, each on ${String(t.tiers.length)} contrast tiers, in a default and a muted version, for light and dark, for three kinds of screen: ${String(l)} colors in all, with Gray on every tier${t.neutralColors.length?` and ${String(t.neutralColors.length)} neutral ${t.neutralColors.length===1?"color":"colors"}`:""} beside them. They all follow the same rules, so the rules only have to be learned once.</p>
    </section>

    <section class="step">
      <h2>Color depends on the room</h2>
      <p>The same red looks stronger in a bright room than in a dim one, and different on a light page than on a dark one. To compare colors fairly, the solver uses <strong>CAM16</strong>, a model of human color vision. It's told what the eye is looking at and where: the page's base color as the background, and the room's light. The light mode's base is always lighter than the dark mode's.</p>
      <p>Light mode is seen at ${String(t.rooms.light.lux)} lux, ${ae[t.rooms.light.surround]??"a room"}. Dark mode is seen at ${String(t.rooms.dark.lux)} lux, ${ae[t.rooms.dark.surround]??"a room"}. ${t.rooms.light.lux===200&&t.rooms.dark.lux===64?"Both come from the sRGB standard: its typical room and its reference room.":"By default they're 200 and 64 lux, the sRGB standard's typical and reference rooms."} CAM16 then gives three numbers people can feel: <em>lightness</em> (J), <em>colorfulness</em> (M) and <em>hue</em>.</p>
      <div class="demo"><div class="demo-out wide">${pe(e)}</div></div>
      <p>So the same target needs different screen colors in each mode. Both of these aim at the same colorfulness.</p>
      <div class="demo"><div class="demo-out wide">${$e(e)}</div></div>
    </section>

    <section class="step">
      <h2>Contrast decides lightness</h2>
      <p>Every color has a job, and the job decides how much it must stand out from the background. The solver measures that with <strong>APCA</strong>, a contrast method proposed for the next version of the web's accessibility guidelines. APCA reads light-on-dark and dark-on-light differently, the way eyes do. Its unit is Lc.</p>
      <div class="scroll"><table class="roles"><tbody>${t.tiers.map(h=>`<tr><th scope="row" class="mono">Lc ${String(h)}</th><td>${Q[h]??""}</td></tr>`).join("")}</tbody></table></div>
      <p>For each hue and tier, the solver searches lightness until the color sits exactly on the tier: never below it, and only as far above as rounding forces. The older WCAG 2 contrast is reported beside every color too, because laws still point to it. Its badge says what that ratio allows: AAA and AA pass for text, AA large only for large text and for icons, borders and controls, and below 3:1 for nothing that must be read. Each badge opens its level.</p>
      <p>One tier stands for each hue: the <strong>identity tier</strong>. It's where the colors look most like themselves: clear enough to read, neither faint nor heavy. The solver picks it as the tier where APCA and WCAG 2, taken together, come closest to their minimum for text: ${fe(t)}.${P.filter(h=>t.identityTier[h]!=="auto").map(h=>` Here, ${h} mode's is set by hand to Lc ${String(F(t,h))}.`).join("")} Any tier can be made the identity on the Tiers page, or in Settings.</p>
      <div class="demo">
        <div class="demo-controls">
          ${G(e,"demo-hue","Hue",[0,359,1],"tier")}
          ${G(e,"demo-lc","Contrast",[15,90,1],"tier")}
        </div>
        <div id="demo-tier-out" class="demo-out">${he(e)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Equally colorful</h2>
      <p>Every hue aims at the same colorfulness: M ${String(t.colorfulness)}, apart from what colorfulness per hue (below) adds or takes away. The screen doesn't always allow it. Near white, a screen can show a strong yellow but only a pale red; near black, the opposite. With <strong>Equal per tier</strong> on, each tier's target drops to what its least colorful hue can reach, and every color on the tier follows, so nothing stands out by accident. Switched off in Settings, each color goes as far as the screen allows instead, and a tier is no longer equally colorful.</p>
      <p>The chart shows how far each hue could go on one tier, on each kind of screen.</p>
      <div class="demo">
        <div class="demo-controls">
          ${D(e,"demo-tier","Tier",oe(e),"reach")}
        </div>
        <div id="demo-reach-out" class="demo-out wide">${ce(e)}</div>
      </div>
      <p>Small marks say what happened to a color. <strong>Sets the tier</strong>, an amber flag, marks the color whose reach the tier was lowered to. <strong>Lowered</strong>, a gray \u2193, marks a color held below its own aim because of it. <strong>Gamut limit</strong>, a red !, marks a color the screen can't make as colorful as it should be at all. Tables show them in small chips beside the M value; on cards the flag sits beside the name, and a Lowered or Gamut limit color shows its M value in gray or red with its mark. A key under the colors says which is which, and each mark opens why, with the numbers.</p>
    </section>

    <section class="step">
      <h2>Colorfulness per hue (M)</h2>
      <p>The model isn't perfect: some parts of the circle can look weaker or stronger to the eye than CAM16 says. <strong>Colorfulness per hue</strong> adds or takes away colorfulness smoothly over the circle, as a few points that each ease to nothing on either side, so neighbors never jump. Light and dark each have their own curve.</p>
      <div class="demo">
        <div class="demo-controls">
          ${G(e,"demo-amount","Amount",[-12,12,1],"bump")}
          ${G(e,"demo-center","Center",[0,359,1],"bump")}
          ${G(e,"demo-width","Width",[20,180,5],"bump")}
        </div>
        <div id="demo-bump-out" class="demo-out wide">${ue(e)}</div>
      </div>
      <p>The <strong>blind colorfulness test</strong> in Settings measures where it's needed. It shows two colors at a time, without names, and asks which looks more colorful, nudging the color it's testing after each answer, apart from the occasional easy check, until it finds where each hue looks as colorful as the others. Its result can be applied as the curve.</p>
    </section>

    <section class="step">
      <h2>Evenly different</h2>
      <p>Two neighboring colors should be as easy to tell apart as any other two. CAM16 has a uniform space, CAM16-UCS, where distance matches how different colors look. The hues start evenly apart in angle, ${String(s)} hues ${(360/s).toFixed(s===8?0:1)}\xB0 apart. Angles aren't how differences are seen, though, so the solver nudges each one, a few degrees at a time, until the differences around the circle are as even as they can be. That's the <strong>uniform lineup</strong>.</p>
      <p>Evening out the differences doesn't say where the lineup sits, since turning all of it around the circle keeps them almost the same. So one hue, ${e.label(Z(t.hues)[0]).toLowerCase()}, is the <strong>anchor</strong>, and every other hue is spaced from it. It sits at ${I(t).toFixed(0)}\xB0 here, ${i}. It can be the yellow of CAM16, Munsell, NCS, unique-hue studies or the World Color Survey's focal colors, or any hue; the same systems can be drawn as guides on the hue graphs, to see where each puts its hues.</p>
      <div class="demo">
        <div class="demo-controls">
          ${D(e,"demo-a","First color",a,"difference")}
          ${D(e,"demo-b","Second color",a,"difference")}
          ${D(e,"demo-dtier","Tier",oe(e),"difference")}
        </div>
        <div id="demo-difference-out" class="demo-out wide">${me(e)}</div>
      </div>
      <p>Around the circle on the tier that stands for each hue:</p>
      <div class="demo"><div class="demo-out wide">${ye(e)}</div></div>
    </section>

    <section class="step">
      <h2>Placing hues (H)</h2>
      <p>A name fits some hues better than others: an even red can lean pink, an even blue can lean cyan. So any color can be <strong>placed</strong> by hand where its name fits best, by dragging it on the hue graph in Settings, and the others re-space evenly around it. Colors keep their order around the circle: a placed color stays between its neighbors, at least a quarter of the even step from each.</p>
      <div class="demo"><div class="demo-out wide">${be(e)}</div></div>
      <p>The <strong>blind hue test</strong> in Settings measures where each name fits. It shows one color at a time, without its name, and asks whether it leans toward the color before it or the one after it; the hue where it leans neither way is the middle of its name, and a color can be placed there.</p>
    </section>

    <section class="step">
      <h2>Reading changes</h2>
      <p>Placed hues and colorfulness per hue are edits on top of the uniform lineup. The <strong>H</strong> and <strong>M</strong> switches in the header turn them off and on across the pages, so the palette can be seen with and without them.</p>
      <p>At the top of Settings, a strip shows the palette a step at a time. <strong>Uniform</strong> is the evenly spaced lineup. <strong>Turned</strong> is the same lineup turned around the circle to best match the placed hues; turning keeps it uniform. <strong>+H</strong> adds the placed hues, and <strong>+M</strong> colorfulness per hue. How far the edits take the palette from the turned lineup is its <strong>bend</strong>, in gaps: one gap is the even difference between neighbors${d?`, ${d.toFixed(1)} \u0394E in ${e.mode} mode here`:""}, \u0394E being how different two colors look in CAM16-UCS. Here's the strip for this palette; point at a swatch or a row for its numbers, and click a number for what it means.</p>
      <div class="demo"><div id="palette-strip" class="strip"></div></div>
      ${se(C(e.mode))}
      <p>Bending colors is what placing is for, so bend isn't the risk in itself. Evenness is: when two neighbors end up closer than the even gap, they're easier to confuse. Under ${String(j(C(e.mode))[0])}% closer is fine, ${String(j(C(e.mode))[0])} to ${String(j(C(e.mode))[1])}% is worth watching, and over ${String(j(C(e.mode))[1])}% they're getting confusable, for this palette's gap of ${C(e.mode).toFixed(1)} \u0394E. A change is also split into what it's made of, hue, colorfulness and lightness, as shares that add up to the whole.</p>
    </section>

    <section class="step">
      <h2>Muted and custom colors</h2>
      <p>Muted colors are the same hue on the same tier, at ${String(Math.round(t.mutedShare*100))}% of the default's colorfulness: quieter, never weaker in contrast. Every tier of one color:</p>
      <div class="demo">
        <div class="demo-controls">
          ${D(e,"demo-color","Color",(e.palette?.[e.mode].colors??[]).map(h=>[h.key,e.label(h.key)]),"ladder")}
        </div>
        <div id="demo-ladder-out" class="demo-out wide">${ge(e)}</div>
      </div>
      <p><strong>Custom colors</strong> sit beside the hues${n?`, like ${t.customColors.map(h=>te(h.name)).join(" and ")} here`:""}. Each has a name, its own hue and a share of the colorfulness: on every tier it's the most colorful color of that hue, up to its share of the tier's target, exactly on the tier's contrast, with a muted version too. Custom colors aren't spaced with the hues and aren't measured by the blind tests; on the hue circle they're drawn as diamonds. Settings adds as many as needed, under Extra colors.</p>
    </section>

    <section class="step">
      <h2>Neutrals</h2>
      <p>Every palette has <strong>Gray</strong> on every tier: no hue at all, red, green and blue the same, exactly on the tier's contrast against the base, as every color is.</p>
      <p>A <strong>neutral color</strong> takes the base's hue at a share of the base's own colorfulness, so it belongs with a base of that hue. On warm paper, text in a warm neutral sits on the page instead of looking cold on it. A color's colorfulness puts it in a zone: under M ${String(A[0])} it reads as gray, from M ${String(A[0])} to ${String(A[1])} it shows the hue yet reads as a neutral, and past that it reads as a color. The limits come from color difference, measured on four test bases: M ${String(A[0])} is just past a visible step from Gray side by side, and M ${String(A[1])} a little past a different shade of it. A color's page gives its own distance from Gray. In Settings, a bar under every colorfulness slider shows the zones, and its readout explains them.</p>
      <p>A palette can have several neutral colors, each with its own share, added in Settings under Extra colors. Each mode follows its own base. A base under M ${String(A[0])}, gray or nearly, has no hue to give, so in that mode its neutral colors are Gray; when both bases are gray, there are none to add. Gray and each neutral color have pages of their own beside the colors'.</p>
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
    </section>`}export{Ae as howPage,xe as updateDemo};
