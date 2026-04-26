// ============================================================
//  converter.js  v4.0  —  Mixamo FBX → Roblox KeyframeSequence
//  Conversion correcta: rotaciones locales relativas al padre
// ============================================================

const BONE_MAP = {
  "Hips":"HumanoidRootPart","Spine":"LowerTorso","Spine1":"LowerTorso",
  "Spine2":"UpperTorso","Neck":"Head","Head":"Head",
  "LeftShoulder":"LeftUpperArm","LeftArm":"LeftUpperArm","LeftForeArm":"LeftLowerArm","LeftHand":"LeftHand",
  "RightShoulder":"RightUpperArm","RightArm":"RightUpperArm","RightForeArm":"RightLowerArm","RightHand":"RightHand",
  "LeftUpLeg":"LeftUpperLeg","LeftLeg":"LeftLowerLeg","LeftFoot":"LeftFoot","LeftToeBase":"LeftFoot",
  "RightUpLeg":"RightUpperLeg","RightLeg":"RightLowerLeg","RightFoot":"RightFoot","RightToeBase":"RightFoot",
  "mixamorigHips":"HumanoidRootPart","mixamorigSpine":"LowerTorso","mixamorigSpine1":"LowerTorso",
  "mixamorigSpine2":"UpperTorso","mixamorigNeck":"Head","mixamorigHead":"Head",
  "mixamorigLeftShoulder":"LeftUpperArm","mixamorigLeftArm":"LeftUpperArm","mixamorigLeftForeArm":"LeftLowerArm","mixamorigLeftHand":"LeftHand",
  "mixamorigRightShoulder":"RightUpperArm","mixamorigRightArm":"RightUpperArm","mixamorigRightForeArm":"RightLowerArm","mixamorigRightHand":"RightHand",
  "mixamorigLeftUpLeg":"LeftUpperLeg","mixamorigLeftLeg":"LeftLowerLeg","mixamorigLeftFoot":"LeftFoot",
  "mixamorigRightUpLeg":"RightUpperLeg","mixamorigRightLeg":"RightLowerLeg","mixamorigRightFoot":"RightFoot",
};

// Jerarquia R15 — padre de cada hueso
const BONE_PARENT = {
  "HumanoidRootPart": null,
  "LowerTorso": "HumanoidRootPart",
  "UpperTorso": "LowerTorso",
  "Head": "UpperTorso",
  "LeftUpperArm": "UpperTorso",
  "LeftLowerArm": "LeftUpperArm",
  "LeftHand": "LeftLowerArm",
  "RightUpperArm": "UpperTorso",
  "RightLowerArm": "RightUpperArm",
  "RightHand": "RightLowerArm",
  "LeftUpperLeg": "LowerTorso",
  "LeftLowerLeg": "LeftUpperLeg",
  "LeftFoot": "LeftLowerLeg",
  "RightUpperLeg": "LowerTorso",
  "RightLowerLeg": "RightUpperLeg",
  "RightFoot": "RightLowerLeg",
};

const BONE_ORDER = ["HumanoidRootPart","LowerTorso","UpperTorso","Head",
  "LeftUpperArm","LeftLowerArm","LeftHand",
  "RightUpperArm","RightLowerArm","RightHand",
  "LeftUpperLeg","LeftLowerLeg","LeftFoot",
  "RightUpperLeg","RightLowerLeg","RightFoot"];

let convertedRbxanim = null;
let convertedLuaScript = null;
let originalFileName = "";
let threeLoaded = false;

// ── Cargar Three.js ───────────────────────────────────────────
function loadThree() {
  if (threeLoaded) return Promise.resolve(true);
  return new Promise(resolve => {
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js";
      s2.onload = () => {
        const s3 = document.createElement("script");
        s3.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/fflate.min.js";
        s3.onload = () => { threeLoaded = true; resolve(true); };
        s3.onerror = () => { threeLoaded = true; resolve(true); };
        document.head.appendChild(s3);
      };
      s2.onerror = () => resolve(false);
      document.head.appendChild(s2);
    };
    s1.onerror = () => resolve(false);
    document.head.appendChild(s1);
  });
}

// ── UI ────────────────────────────────────────────────────────
function setStep(id, state, statusText) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "prog-step " + state;
  const status = el.querySelector(".prog-status");
  const icon = el.querySelector(".prog-icon");
  const icons = {"step-parse":"📂","step-bones":"🦴","step-keyframes":"🎞️","step-export":"✅"};
  if (status) {
    if (state === "active") status.innerHTML = '<span class="spinner"></span>';
    else status.textContent = statusText;
  }
  if (icon) {
    if (state === "done") icon.textContent = "✅";
    else if (state === "error") icon.textContent = "❌";
    else icon.textContent = icons[id] || "⚙️";
  }
}

function showError(msg) {
  const card = document.getElementById("errorCard");
  card.textContent = "❌ Error: " + msg;
  card.classList.add("visible");
}

function resetConverter() {
  document.getElementById("dropzone").style.display = "block";
  document.getElementById("progressWrap").classList.remove("visible");
  document.getElementById("resultWrap").classList.remove("visible");
  document.getElementById("errorCard").classList.remove("visible");
  ["step-parse","step-bones","step-keyframes","step-export"].forEach(id => setStep(id,"","esperando"));
  convertedRbxanim = null;
  convertedLuaScript = null;
}

// ── Drag & Drop ───────────────────────────────────────────────
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", e => { e.preventDefault(); dropzone.classList.remove("drag-over"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
dropzone.addEventListener("click", e => { if (e.target.tagName !== "BUTTON") fileInput.click(); });

// ── Main ──────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".fbx")) { showError("El archivo debe ser .fbx"); return; }
  originalFileName = file.name.replace(/\.fbx$/i, "");
  dropzone.style.display = "none";
  document.getElementById("progressWrap").classList.add("visible");
  document.getElementById("errorCard").classList.remove("visible");

  try {
    setStep("step-parse", "active", "");
    const ok = await loadThree();
    if (!ok || !window.THREE || !window.THREE.FBXLoader) throw new Error("No se pudo cargar Three.js");
    const buffer = await file.arrayBuffer();
    setStep("step-parse", "done", "listo");
    await delay(150);

    setStep("step-bones", "active", "");
    let object;
    try {
      const loader = new window.THREE.FBXLoader();
      object = loader.parse(buffer, "");
    } catch(e) { throw new Error("Error leyendo FBX: " + e.message); }

    if (!object.animations || object.animations.length === 0)
      throw new Error("No se encontraron animaciones. Descarga de Mixamo con 'Without Skin'.");

    const clip = object.animations[0];
    console.log("[M2R] Tracks:", clip.tracks.length);
    clip.tracks.slice(0,5).forEach(t => console.log("  ", t.name));

    // Extraer datos crudos de Three.js (quaterniones locales por hueso)
    const rawBones = extractRawBones(clip);
    const mappedCount = Object.keys(rawBones).length;
    setStep("step-bones", "done", `${mappedCount} huesos`);
    await delay(150);

    setStep("step-keyframes", "active", "");
    await delay(200);

    // Construir animacion: calcular poses locales correctas
    const animData = buildAnimData(rawBones, clip.duration);
    if (animData.totalKeyframes === 0) throw new Error("No se encontraron keyframes validos.");
    setStep("step-keyframes", "done", `${animData.totalKeyframes} keyframes`);
    await delay(150);

    setStep("step-export", "active", "");
    await delay(200);
    convertedLuaScript = generateLuaScript(animData, originalFileName);
    convertedRbxanim = "generated";
    setStep("step-export", "done", "listo");
    await delay(200);

    document.getElementById("statBones").textContent = mappedCount;
    document.getElementById("statFrames").textContent = animData.totalKeyframes;
    document.getElementById("statDuration").textContent = animData.duration.toFixed(1) + "s";
    document.getElementById("resultWrap").classList.add("visible");

    document.getElementById("downloadBtn").onclick = () =>
      downloadFile(convertedLuaScript, originalFileName + ".lua");
    document.getElementById("copyStudioBtn").onclick = () =>
      copyToClipboard(convertedLuaScript);

  } catch(err) {
    console.error(err);
    setStep("step-parse", "error", "error");
    showError(err.message || "Error desconocido.");
  }
}

// ── Extraer quaterniones locales por hueso de Three.js ────────
// Three.js FBXLoader ya nos da los quaterniones en espacio LOCAL del hueso
// Esto es exactamente lo que Roblox necesita para Pose.CFrame
function extractRawBones(clip) {
  const bones = {};

  clip.tracks.forEach(track => {
    const lastDot = track.name.lastIndexOf(".");
    if (lastDot === -1) return;
    let boneName = track.name.substring(0, lastDot);
    const prop = track.name.substring(lastDot + 1).toLowerCase();

    // Limpiar nombre
    boneName = boneName.replace(/_\d+$/, "");

    const roblox = BONE_MAP[boneName];
    if (!roblox) return;

    if (!bones[roblox]) bones[roblox] = {};
    if (prop === "quaternion") bones[roblox].q = track;
    else if (prop === "position") bones[roblox].p = track;
  });

  return bones;
}

// ── Construir datos de animacion ──────────────────────────────
function buildAnimData(rawBones, duration) {
  // Reduccion de keyframes: 1 de cada 2 para balance calidad/tamaño
  const STEP = 2;

  // Recolectar todos los tiempos
  const allTimes = new Set();
  Object.values(rawBones).forEach(bone => {
    if (bone.q) bone.q.times.forEach((t, i) => {
      if (i % STEP === 0 || i === bone.q.times.length - 1) allTimes.add(parseFloat(t.toFixed(4)));
    });
  });
  const times = Array.from(allTimes).sort((a, b) => a - b);

  // Para cada hueso, interpolar quaternion en cada tiempo
  const boneFrames = {};
  let totalKeyframes = 0;

  BONE_ORDER.forEach(robloxBone => {
    const bone = rawBones[robloxBone];
    if (!bone || !bone.q) return;

    const frames = times.map(t => {
      const q = sampleQuaternion(bone.q, t);
      const p = bone.p ? samplePosition(bone.p, t) : {x:0,y:0,z:0};
      return { t, qx:q.x, qy:q.y, qz:q.z, qw:q.w, px:p.x, py:p.y, pz:p.z };
    });

    boneFrames[robloxBone] = frames;
    totalKeyframes += frames.length;
  });

  return { boneFrames, times, duration, totalKeyframes };
}

// Interpolar quaternion en un tiempo dado
function sampleQuaternion(track, t) {
  const times = track.times;
  const vals = track.values;

  if (t <= times[0]) return {x:vals[0],y:vals[1],z:vals[2],w:vals[3]};
  if (t >= times[times.length-1]) {
    const i = (times.length-1)*4;
    return {x:vals[i],y:vals[i+1],z:vals[i+2],w:vals[i+3]};
  }

  // Buscar intervalo
  let lo = 0, hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid;
  }

  const alpha = (t - times[lo]) / (times[hi] - times[lo]);
  const i0 = lo * 4, i1 = hi * 4;

  // SLERP
  let ax=vals[i0],ay=vals[i0+1],az=vals[i0+2],aw=vals[i0+3];
  let bx=vals[i1],by=vals[i1+1],bz=vals[i1+2],bw=vals[i1+3];

  let dot = ax*bx+ay*by+az*bz+aw*bw;
  if (dot < 0) { bx=-bx; by=-by; bz=-bz; bw=-bw; dot=-dot; }

  if (dot > 0.9995) {
    return {x:ax+(bx-ax)*alpha, y:ay+(by-ay)*alpha, z:az+(bz-az)*alpha, w:aw+(bw-aw)*alpha};
  }

  const theta0 = Math.acos(dot);
  const theta = theta0 * alpha;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return {
    x: s0*ax+s1*bx, y: s0*ay+s1*by,
    z: s0*az+s1*bz, w: s0*aw+s1*bw
  };
}

function samplePosition(track, t) {
  const times = track.times;
  const vals = track.values;
  if (t <= times[0]) return {x:vals[0]/100,y:vals[1]/100,z:vals[2]/100};
  if (t >= times[times.length-1]) {
    const i = (times.length-1)*3;
    return {x:vals[i]/100,y:vals[i+1]/100,z:vals[i+2]/100};
  }
  let lo = 0, hi = times.length - 1;
  while (hi - lo > 1) { const mid=(lo+hi)>>1; if(times[mid]<=t) lo=mid; else hi=mid; }
  const alpha = (t-times[lo])/(times[hi]-times[lo]);
  const i0=lo*3,i1=hi*3;
  return {
    x:(vals[i0]+(vals[i1]-vals[i0])*alpha)/100,
    y:(vals[i0+1]+(vals[i1+1]-vals[i0+1])*alpha)/100,
    z:(vals[i0+2]+(vals[i1+2]-vals[i0+2])*alpha)/100,
  };
}

// ── Generar script Lua ────────────────────────────────────────
// Estrategia: pasar quaterniones locales directamente
// Three.js FBXLoader ya extrae los quaterniones en espacio local del hueso
// Roblox Pose.CFrame = CFrame construida desde ese quaternion local
function generateLuaScript(animData, animName) {
  const { boneFrames, times, duration } = animData;
  const name = (animName || 'MixamoAnim').replace(/[^a-zA-Z0-9_]/g, '_');

  // Serializar datos compactos: [qx,qy,qz,qw,px,py,pz] por frame por hueso
  let bonesLua = '';
  BONE_ORDER.forEach(bone => {
    const frames = boneFrames[bone];
    if (!frames) return;
    const data = frames.map(f =>
      `{${f.qx.toFixed(5)},${f.qy.toFixed(5)},${f.qz.toFixed(5)},${f.qw.toFixed(5)},${f.px.toFixed(4)},${f.py.toFixed(4)},${f.pz.toFixed(4)}}`
    ).join(',');
    bonesLua += `  ["${bone}"]={${data}},\n`;
  });

  const timesLua = `{${times.map(t=>t.toFixed(4)).join(',')}}`;

  return `-- Mixamo2Roblox v4.0 — Pega en View → Command Bar → Enter
-- ${times.length} keyframes | duracion: ${duration.toFixed(2)}s
local N="${name}"
local T=${timesLua}
local B={
${bonesLua}}
local hier={LowerTorso="HumanoidRootPart",UpperTorso="LowerTorso",Head="UpperTorso",LeftUpperArm="UpperTorso",LeftLowerArm="LeftUpperArm",LeftHand="LeftLowerArm",RightUpperArm="UpperTorso",RightLowerArm="RightUpperArm",RightHand="RightLowerArm",LeftUpperLeg="LowerTorso",LeftLowerLeg="LeftUpperLeg",LeftFoot="LeftLowerLeg",RightUpperLeg="LowerTorso",RightLowerLeg="RightUpperLeg",RightFoot="RightLowerLeg"}
local ord={"LowerTorso","UpperTorso","Head","LeftUpperArm","LeftLowerArm","LeftHand","RightUpperArm","RightLowerArm","RightHand","LeftUpperLeg","LeftLowerLeg","LeftFoot","RightUpperLeg","RightLowerLeg","RightFoot"}
local model=nil
local sel=game:GetService("Selection"):Get()
if #sel>0 then local s=sel[1];if s:IsA("BasePart")then s=s.Parent end;if s:FindFirstChildOfClass("Humanoid")then model=s end end
if not model then for _,v in ipairs(workspace:GetChildren())do if v:IsA("Model")and v:FindFirstChildOfClass("Humanoid")then model=v;break end end end
if not model then warn("Selecciona un personaje");return end
local old=workspace:FindFirstChild(N);if old then old:Destroy()end
local ks=Instance.new("KeyframeSequence");ks.Name=N;ks.Loop=false;ks.Priority=Enum.AnimationPriority.Action
local function mkpose(parent,bname,cf)
  local p=Instance.new("Pose");p.Name=bname;p.CFrame=cf
  p.EasingStyle=Enum.PoseEasingStyle.Linear;p.EasingDirection=Enum.PoseEasingDirection.In
  p.Weight=1;p.Parent=parent;return p
end
for ti,t in ipairs(T)do
  local kf=Instance.new("Keyframe");kf.Time=t
  local poses={}
  -- HumanoidRootPart siempre identidad (posicion la maneja Roblox)
  poses["HumanoidRootPart"]=mkpose(kf,"HumanoidRootPart",CFrame.new())
  for _,bn in ipairs(ord)do
    local d=B[bn];if not d then poses[bn]=mkpose(poses[hier[bn]]or poses["HumanoidRootPart"],bn,CFrame.new());continue end
    local f=d[ti];if not f then poses[bn]=mkpose(poses[hier[bn]]or poses["HumanoidRootPart"],bn,CFrame.new());continue end
    -- Quaternion local directo de Mixamo (Three.js ya lo da en espacio local)
    local qx,qy,qz,qw=f[1],f[2],f[3],f[4]
    -- Convertir quaternion local de Mixamo a CFrame de Roblox
    -- Correccion de ejes: negar Y y Z del quaternion
    local rx,ry,rz,rw = qx,-qy,-qz,qw
    local x2=rx+rx;local y2=ry+ry;local z2=rz+rz
    local xx=rx*x2;local xy=rx*y2;local xz=rx*z2
    local yy=ry*y2;local yz=ry*z2;local zz=rz*z2
    local wx=rw*x2;local wy=rw*y2;local wz=rw*z2
    local cf=CFrame.new(f[5],f[6],-f[7], 1-(yy+zz),xy+wz,xz-wy, xy-wz,1-(xx+zz),yz+wx, xz+wy,yz-wx,1-(xx+yy))
    poses[bn]=mkpose(poses[hier[bn]]or poses["HumanoidRootPart"],bn,cf)
  end
  kf.Parent=ks
end
ks.Parent=workspace
game:GetService("Selection"):Set({ks})
local ksp=game:GetService("KeyframeSequenceProvider")
local tid=ksp:RegisterKeyframeSequence(ks)
local char=nil;for _,v in ipairs(workspace:GetChildren())do if v:IsA("Model")and v:FindFirstChildOfClass("Humanoid")then char=v;break end end
if char then
  local h=char:FindFirstChildOfClass("Humanoid")
  local a=Instance.new("Animation");a.AnimationId=tid
  local tr=h:LoadAnimation(a);tr:Play()
  print("[M2R v4] Reproduciendo '"..N.."' directamente!")
else
  print("[M2R v4] KeyframeSequence '"..N.."' lista en Workspace")
  print("Para reproducir: RegisterKeyframeSequence + LoadAnimation")
end
print("Para publicar: clic derecho en '"..N.."' → Save to Roblox")
`;
}

// ── Utilities ─────────────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";
    document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");ta.remove();
  });
  const fb=document.getElementById("copyFeedback");fb.style.display="block";
  setTimeout(()=>fb.style.display="none",4000);
}

function downloadFile(content, filename) {
  const blob=new Blob([content],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}

function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

console.log("[Mixamo2Roblox] v4.0 cargado");
