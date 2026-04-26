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
  // Sin dos puntos (Three.js remueve el : del nombre)
  "mixamorigHips":"HumanoidRootPart","mixamorigSpine":"LowerTorso","mixamorigSpine1":"LowerTorso",
  "mixamorigSpine2":"UpperTorso","mixamorigNeck":"Head","mixamorigHead":"Head",
  "mixamorigLeftShoulder":"LeftUpperArm","mixamorigLeftArm":"LeftUpperArm","mixamorigLeftForeArm":"LeftLowerArm","mixamorigLeftHand":"LeftHand",
  "mixamorigRightShoulder":"RightUpperArm","mixamorigRightArm":"RightUpperArm","mixamorigRightForeArm":"RightLowerArm","mixamorigRightHand":"RightHand",
  "mixamorigLeftUpLeg":"LeftUpperLeg","mixamorigLeftLeg":"LeftLowerLeg","mixamorigLeftFoot":"LeftFoot","mixamorigLeftToeBase":"LeftFoot",
  "mixamorigRightUpLeg":"RightUpperLeg","mixamorigRightLeg":"RightLowerLeg","mixamorigRightFoot":"RightFoot","mixamorigRightToeBase":"RightFoot",
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
    convertedLuaScript = generateLuaScript(rbxanim, originalFileName, animData);
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
// Roblox KeyframeSequence estructura correcta:
// KeyframeSequence
//   Keyframe (Time=0)
//     Pose "HumanoidRootPart" (pose raiz)
//       Pose "LowerTorso"
//         Pose "UpperTorso"
//           Pose "Head"
//           Pose "LeftUpperArm" → LeftLowerArm → LeftHand
//           Pose "RightUpperArm" → ...
//       Pose "LeftUpperLeg" → LeftLowerLeg → LeftFoot
//       Pose "RightUpperLeg" → ...

// Jerarquia de huesos R15
const BONE_HIERARCHY = {
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

function generateLuaScript(rbxanimXml, animName, animData) {
  const { keyframesByBone, duration } = animData;
  const STEP = 3;
  const name = (animName || 'MixamoAnim').replace(/[^a-zA-Z0-9_]/g, '_');

  // Recolectar tiempos unicos reducidos
  const allTimes = new Set();
  Object.values(keyframesByBone).forEach(kfs => {
    kfs.forEach((kf, i) => {
      if (i % STEP === 0 || i === kfs.length - 1) allTimes.add(parseFloat(kf.time.toFixed(4)));
    });
  });
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  // Construir mapa de keyframes por hueso reducido
  const reducedByBone = {};
  Object.entries(keyframesByBone).forEach(([bone, kfs]) => {
    reducedByBone[bone] = {};
    kfs.forEach((kf, i) => {
      if (i % STEP === 0 || i === kfs.length - 1) {
        const t = parseFloat(kf.time.toFixed(4));
        reducedByBone[bone][t] = kf;
      }
    });
  });

  // Generar el script en bloques para evitar el limite de 100k chars
  // Dividimos en chunks de 50 keyframes
  const CHUNK = 50;
  const chunks = [];
  for (let i = 0; i < sortedTimes.length; i += CHUNK) {
    chunks.push(sortedTimes.slice(i, i + CHUNK));
  }

  let script = `-- Mixamo2Roblox v2.2 — Pega en View → Command Bar → Enter
local animName = "${name}"
local model = nil
local sel = game:GetService("Selection"):Get()
if #sel > 0 then
  local s = sel[1]
  if s:IsA("BasePart") then s = s.Parent end
  if s:FindFirstChildOfClass("Humanoid") then model = s end
end
if not model then
  for _, v in ipairs(workspace:GetChildren()) do
    if v:IsA("Model") and v:FindFirstChildOfClass("Humanoid") then
      model = v; break
    end
  end
end
if not model then warn("[Mixamo2Roblox] Selecciona un personaje primero"); return end

-- Limpiar animacion anterior
local old = workspace:FindFirstChild(animName)
if old then old:Destroy() end

local ks = Instance.new("KeyframeSequence")
ks.Name = animName
ks.Loop = false
ks.Priority = Enum.AnimationPriority.Action

local function addPose(parent, boneName, cf)
  local p = Instance.new("Pose")
  p.Name = boneName
  p.CFrame = cf
  p.EasingStyle = Enum.PoseEasingStyle.Linear
  p.EasingDirection = Enum.PoseEasingDirection.In
  p.Weight = 1
  p.Parent = parent
  return p
end

local function makeKeyframe(t)
  local kf = Instance.new("Keyframe")
  kf.Time = t
  kf.Parent = ks
  return kf
end

`;

  // Multiplicar dos matrices
  const mul = (a, b) => ({
    r00: a.r00*b.r00+a.r01*b.r10+a.r02*b.r20, r01: a.r00*b.r01+a.r01*b.r11+a.r02*b.r21, r02: a.r00*b.r02+a.r01*b.r12+a.r02*b.r22,
    r10: a.r10*b.r00+a.r11*b.r10+a.r12*b.r20, r11: a.r10*b.r01+a.r11*b.r11+a.r12*b.r21, r12: a.r10*b.r02+a.r11*b.r12+a.r12*b.r22,
    r20: a.r20*b.r00+a.r21*b.r10+a.r22*b.r20, r21: a.r20*b.r01+a.r21*b.r11+a.r22*b.r21, r22: a.r20*b.r02+a.r21*b.r12+a.r22*b.r22,
    x: a.r00*b.x+a.r01*b.y+a.r02*b.z+a.x, y: a.r10*b.x+a.r11*b.y+a.r12*b.z+a.y, z: a.r20*b.x+a.r21*b.y+a.r22*b.z+a.z,
  });
  const inv = (m) => ({
    r00:m.r00, r01:m.r10, r02:m.r20,
    r10:m.r01, r11:m.r11, r12:m.r21,
    r20:m.r02, r21:m.r12, r22:m.r22,
    x:-(m.r00*m.x+m.r10*m.y+m.r20*m.z),
    y:-(m.r01*m.x+m.r11*m.y+m.r21*m.z),
    z:-(m.r02*m.x+m.r12*m.y+m.r22*m.z),
  });
  const identity = {r00:1,r01:0,r02:0,r10:0,r11:1,r12:0,r20:0,r21:0,r22:1,x:0,y:0,z:0};
  const getMat = (bone, t) => (reducedByBone[bone] && reducedByBone[bone][t]) || identity;

  // CFrame relativo: inv(parent) * child — lo que Roblox necesita para Pose.CFrame
  const getRelCF = (bone, t) => {
    const parent = BONE_HIERARCHY[bone];
    if (!parent) return getMat(bone, t);
    return mul(inv(getMat(parent, t)), getMat(bone, t));
  };

  const toCF = (m) =>
    `CFrame.new(0,0,0,${m.r00.toFixed(5)},${m.r01.toFixed(5)},${m.r02.toFixed(5)},${m.r10.toFixed(5)},${m.r11.toFixed(5)},${m.r12.toFixed(5)},${m.r20.toFixed(5)},${m.r21.toFixed(5)},${m.r22.toFixed(5)})`;

  // Generar keyframes con jerarquia correcta
  sortedTimes.forEach(t => {
    const tStr = t.toFixed(4);
    const getCF = (bone) => toCF(getRelCF(bone, t));

    script += `do -- t=${tStr}
local kf=makeKeyframe(${tStr})
local root=addPose(kf,"HumanoidRootPart",${getCF("HumanoidRootPart")})
local lt=addPose(root,"LowerTorso",${getCF("LowerTorso")})
local ut=addPose(lt,"UpperTorso",${getCF("UpperTorso")})
addPose(ut,"Head",${getCF("Head")})
local lua=addPose(ut,"LeftUpperArm",${getCF("LeftUpperArm")})
local lla=addPose(lua,"LeftLowerArm",${getCF("LeftLowerArm")})
addPose(lla,"LeftHand",${getCF("LeftHand")})
local rua=addPose(ut,"RightUpperArm",${getCF("RightUpperArm")})
local rla=addPose(rua,"RightLowerArm",${getCF("RightLowerArm")})
addPose(rla,"RightHand",${getCF("RightHand")})
local lul=addPose(lt,"LeftUpperLeg",${getCF("LeftUpperLeg")})
local lll=addPose(lul,"LeftLowerLeg",${getCF("LeftLowerLeg")})
addPose(lll,"LeftFoot",${getCF("LeftFoot")})
local rul=addPose(lt,"RightUpperLeg",${getCF("RightUpperLeg")})
local rll=addPose(rul,"RightLowerLeg",${getCF("RightLowerLeg")})
addPose(rll,"RightFoot",${getCF("RightFoot")})
end
`;
  });

  script += `
ks.Parent = workspace
game:GetService("Selection"):Set({ks})
print("[Mixamo2Roblox] KeyframeSequence '"..animName.."' creada con ${sortedTimes.length} keyframes")
print("Ahora: clic derecho en '"..animName.."' en el Explorador → Save to Roblox → copia el ID")
`;

  return script;
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
