import{a as H,b as P,c as R,d as C,e as A,f as N,g as O,h as L,i as B,j as G,k as j,l as E,m as F,n as D,o as I,p as J}from"./chunk-HVEKGV22.js";import"./chunk-GYMDR32X.js";import{E as b,i as p,s as v,t as T}from"./chunk-7JYMHWRG.js";import{m as M}from"./chunk-C34FQDYE.js";import{j as S,n as y,o as f}from"./chunk-35RC7DVO.js";var w=30,x=12,z=5,d=null;function q(e,o){let t=C(e.stairs,o);if(!t)return null;let{offset:s,check:a}=A(t,x),n=t.hue+s,r=y(n),u=v(e.model,e.base,e.mode,r,e.target+T(e.settings,e.mode,r),e.tier);return{stair:t,color:u,hue:n,afterLeft:Math.random()<.5,check:a}}function Q(e){let o=e.palette?.[e.mode];if(!o||e.settings.hues!==p.length)return!1;let t=b(e.settings,e.mode),s=o.colors.filter(r=>r.kind==="hue").map(r=>({key:r.key,hue:r.tiers[t].default.hue})).toSorted((r,u)=>r.hue-u.hue),a=R(s.length),n={mode:e.mode,gamut:e.gamut,tier:t,target:o.targets[t],base:e.settings.bases[e.mode],model:S(e.settings,e.gamut),settings:e.settings,stairs:s.map((r,u)=>({...P(r.key,10*a[u]),hue:r.hue,before:s[(u-1+s.length)%s.length].key,after:s[(u+1)%s.length].key})),points:[],resting:!1};return d={...n,trial:q(n)},!0}function V(e){return[...B(g(),e)].map(([o,t])=>{let s=t[0].x,a=t.map(u=>({...u,x:s+f(s,u.x)})),n=a.reduce((u,h)=>u+h.x,0)/a.length,r=L(a,Math.round(n),w+10);return{key:o,count:t.length,result:r&&{hue:y(r.at),below:r.at-r.low,above:r.high-r.at,sure:r.sure}}})}var k="hue-test",K="hue",U=e=>F(e.key,[e.x],e.y),$=G("ek-colors:hue-tests",U),g=()=>$.all(),W=e=>$.keep(e);function X(e){return E(K,e,e.points.map(o=>[o.key,Math.round(o.x*10)/10,o.y]))}function Y(e){return j(e,K,o=>{if(!Array.isArray(o))return null;let[t,s,a]=o,n={key:t,x:s,y:a};return U(n)?n:null})}function le(e){if(d&&d.mode===e.mode)return Z(e);let o=e.mode,t=g().filter(n=>n.mode===e.mode),s=e.settings.hues===p.length,a=!!e.palette&&s;return`<section class="intro">
      <h1>Blind hue test</h1>
      <p>Measures where each ${o}-mode color looks most like its name, to place it. One color at a time, without its name: say which of its two neighbors it leans toward, or neither. Up to ${String(H*p.length)} colors, fewer once the answers settle; usually about five minutes. Each color's answers close in on the hue where it leans neither way, the middle of its name, with an easy one now and then to check the answers depend on what's shown.</p>
      <ul class="soft checklist">
        <li>Turn off True Tone, Night Shift, Night Light or any blue-light filter, and use the usual brightness.</li>
        <li>Look straight at the screen, in the room you usually work in.</li>
        <li>Go with the first impression. If it leans neither way, pick "Neither".</li>
      </ul>
      ${s?"":'<p class="soft">The test needs the eight named colors; set How many hues to 8.</p>'}
      <p class="row"><button type="button" data-hue-test="start" ${a?"":"disabled"}>${s?e.palette?t.length?"Take it again":"Start":"Solving the palette\u2026":"Needs eight colors"}</button><a href="#tune">Back to hue</a><span class="soft">Tests ${o} mode; switch Light and Dark above for the other.</span></p>
    </section>
    ${t.length?_(e):""}`}function Z(e){let o=d,t=o.trial,[s,a]=t.afterLeft?[t.stair.after,t.stair.before]:[t.stair.before,t.stair.after],n=r=>e.label(r).toLowerCase();return`<section class="test-stage" id="test-stage">
      <h1 class="visually-hidden">Blind hue test</h1>
      ${O(o.stairs)}
      <p>Does it lean more ${n(s)} or more ${n(a)}?</p>
      <div class="test-single${o.resting?" resting":""}" style="--c:${t.color}" role="img" aria-label="The color to judge"></div>
      <div class="row test-answers">
        <button type="button" id="answer-left" data-hue-test="left">More ${n(s)}</button>
        <button type="button" id="answer-same" data-hue-test="same">Neither</button>
        <button type="button" id="answer-right" data-hue-test="right">More ${n(a)}</button>
      </div>
      <p class="soft">Keys: \u2190 ${n(s)}, \u2193 neither, \u2192 ${n(a)}. <button type="button" data-hue-test="stop" class="link">Stop the test</button></p>
    </section>`}function _(e){let o=b(e.settings,e.mode),t=i=>e.palette?.[e.mode].colors.find(l=>l.key===i)?.tiers[o]?.default,s=V(e.mode).toSorted((i,l)=>(t(i.key)?.hue??0)-(t(l.key)?.hue??0)),a=s.map(i=>{let l=i.result,c=t(i.key),m=l&&c?f(c.hue,l.hue):null;return`<tr${l?.sure&&m!==null&&(m-l.below>0||m+l.above<0)?' class="clear"':""}>
        <th scope="row"><span class="dot" style="--c:${c?.color??"transparent"}"></span> ${e.label(i.key)}</th>
        <td class="mono num">${String(i.count)}</td>
        <td class="mono num">${l?`${l.hue.toFixed(1)}\xB0`:"\u2014"}</td>
        <td class="mono soft num">${l?l.sure?`\xB1${((l.below+l.above)/2).toFixed(1)}\xB0`:"unsure":"\u2014"}</td>
        <td class="mono num">${c?`${c.hue.toFixed(1)}\xB0`:"\u2014"}</td>
        <td class="mono num">${m===null?"\u2014":`${M(m)}\xB0`}</td>
      </tr>`}).join(""),n=Object.fromEntries(s.flatMap(i=>i.result?.sure?[[i.key,Math.round(i.result.hue)]]:[])),r=g().flatMap((i,l)=>i.mode===e.mode?[D(k,i,l,"colors")]:[]).join(""),u=e.mode,h=Object.keys(n).length;return`<section>
      <h2>Results, ${u} mode</h2>
      <p class="soft">The hue where each color leans toward neither neighbor, from every run below together. "Could be" is how far either way the answers can't rule out; a color in bold is clearly off, since the palette's hue is outside that range.</p>
      <div class="scroll"><table class="test-results"><thead><tr><th scope="col">Color</th><th scope="col" class="num">Answers</th><th scope="col" class="num">Measured</th><th scope="col" class="num">Could be</th><th scope="col" class="num">Palette</th><th scope="col" class="num">Off by</th></tr></thead><tbody>${a}</tbody></table></div>
      ${h?`<p>Place the ${String(h)} color${h===1?"":"s"} with a sure result at the measured hue${h===1?"":"s"}; yellow's moves the anchor. <button type="button" data-hue-test="apply" data-hues='${JSON.stringify(n)}'>Place them</button></p>`:'<p class="soft">No color has a sure result yet.</p>'}
      <p class="soft">Hues apply to both modes. One run is a rough answer; two or three, or a few people's, make it steadier.</p>
    </section>
    ${I(k,r)}`}function ee(e,o){let t=d;if(!t||t.resting)return;let s=t.trial,a=o==="same"?.5:o==="left"===s.afterLeft?1:0;t.points.push({key:s.stair.key,x:s.hue,y:a}),N(s.stair,{x:s.hue,y:a},s.check,w,{center:s.stair.hue,range:w+10,half:z});let n=q(t,s.stair.key);if(!n){W([...g(),{mode:t.mode,gamut:t.gamut,tier:t.tier,when:new Date().toISOString(),points:t.points}]),d=null,e.redraw();return}t.trial=n,t.resting=!0,e.redraw(),window.setTimeout(()=>{d===t&&(t.resting=!1,e.redraw())},300)}function ie(e){J(e,{name:k,code:"hue test",runs:$,encode:X,decode:Y,start:Q,stop:()=>d=null,answer:ee,apply:(o,t)=>o.applyHues(JSON.parse(t.dataset.hues??"{}")),asking:()=>!!(d&&document.querySelector("#test-stage .test-single"))})}export{ie as bindHueTest,le as hueTestPage};
