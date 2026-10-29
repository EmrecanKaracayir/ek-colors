import{p as F}from"./chunk-JV7IE6OR.js";import"./chunk-X2Y5TGFK.js";import"./chunk-GYMDR32X.js";import{D as I,E as C,G as Z,H as ee,a as N,b as L,c as V,d as E,f as Q,s as x,t as Y,v as A}from"./chunk-7JYMHWRG.js";import{j,l as te,n as W,t as se}from"./chunk-C34FQDYE.js";import{A as O,B as X,g as H,j as U,s as R,t as _,u as J,v as K,w as z}from"./chunk-35RC7DVO.js";var ie=new Map,B={"demo-hue":()=>25,"demo-lc":()=>60,"demo-tier":e=>e.settings.tiers.at(-1)??60,"demo-a":e=>k(e)[0]?.key??"","demo-b":e=>k(e)[1]?.key??"","demo-dtier":e=>C(e.settings,e.mode),"demo-amount":e=>Math.max(-12,Math.min(12,e.settings.colorfulnessPerHue[e.mode][0]?.amount??6)),"demo-center":e=>e.settings.colorfulnessPerHue[e.mode][0]?.center??20,"demo-width":e=>Math.max(20,Math.min(180,e.settings.colorfulnessPerHue[e.mode][0]?.width??60)),"demo-color":e=>e.palette?.[e.mode].colors[0]?.key??""};function S(e,t){return ie.get(t)??String(B[t]?.(e)??"")}function le(e,t){let s=Number(S(e,t));return e.settings.tiers.includes(s)?s:Number(B[t](e))}function G(e,t,s,[n,i,r],a){return`<label for="${t}">${s} <input id="${t}" type="range" min="${String(n)}" max="${String(i)}" step="${String(r)}" value="${S(e,t)}" data-demo="${a}"></label>`}function P(e,t,s,n,i){let r=S(e,t),a=n.some(([l])=>l===r)?r:String(B[t]?.(e)??"");return`<label for="${t}">${s} <select id="${t}" data-demo="${i}">${n.map(([l,h])=>`<option value="${l}" ${l===a?"selected":""}>${h}</option>`).join("")}</select></label>`}var oe=e=>e.settings.tiers.map(t=>[String(t),`Lc ${String(t)}`]),ne=new Map;function T(e,t){let s=JSON.stringify([e.bases,e.rooms,t]),n=ne.get(s);return n||ne.set(s,n=U(e,t)),n}function k(e){let t=C(e.settings,e.mode);return(e.palette?.[e.mode].colors??[]).filter(s=>s.kind==="hue").map(s=>({key:s.key,hue:s.tiers[t].default.hue,color:s.tiers[t].default.color}))}function ue(e){let t=k(e)[0];if(!t)return"Solving\u2026";let s=e.settings.rooms[e.mode].surround,n=o=>{let g={lux:o,surround:s};return T({bases:e.settings.bases,rooms:{light:g,dark:g}},e.gamut).cam(e.mode,t.color).m},[i,r,a,l]=[44,540,12,180],[h,d]=[0,4],p=o=>i+(Math.log10(o)-h)/(d-h)*r,c=Array.from({length:41},(o,g)=>10**(h+g/40*(d-h))),$=c.map(n),[f,u]=[Math.floor(Math.min(...$)/10)*10,Math.ceil(Math.max(...$)/10)*10],y=o=>a+l-(o-f)/(u-f)*l,v=c.map((o,g)=>`${g?"L":"M"}${p(o).toFixed(1)} ${y($[g]).toFixed(1)}`).join(" "),M=Array.from({length:(u-f)/10+1},(o,g)=>f+g*10).map(o=>`<line x1="${String(i)}" x2="${String(i+r)}" y1="${y(o).toFixed(1)}" y2="${y(o).toFixed(1)}" class="grid"></line>
      <text x="${String(i-8)}" y="${(y(o)+4).toFixed(1)}" class="axis" text-anchor="end">${String(o)}</text>`),w=[[1,"Dark room"],[10,"10 lux"],[100,"100"],[1e3,"Office 1 000"],[1e4,"Daylight"]],m=["dark","light"].map(o=>{let g=e.settings.rooms[o].lux,D=n(g);return`<line x1="${p(g).toFixed(1)}" x2="${p(g).toFixed(1)}" y1="${String(a)}" y2="${String(a+l)}" class="target"></line>
      <circle cx="${p(g).toFixed(1)}" cy="${y(D).toFixed(1)}" r="6" style="fill:${t.color}" class="${o===e.mode?"":"other"}"></circle>
      <text x="${(p(g)+8).toFixed(1)}" y="${String(a+(o==="dark"?12:30))}" class="axis label">${o==="dark"?"Dark mode":"Light mode"} \u2022 ${String(g)} lux</text>`}),b=["dark","light"].map(o=>`M ${n(e.settings.rooms[o].lux).toFixed(0)} in ${o} mode's ${String(e.settings.rooms[o].lux)} lux`).join(", ");return`<svg class="chart" viewBox="0 0 ${String(i+r+20)} ${String(a+l+30)}" role="img" aria-label="How colorful ${e.label(t.key).toLowerCase()} looks as the room gets brighter: ${b}" aria-describedby="room-note">
      ${M.join("")}
      ${w.map(([o,g])=>`<text x="${p(o).toFixed(1)}" y="${String(a+l+20)}" class="axis" text-anchor="${o===1?"start":o===1e4?"end":"middle"}">${g}</text>`).join("")}
      <path d="${v}" fill="none" style="stroke:${t.color}" stroke-width="3" stroke-linecap="round"></path>
      ${m.join("")}
    </svg>
    <p class="soft" id="room-note">How colorful the palette's ${e.label(t.key).toLowerCase()} looks (M), from a dark room to daylight. The screen color never changes.</p>`}function pe(e){let t=k(e)[0];if(!t)return"Solving\u2026";let s=C(e.settings,"light"),n=T(e.settings,e.gamut),i=h=>{try{return n.cam(h,x(n,e.settings.bases[h],h,t.hue,200,s)).m}catch{return 0}},r=Math.floor(Math.min(30,i("light"),i("dark"))),a;try{a={light:x(n,e.settings.bases.light,"light",t.hue,r,s),dark:x(n,e.settings.bases.dark,"dark",t.hue,r,s)}}catch{return`<p class="soft">No color at this hue reaches Lc ${String(s)} on both bases.</p>`}return`<div class="demo-pair">${N.map(h=>{let d=a[h],p=n.cam(h,d);return`<figure class="on-base" style="--base:${e.settings.bases[h]};--c:${d};--ink:var(--fg-${h})">
      <span class="demo-swatch"></span><span class="on-base-sample">Aa</span>
      <figcaption><strong>${V[h]} mode</strong><span>Looks M ${p.m.toFixed(0)} \u2022 chroma C ${p.chroma.toFixed(0)}</span></figcaption>
    </figure>`}).join("")}</div><p class="soft">${e.label(t.key)}'s hue at M ${String(r)} on Lc ${String(s)}, in each mode's room.</p>`}function de(e){let t=Number(S(e,"demo-hue")),s=Number(S(e,"demo-lc")),n=e.settings.bases[e.mode],i;try{i=x(T(e.settings,e.gamut),n,e.mode,t,e.settings.colorfulness,s)}catch{return`<p class="soft">No color at this hue reaches Lc ${String(s)} on this base.</p>`}let r=T(e.settings,e.gamut).cam(e.mode,i),a=J(i,n);return`<span class="demo-swatch" style="--c:${i}"></span>
    <span class="demo-sample" style="color:${i}">Aa Palette</span>
    <dl class="demo-numbers">
      <div><dt>APCA</dt><dd class="mono">Lc ${_(i,n).toFixed(1)}</dd></div>
      <div><dt>WCAG 2</dt><dd class="mono">${a.toFixed(2)} \u2022 ${K(a)}</dd></div>
      <div><dt>Lightness J</dt><dd class="mono">${r.j.toFixed(1)}</dd></div>
      <div><dt>Colorfulness M</dt><dd class="mono">${r.m.toFixed(1)}</dd></div>
      <div><dt>Hue</dt><dd class="mono">${r.hue.toFixed(0)}\xB0 \u2022 ${z(r.hue)}</dd></div>
    </dl>`}function ae(e,t){return t==="standard"?`color-mix(in oklch, ${e} 45%, var(--soft))`:t==="ultra"?`oklch(from ${e} l calc(c * 1.6) h)`:e}function he(e){let t=k(e);if(!t.length)return"Solving\u2026";let s=le(e,"demo-tier"),n=e.settings.bases[e.mode],i=t.map(m=>({...m,reach:L.map(b=>{let o=T(e.settings,b);try{return o.cam(e.mode,x(o,n,e.mode,m.hue,200,s)).m}catch{return 0}})})),r=L.indexOf(e.gamut),a=e.settings.colorfulness,l=i.reduce((m,b)=>b.reach[r]<m.reach[r]?b:m),h=e.settings.equalTiers&&l.reach[r]<a,d=h?l.reach[r]:a,p=Math.ceil(Math.max(a,...i.flatMap(m=>m.reach))/20)*20,[c,$,f]=[96,504,34],u=m=>c+Math.min(m,p)/p*$,y=i.length*f+40,v=Array.from({length:p/20+1},(m,b)=>b*20).map(m=>`<line x1="${String(u(m))}" x2="${String(u(m))}" y1="0" y2="${String(y-24)}" class="grid"></line>
      <text x="${String(u(m))}" y="${String(y-8)}" class="axis" text-anchor="middle">${String(m)}</text>`),M=i.map((m,b)=>{let o=b*f+6,g=h&&m===l;return`<g class="${g?"limiter":h?"follower":""}">
      <text x="0" y="${String(o+15)}" class="axis label">${e.label(m.key)}${h&&!g?" \u2193":""}</text>
      ${m.reach.map((D,q)=>`<rect x="${String(c)}" y="${String(o+q*8)}" width="${(u(D)-c).toFixed(1)}" height="6" rx="3" fill="${m.color}" style="fill:${ae(m.color,L[q])}"></rect>`).join("")}</g>`}),w=m=>`<span><i class="bar-key" style="background:${ae(l.color,m)}"></i>${E[m]}</span>`;return`<svg class="chart" viewBox="0 0 ${String(c+$+20)} ${String(y)}" role="img" aria-label="How colorful each hue can be on Lc ${String(s)} in ${e.mode} mode, on Standard, Wide and Ultra" aria-describedby="reach-note">
      ${v.join("")}${M.join("")}
      <line x1="${String(u(a))}" x2="${String(u(a))}" y1="0" y2="${String(y-24)}" class="target"></line>
      <line x1="${u(d).toFixed(1)}" x2="${u(d).toFixed(1)}" y1="0" y2="${String(y-24)}" class="ceiling"></line>
    </svg>
    <p class="demo-verdict" id="reach-note">${h?`On ${E[e.gamut]}, <strong>${e.label(l.key)}</strong> can only reach M ${d.toFixed(1)} on Lc ${String(s)}, so every color on this tier stops there.`:l.reach[r]<a?`On ${E[e.gamut]}, <strong>${e.label(l.key)}</strong> can only reach M ${l.reach[r].toFixed(1)} on Lc ${String(s)}; with Equal per tier off, each color goes as far as it can.`:`On ${E[e.gamut]}, every hue reaches the target on Lc ${String(s)}.`}</p>
    <p class="legend-row soft">${L.map(w).join("")}
      <span><i class="line-key target"></i>Target M ${String(a)}</span><span><i class="line-key ceiling"></i>This tier on ${E[e.gamut]}</span>${h?"<span>\u2193 Lowered</span>":""}</p>`}function ce(e){let t=(e.palette?.[e.mode].colors??[]).filter(w=>w.kind==="hue");if(t.length<2)return"Solving\u2026";let s=le(e,"demo-dtier"),n=(w,m)=>t.find(b=>b.key===S(e,w))??t[m],[i,r]=[n("demo-a",0),n("demo-b",1)],[a,l]=[i.tiers[s].default.color,r.tiers[s].default.color],h=T(e.settings,e.gamut),[d,p]=[h.cam(e.mode,a),h.cam(e.mode,l)],c=d.distance(p),$=R(d,p),f=w=>`${String(Math.round(w*100))}%`,u=e.palette?.[e.mode].ring[s]??[],y=u.length?u.reduce((w,m)=>w+m,0)/u.length:0,v=Math.max(30,Math.ceil(c/10)*10),M=w=>`${(Math.min(w,v)/v*100).toFixed(1)}%`;return`<div class="demo-touch"><span style="--c:${a}"></span><span style="--c:${l}"></span></div>
    <p class="demo-sample"><span style="color:${a}">${e.label(i.key)}</span> <span style="color:${l}">${e.label(r.key)}</span></p>
    <dl class="demo-numbers">
      <div><dt>Difference</dt><dd class="mono">${c.toFixed(1)}</dd></div>
      <div><dt>From lightness</dt><dd class="mono">${f($.lightness)}</dd></div>
      <div><dt>From colorfulness</dt><dd class="mono">${f($.colorfulness)}</dd></div>
      <div><dt>From hue</dt><dd class="mono">${f($.hue)}</dd></div>
    </dl>
    <div class="scale">
      <span class="scale-fill" style="width:${M(c)}"></span>
      <span class="scale-mark" style="left:${M(H)}"><span>Just visible</span></span>
      ${y?`<span class="scale-mark" style="left:${M(y)}"><span>Neighbors on this tier</span></span>`:""}
    </div>
    <p class="soft">CAM16-UCS distance, and the share of it each part makes up. About ${String(H)} is the smallest difference most people see with two colors side by side. On a tier, every color solves to sit about the same distance from its neighbors, which is why the circle below stays even.</p>`}function fe(e){let t=k(e),s=e.palette?.[e.mode].ring[C(e.settings,e.mode)]??[];if(!s.length)return"Solving\u2026";let n=Math.max(...s);return s.map((i,r)=>`<div class="bar-row"><span class="soft">${e.label(t[r].key)} \u2192 ${e.label(t[(r+1)%t.length].key)}</span>
        <span class="bar"><span style="width:${(i/n*100).toFixed(1)}%"></span></span><span class="mono">${i.toFixed(1)}</span></div>`).join("")}function me(e){let t=k(e),s=C(e.settings,e.mode),n=e.palette?.[e.mode].targets[s];if(!t.length||n===void 0)return"Solving\u2026";let i={amount:Number(S(e,"demo-amount")),center:Number(S(e,"demo-center")),width:Number(S(e,"demo-width"))},r=o=>Y({colorfulnessPerHue:{light:[i],dark:[i]}},e.mode,o),[a,l,h,d,p]=[36,564,10,120,12],c=o=>a+o/360*l,$=o=>h+d/2-Math.max(-p,Math.min(p,o))/p*(d/2),f=Array.from({length:181},(o,g)=>`${g?"L":"M"}${c(g*2).toFixed(1)} ${$(r(g*2)).toFixed(1)}`).join(" "),u=[-12,-6,0,6,12].map(o=>`<line x1="${String(a)}" x2="${String(a+l)}" y1="${$(o).toFixed(1)}" y2="${$(o).toFixed(1)}" class="${o===0?"target":"grid"}"></line>
      <text x="${String(a-6)}" y="${($(o)+4).toFixed(1)}" class="axis" text-anchor="end">${W(o)}</text>`),y=[0,90,180,270,360].map(o=>`<text x="${c(o).toFixed(1)}" y="${String(h+d+16)}" class="axis" text-anchor="middle">${String(o)}\xB0</text>`),v=t.map(o=>`<circle cx="${c(o.hue).toFixed(1)}" cy="${$(r(o.hue)).toFixed(1)}" r="6" style="fill:${o.color}" class="mark"></circle>`),M=T(e.settings,e.gamut),w=e.settings.bases[e.mode],m=(o,g)=>{try{return x(M,w,e.mode,o,g,s)}catch{return"transparent"}},b=o=>`<div class="demo-touch short">${t.map(g=>`<span style="--c:${m(g.hue,o(g.hue))}"></span>`).join("")}</div>`;return`<svg class="chart" viewBox="0 0 ${String(a+l+12)} ${String(h+d+24)}" role="img" aria-label="Colorfulness added over hue: ${W(i.amount)} at ${String(i.center)}\xB0, easing to none ${String(i.width)}\xB0 away" aria-describedby="bump-note">
      ${u.join("")}${y.join("")}<path d="${f}" fill="none" class="curve-line"></path>${v.join("")}
    </svg>
    <div class="swatch-rows"><span class="soft">Without</span>${b(()=>n)}<span class="soft">With</span>${b(o=>n+r(o))}</div>
    <p class="soft" id="bump-note">Lc ${String(s)}, aiming at M ${n.toFixed(1)}. The colors move only where the bump reaches; this is a sandbox and changes nothing in the palette.</p>`}function $e(e){let t=e.settings,s=k(e);if(!s.length)return"Solving\u2026";let{keys:n}=ee(t),i=O(t),[r,a]=[12,576],l=c=>r+(c%360+360)%360/360*a,d=n.flatMap((c,$)=>{let f=s.find(v=>v.key===c);if(!f)return[];let u=i+$*360/n.length,y=$>0&&t.placed[c]!==void 0;return[{key:c,color:f.color,even:u,landed:f.hue,placed:y,anchor:$===0}]}).map((c,$)=>{let[f,u]=[l(c.even),l(c.landed)],y=Math.abs(u-f)>a/2?u<f?u+a:u-a:u;return`<line x1="${f.toFixed(1)}" y1="34" x2="${y.toFixed(1)}" y2="76" class="grid"></line>
        <line x1="${f.toFixed(1)}" x2="${f.toFixed(1)}" y1="26" y2="40" class="tick"></line>
        <circle cx="${u.toFixed(1)}" cy="80" r="7" style="fill:${c.color}" class="${c.placed||c.anchor?"pinned":"mark"}"></circle>
        <text x="${u.toFixed(1)}" y="${String($%2?116:102)}" class="axis" text-anchor="middle">${e.label(c.key)}${c.anchor?" \u2022 anchor":""}</text>`}).join("");return`<svg class="chart" viewBox="0 0 600 124" role="img" aria-label="Even starting hues and where each color sits" aria-describedby="starts-key">
      ${[0,90,180,270,360].map(c=>`<text x="${l(c===360?359.99:c).toFixed(1)}" y="16" class="axis" text-anchor="middle">${String(c)}\xB0</text>`).join("")}<line x1="${String(r)}" x2="${String(r+a)}" y1="33" y2="33" class="grid"></line>${d}
    </svg>
    <p class="legend-row soft" id="starts-key"><span><i class="tick-key"></i>Even start from the anchor</span><span><i class="dot-key"></i>Where it sits</span><span><i class="dot-key pinned"></i>Placed by hand, or the anchor</span></p>`}function ge(e){let t=e.palette?.[e.mode].colors??[];if(!t.length)return"Solving\u2026";let s=t.find(r=>r.key===S(e,"demo-color"))??t[0],n=e.settings.tiers,i=r=>n.map(a=>{let l=s.tiers[a][r];return l?`<span class="ladder-cell"><span class="ladder-swatch" style="--c:${l.color}"></span><span class="mono">Lc ${String(a)}</span><span class="mono soft">M ${l.colorfulness.toFixed(1)}</span></span>`:"<span></span>"}).join("");return`<div class="ladder" style="--n:${String(n.length)}"><span class="soft">Default</span>${i("default")}<span class="soft">Muted</span>${i("muted")}</div>`}var re={tier:de,reach:he,difference:ce,bump:me,ladder:ge};function Me(e,t){ie.set(t.id,t.value);let s=t.dataset.demo,n=document.querySelector(`#demo-${s}-out`);n&&s in re&&(n.innerHTML=re[s](e))}function Ce(e){let t=e.settings,s=k(e).length,n=t.customColors.length,i=(s+n)*t.tiers.length*2*2*L.length,r=X(t),a=k(e).map(d=>[d.key,e.label(d.key)]),l=e.palette?.[e.mode].ring[C(t,e.mode)]??[],h=l.length?l.reduce((d,p)=>d+p,0)/l.length:0;return`<section class="intro">
      <h1>How it works</h1>
      <p><strong>EK Colors</strong> solves color palettes instead of picking them by eye. A small program builds a palette from a handful of rules, so every color can be explained, and solved again when a rule changes. It starts from <strong>EK Palette</strong>, the palette it was made for; change the settings and it solves a palette of its own. This page walks through the rules one at a time; every demo runs the same code as the solver.</p>
      <p class="soft">This is the plain-words version. For every formula, constant and search rule, see <a href="#algorithm">the algorithm</a>; for the research and software it's built on, see <a href="#references">References</a>.</p>
    </section>

    <section class="step">
      <h2>What it makes</h2>
      <p>${String(s)} hues${n?` and ${String(n)} custom ${n===1?"color":"colors"}`:""}, each on ${String(t.tiers.length)} contrast tiers, in a default and a muted version, for light and dark, for three kinds of screen: ${String(i)} colors in all, with Gray on every tier${t.neutralColors.length?` and ${String(t.neutralColors.length)} neutral ${t.neutralColors.length===1?"color":"colors"}`:""} beside them. They all follow the same rules, so the rules only have to be learned once.</p>
    </section>

    <section class="step">
      <h2>Color depends on the room</h2>
      <p>The same red looks stronger in a bright room than in a dim one, and different on a light page than on a dark one. To compare colors fairly, the solver uses <strong>CAM16</strong>, a model of human color vision. It's told what the eye is looking at and where: the page's base color as the background, and the room's light. The light mode's base is always lighter than the dark mode's.</p>
      <p>Light mode is seen at ${String(t.rooms.light.lux)} lux, a normal lit room. Dark mode is seen at ${String(t.rooms.dark.lux)} lux, a dim room. ${t.rooms.light.lux===200&&t.rooms.dark.lux===64?"Both come from the sRGB standard: its typical room and its reference room.":"By default they're 200 and 64 lux, the sRGB standard's typical and reference rooms."} CAM16 then gives three numbers people can feel: <em>lightness</em> (J), <em>colorfulness</em> (M) and <em>hue</em>.</p>
      <div class="demo"><div class="demo-out wide">${ue(e)}</div></div>
      <p>So the same target needs different screen colors in each mode. Both of these aim at the same colorfulness. The dark-mode one gets more color on the screen, because a dim room makes colors look quieter.</p>
      <div class="demo"><div class="demo-out wide">${pe(e)}</div></div>
    </section>

    <section class="step">
      <h2>Contrast decides lightness</h2>
      <p>Every color has a job, and the job decides how much it must stand out from the background. The solver measures that with <strong>APCA</strong>, a contrast method proposed for the next version of the web's accessibility guidelines. APCA reads light-on-dark and dark-on-light differently, the way eyes do. Its unit is Lc.</p>
      <div class="scroll"><table class="roles"><tbody>${t.tiers.map(d=>`<tr><th scope="row" class="mono">Lc ${String(d)}</th><td>${Q[d]??""}</td></tr>`).join("")}</tbody></table></div>
      <p>For each hue and tier, the solver searches lightness until the color sits exactly on the tier: never below it, and only as far above as rounding forces. The older WCAG 2 contrast is reported beside every color too, because laws still point to it. Its badge says what that ratio allows: AAA and AA pass for text, AA large only for large text and for icons, borders and controls, and below 3:1 for nothing that must be read. Each badge opens its level.</p>
      <p>One tier stands for each hue: the <strong>identity tier</strong>. It's where the colors look most like themselves: clear enough to read, neither faint nor heavy. The solver picks it as the tier where APCA and WCAG 2, taken together, are just at their minimum for text: Lc ${String(I(t.bases.light,t.tiers))} on the light base and Lc ${String(I(t.bases.dark,t.tiers))} on the dark one, since WCAG 2 rates colors on a dark base as more contrasty than APCA does.${N.filter(d=>t.identityTier[d]!=="auto").map(d=>` Here, ${d} mode's is set by hand to Lc ${String(C(t,d))}.`).join("")} Any tier can be made the identity on the Tiers page, or in Settings.</p>
      <div class="demo">
        <div class="demo-controls">
          ${G(e,"demo-hue","Hue",[0,359,1],"tier")}
          ${G(e,"demo-lc","Contrast",[15,90,1],"tier")}
        </div>
        <div id="demo-tier-out" class="demo-out">${de(e)}</div>
      </div>
    </section>

    <section class="step">
      <h2>Equally colorful</h2>
      <p>Every hue aims at the same colorfulness: M ${String(t.colorfulness)}, apart from what colorfulness per hue (below) adds or takes away. The screen doesn't always allow it. Near white, a screen can show a strong yellow but only a pale red; near black, the opposite. With <strong>Equal per tier</strong> on, each tier's target drops to what its least colorful hue can reach, and every color on the tier follows, so nothing stands out by accident. Switched off in Settings, each color goes as far as the screen allows instead, and a tier is no longer equally colorful.</p>
      <p>The chart shows how far each hue could go on one tier, on each kind of screen.</p>
      <div class="demo">
        <div class="demo-controls">
          ${P(e,"demo-tier","Tier",oe(e),"reach")}
        </div>
        <div id="demo-reach-out" class="demo-out wide">${he(e)}</div>
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
        <div id="demo-bump-out" class="demo-out wide">${me(e)}</div>
      </div>
      <p>The <strong>blind colorfulness test</strong> in Settings measures where it's needed. It shows two colors at a time, without names, and asks which looks more colorful, nudging the color it's testing after each answer, apart from the occasional easy check, until it finds where each hue looks as colorful as the others. Its result can be applied as the curve.</p>
    </section>

    <section class="step">
      <h2>Evenly different</h2>
      <p>Two neighboring colors should be as easy to tell apart as any other two. CAM16 has a uniform space, CAM16-UCS, where distance matches how different colors look. The hues start evenly apart in angle, ${String(s)} hues ${(360/s).toFixed(s===8?0:1)}\xB0 apart. Angles aren't how differences are seen, though, so the solver nudges each one, a few degrees at a time, until the differences around the circle are as even as they can be. That's the <strong>uniform lineup</strong>.</p>
      <p>Evening out the differences doesn't say where the lineup sits, since turning all of it around the circle keeps them almost the same. So one hue, ${e.label(Z(t.hues)[0]).toLowerCase()}, is the <strong>anchor</strong>, and every other hue is spaced from it. It sits at ${O(t).toFixed(0)}\xB0 here, ${r}. It can be the yellow of CAM16, Munsell, NCS, unique-hue studies or the World Color Survey's focal colors, or any hue; the same systems can be drawn as guides on the hue graphs, to see where each puts its hues.</p>
      <div class="demo">
        <div class="demo-controls">
          ${P(e,"demo-a","First color",a,"difference")}
          ${P(e,"demo-b","Second color",a,"difference")}
          ${P(e,"demo-dtier","Tier",oe(e),"difference")}
        </div>
        <div id="demo-difference-out" class="demo-out wide">${ce(e)}</div>
      </div>
      <p>Around the circle on the tier that stands for each hue:</p>
      <div class="demo"><div class="demo-out wide">${fe(e)}</div></div>
    </section>

    <section class="step">
      <h2>Placing hues (H)</h2>
      <p>A name fits some hues better than others: an even red can lean pink, an even blue can lean cyan. So any color can be <strong>placed</strong> by hand where its name fits best, by dragging it on the hue graph in Settings, and the others re-space evenly around it. Colors keep their order around the circle: a placed color stays between its neighbors, at least a quarter of the even step from each.</p>
      <div class="demo"><div class="demo-out wide">${$e(e)}</div></div>
      <p>The <strong>blind hue test</strong> in Settings measures where each name fits. It shows one color at a time, without its name, and asks whether it leans toward the color before it or the one after it; the hue where it leans neither way is the middle of its name, and a color can be placed there.</p>
    </section>

    <section class="step">
      <h2>Reading changes</h2>
      <p>Placed hues and colorfulness per hue are edits on top of the uniform lineup. The <strong>H</strong> and <strong>M</strong> switches in the header turn them off and on across the pages, so the palette can be seen with and without them.</p>
      <p>At the top of Settings, a strip shows the palette a step at a time. <strong>Uniform</strong> is the evenly spaced lineup. <strong>Turned</strong> is the same lineup turned around the circle to best match the placed hues; turning keeps it uniform. <strong>+H</strong> adds the placed hues, and <strong>+M</strong> colorfulness per hue. How far the edits take the palette from the turned lineup is its <strong>bend</strong>, in gaps: one gap is the even difference between neighbors${h?`, ${h.toFixed(1)} \u0394E in ${e.mode} mode here`:""}, \u0394E being how different two colors look in CAM16-UCS. Here's the strip for this palette; point at a swatch or a row for its numbers, and click a number for what it means.</p>
      <div class="demo"><div id="palette-strip" class="strip"></div></div>
      ${se(F(e.mode))}
      <p>Bending colors is what placing is for, so bend isn't the risk in itself. Evenness is: when two neighbors end up closer than the even gap, they're easier to confuse. Under ${String(j(F(e.mode))[0])}% closer is fine, ${String(j(F(e.mode))[0])} to ${String(j(F(e.mode))[1])}% is worth watching, and over ${String(j(F(e.mode))[1])}% they're getting confusable, for this palette's gap of ${F(e.mode).toFixed(1)} \u0394E. A change is also split into what it's made of, hue, colorfulness and lightness, as shares that add up to the whole.</p>
    </section>

    <section class="step">
      <h2>Muted and custom colors</h2>
      <p>Muted colors are the same hue on the same tier, at ${String(Math.round(t.mutedShare*100))}% of the default's colorfulness: quieter, never weaker in contrast. Every tier of one color:</p>
      <div class="demo">
        <div class="demo-controls">
          ${P(e,"demo-color","Color",(e.palette?.[e.mode].colors??[]).map(d=>[d.key,e.label(d.key)]),"ladder")}
        </div>
        <div id="demo-ladder-out" class="demo-out wide">${ge(e)}</div>
      </div>
      <p><strong>Custom colors</strong> sit beside the hues${n?`, like ${t.customColors.map(d=>te(d.name)).join(" and ")} here`:""}. Each has a name, its own hue and a share of the colorfulness: on every tier it's the most colorful color of that hue, up to its share of the tier's target, exactly on the tier's contrast, with a muted version too. Custom colors aren't spaced with the hues and aren't measured by the blind tests; on the hue circle they're drawn as diamonds. Settings adds as many as needed, under Extra colors.</p>
    </section>

    <section class="step">
      <h2>Neutrals</h2>
      <p>Every palette has <strong>Gray</strong> on every tier: no hue at all, red, green and blue the same, exactly on the tier's contrast against the base, as every color is.</p>
      <p>A <strong>neutral color</strong> takes the base's hue at a share of the base's own colorfulness, so it belongs with a base of that hue. On warm paper, text in a warm neutral sits on the page instead of looking cold on it. A color's colorfulness puts it in a zone: under M ${String(A[0])} it reads as gray, from M ${String(A[0])} to ${String(A[1])} it shows the hue yet reads as a neutral, and past that it reads as a color. The limits come from color difference: M ${String(A[0])} is just visibly different from Gray side by side, and M ${String(A[1])} is a different shade of it. In Settings, a bar under every colorfulness slider shows the zones, and its readout explains them.</p>
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
    </section>`}export{Ce as howPage,Me as updateDemo};
