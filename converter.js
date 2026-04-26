// ============================================================
//  converter.js  v2.0  —  Mixamo FBX → Roblox .rbxanim
//  Usa Three.js FBXLoader para parsear FBX correctamente
// ============================================================

const BONE_MAP = {
  "Hips":"HumanoidRootPart","Spine":"LowerTorso","Spine1":"LowerTorso",
  "Spine2":"UpperTorso","Neck":"Head","Head":"Head",
  "LeftShoulder":"LeftUpperArm","LeftArm":"LeftUpperArm","LeftForeArm":"LeftLowerArm","LeftHand":"LeftHand",
  "RightShoulder":"RightUpperArm","RightArm":"RightUpperArm","RightForeArm":"RightLowerArm","RightHand":"RightHand",
  "LeftUpLeg":"LeftUpperLeg","LeftLeg":"LeftLowerLeg","LeftFoot":"LeftFoot","LeftToeBase":"LeftFoot",
  "RightUpLeg":"RightUpperLeg","RightLeg":"RightLowerLeg","RightFoot":"RightFoot","RightToeBase":"RightFoot",
  "mixamorig:Hips":"HumanoidRootPart","mixamorig:Spine":"LowerTorso","mixamorig:Spine1":"LowerTorso",
  "mixamorig:Spine2":"UpperTorso","mixamorig:Neck":"Head","mixamorig:Head":"Head",
  "mixamorig:LeftShoulder":"LeftUpperArm","mixamorig:LeftArm":"LeftUpperArm","mixamorig:LeftForeArm":"LeftLowerArm","mixamorig:LeftHand":"LeftHand",
  "mixamorig:RightShoulder":"RightUpperArm","mixamorig:RightArm":"RightUpperArm","mixamorig:RightForeArm":"RightLowerArm","mixamorig:RightHand":"RightHand",
  "mixamorig:LeftUpLeg":"LeftUpperLeg","mixamorig:LeftLeg":"LeftLowerLeg","mixamorig:LeftFoot":"LeftFoot",
  "mixamorig:RightUpLeg":"RightUpperLeg","mixamorig:RightLeg":"RightLowerLeg","mixamorig:RightFoot":"RightFoot",
};

let convertedRbxanim = null;
let convertedLuaScript = null;
let originalFileName = "";
let threeLoaded = false;

// ── Cargar Three.js + FBXLoader ───────────────────────────────
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
  const icon   = el.querySelector(".prog-icon");
  const icons  = {"step-parse":"📂","step-bones":"🦴","step-keyframes":"🎞️","step-export":"✅"};
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
dropzone.addEventListener("drop", e => {
  e.preventDefault(); dropzone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
dropzone.addEventListener("click", e => { if (e.target.tagName !== "BUTTON") fileInput.click(); });

// ── Main ──────────────────────────────────────────────────────
async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith(".fbx")) {
    showError("El archivo debe ser .fbx — descárgalo de Mixamo con formato FBX Binary.");
    return;
  }

  originalFileName = file.name.replace(/\.fbx$/i, "");
  dropzone.style.display = "none";
  document.getElementById("progressWrap").classList.add("visible");
  document.getElementById("errorCard").classList.remove("visible");

  try {
    // Paso 1 — cargar Three.js y leer archivo
    setStep("step-parse", "active", "");
    const ok = await loadThree();
    if (!ok || !window.THREE || !window.THREE.FBXLoader) {
      throw new Error("No se pudo cargar Three.js FBXLoader. Verifica tu conexión.");
    }
    const buffer = await file.arrayBuffer();
    setStep("step-parse", "done", "listo");
    await delay(150);

    // Paso 2 — parsear FBX
    setStep("step-bones", "active", "");
    let object;
    try {
      const loader = new window.THREE.FBXLoader();
      object = loader.parse(buffer, "");
    } catch(e) {
      throw new Error("No se pudo leer el FBX: " + e.message + ". Asegúrate de descargar 'Without Skin' desde Mixamo.");
    }

    if (!object.animations || object.animations.length === 0) {
      throw new Error("No se encontraron animaciones en el archivo. Descarga desde Mixamo con 'Without Skin' y 30 FPS.");
    }

    const clip = object.animations[0];

    // Debug: mostrar los primeros 10 tracks para diagnostico
    console.log("[Mixamo2Roblox] Total tracks:", clip.tracks.length);
    clip.tracks.slice(0, 10).forEach(t => console.log("  track:", t.name, "| times:", t.times.length));

    const mappedCount = countMappedBones(clip);
    setStep("step-bones", "done", `${mappedCount} huesos`);
    await delay(150);

    // Paso 3 — convertir keyframes
    setStep("step-keyframes", "active", "");
    await delay(200);
    const animData = extractAnimationData(clip);
    if (animData.totalKeyframes === 0) {
      // Mostrar tracks disponibles en el error para diagnostico
      const trackNames = clip.tracks.slice(0,5).map(t=>t.name).join(", ");
      throw new Error(`Se leyó el FBX pero no se encontraron keyframes válidos. Tracks encontrados: ${trackNames}. Intenta descargar con Keyframe Reduction: None.`);
    }
    setStep("step-keyframes", "done", `${animData.totalKeyframes} keyframes`);
    await delay(150);

    // Paso 4 — generar rbxanim
    setStep("step-export", "active", "");
    await delay(200);
    const rbxanim = generateRbxanim(animData, originalFileName);
    convertedRbxanim = rbxanim;
    convertedLuaScript = generateLuaScript(rbxanim, originalFileName);
    setStep("step-export", "done", "listo");
    await delay(200);

    // Mostrar resultado
    document.getElementById("statBones").textContent = mappedCount;
    document.getElementById("statFrames").textContent = animData.totalKeyframes;
    document.getElementById("statDuration").textContent = animData.duration.toFixed(1) + "s";
    document.getElementById("resultWrap").classList.add("visible");

    document.getElementById("downloadBtn").onclick = () =>
      downloadFile(rbxanim, originalFileName + ".rbxanim");
    document.getElementById("copyStudioBtn").onclick = () =>
      copyToClipboard(convertedLuaScript);

  } catch(err) {
    console.error(err);
    setStep("step-parse", "error", "error");
    showError(err.message || "Error desconocido.");
  }
}

// ── Count mapped bones ────────────────────────────────────────
function countMappedBones(clip) {
  const mapped = new Set();
  clip.tracks.forEach(t => {
    const bone = t.name.split(".")[0];
    if (BONE_MAP[bone]) mapped.add(BONE_MAP[bone]);
  });
  return mapped.size;
}

// ── Extract animation data ────────────────────────────────────
function extractAnimationData(clip) {
  const duration = clip.duration;
  const boneData = {};

  clip.tracks.forEach(track => {
    // Three.js puede usar estos formatos de nombre:
    // "mixamorig:Hips.quaternion"
    // "mixamorig:Hips_rotationQuaternion"  
    // "Hips.quaternion"
    // Separar por ultimo punto
    const lastDot = track.name.lastIndexOf(".");
    let boneName, prop;

    if (lastDot !== -1) {
      boneName = track.name.substring(0, lastDot);
      prop = track.name.substring(lastDot + 1).toLowerCase();
    } else {
      // Formato alternativo con guion bajo
      const parts = track.name.split("_");
      prop = parts[parts.length - 1].toLowerCase();
      boneName = parts.slice(0, -1).join("_");
    }

    // Limpiar nombre del hueso (Three.js a veces agrega sufijos)
    // Quitar numeros al final como "Hips_1"
    boneName = boneName.replace(/_\d+$/, "");

    const roblox = BONE_MAP[boneName];
    if (!roblox) {
      // Intentar sin prefijo mixamorig:
      const clean = boneName.replace("mixamorig:", "");
      const roblox2 = BONE_MAP[clean];
      if (!roblox2) return;
      if (!boneData[roblox2]) boneData[roblox2] = {};
      boneData[roblox2][prop] = track;
      return;
    }

    if (!boneData[roblox]) boneData[roblox] = {};
    boneData[roblox][prop] = track;
  });

  console.log("[Mixamo2Roblox] Huesos mapeados:", Object.keys(boneData));

  const keyframesByBone = {};
  let totalKeyframes = 0;

  Object.entries(boneData).forEach(([robloxBone, tracks]) => {
    // Buscar track de rotacion (puede llamarse quaternion o rotation)
    const qTrack = tracks["quaternion"] || tracks["rotation"] || tracks["rotationquaternion"];
    const pTrack = tracks["position"] || tracks["translation"];
    if (!qTrack) {
      console.log("[Mixamo2Roblox] Sin track de rotacion para:", robloxBone, "tracks:", Object.keys(tracks));
      return;
    }

    const keyframes = [];
    for (let i = 0; i < qTrack.times.length; i++) {
      const t  = qTrack.times[i];
      const qi = i * 4;
      if (qi + 3 >= qTrack.values.length) break;
      const qx = qTrack.values[qi];
      const qy = qTrack.values[qi+1];
      const qz = qTrack.values[qi+2];
      const qw = qTrack.values[qi+3];
      const mat = quatToMat(qx, qy, qz, qw);

      let px = 0, py = 0, pz = 0;
      if (pTrack && i*3+2 < pTrack.values.length) {
        px = pTrack.values[i*3]   / 10;
        py = pTrack.values[i*3+1] / 10;
        pz = pTrack.values[i*3+2] / 10;
      }

      keyframes.push({ time: t, ...mat, x: px, y: py, z: pz });
      totalKeyframes++;
    }

    if (keyframes.length > 0) keyframesByBone[robloxBone] = keyframes;
  });

  return { keyframesByBone, duration, totalKeyframes };
}

function quatToMat(x, y, z, w) {
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2;
  const yy=y*y2, yz=y*z2, zz=z*z2;
  const wx=w*x2, wy=w*y2, wz=w*z2;
  return {
    r00:1-(yy+zz), r01:xy+wz,     r02:xz-wy,
    r10:xy-wz,     r11:1-(xx+zz), r12:yz+wx,
    r20:xz+wy,     r21:yz-wx,     r22:1-(xx+yy),
  };
}

// ── Generate rbxanim XML ──────────────────────────────────────
function generateRbxanim(animData, name) {
  const { keyframesByBone, duration } = animData;
  let tracksXml = "";

  Object.entries(keyframesByBone).forEach(([boneName, keyframes]) => {
    let kpXml = "";
    keyframes.forEach(kf => {
      kpXml += `\n        <item>
          <time>${kf.time.toFixed(6)}</time>
          <pose><CFrame>
            <R00>${kf.r00.toFixed(6)}</R00><R01>${kf.r01.toFixed(6)}</R01><R02>${kf.r02.toFixed(6)}</R02>
            <R10>${kf.r10.toFixed(6)}</R10><R11>${kf.r11.toFixed(6)}</R11><R12>${kf.r12.toFixed(6)}</R12>
            <R20>${kf.r20.toFixed(6)}</R20><R21>${kf.r21.toFixed(6)}</R21><R22>${kf.r22.toFixed(6)}</R22>
            <X>${kf.x.toFixed(6)}</X><Y>${kf.y.toFixed(6)}</Y><Z>${kf.z.toFixed(6)}</Z>
          </CFrame></pose>
          <easingStyle>Linear</easingStyle><easingDirection>In</easingDirection>
        </item>`;
    });
    tracksXml += `\n      <item><n>${boneName}</n><keypoints>${kpXml}\n        </keypoints></item>`;
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<KeyframeSequence>
  <n>${name}</n>
  <Duration>${duration.toFixed(6)}</Duration>
  <Loop>false</Loop>
  <Priority>3</Priority>
  <Keyframes><tracks>${tracksXml}
    </tracks></Keyframes>
</KeyframeSequence>`;
}

// ── Generate Lua script ───────────────────────────────────────
function generateLuaScript(rbxanimXml, animName) {
  const escaped = rbxanimXml
    .replace(/\\/g,"\\\\").replace(/"/g,'\\"')
    .replace(/\n/g,"\\n").replace(/\r/g,"");

  return `-- Mixamo2Roblox v2.0 — Pega en View → Command Bar → Enter
local animName="${animName||'MixamoAnim'}"
local xmlData="${escaped}"
local model=nil
local sel=game:GetService("Selection"):Get()
if #sel>0 then local s=sel[1];if s:IsA("BasePart")then s=s.Parent end;if s:FindFirstChildOfClass("Humanoid")then model=s end end
if not model then for _,v in ipairs(workspace:GetChildren())do if v:IsA("Model")and v:FindFirstChildOfClass("Humanoid")then model=v;break end end end
if not model then warn("[Mixamo2Roblox] Selecciona un personaje primero.");return end
local e=model:FindFirstChild("MixamoAnim_"..animName);if e then e:Destroy()end
local sv=Instance.new("StringValue");sv.Name="MixamoAnim_"..animName;sv.Value=xmlData;sv.Parent=model
game:GetService("Selection"):Set({model})
print("[Mixamo2Roblox] ✅ Listo en "..model.Name.." → Animation Editor → ··· → Import Animation")`;
}

// ── Utilities ─────────────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); ta.remove();
  });
  const fb = document.getElementById("copyFeedback");
  fb.style.display = "block";
  setTimeout(() => fb.style.display = "none", 4000);
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type:"application/xml" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log("[Mixamo2Roblox] v2.0 con Three.js FBXLoader listo");
