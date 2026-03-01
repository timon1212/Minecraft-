const generateBtn = document.getElementById('generateBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const promptInput = document.getElementById('prompt');
const typeSelect = document.getElementById('type');
const styleSelect = document.getElementById('style');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const threeContainer = document.getElementById('threeContainer');
const itemQueueList = document.getElementById('itemQueue');

const OPENAI_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your OpenAI key

let currentImage = null;
let previewMesh = null;
let itemQueue = [];

// --- Three.js setup ---
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(45,1,0.1,1000);
camera.position.z = 3;
let renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
renderer.setSize(256,256);
threeContainer.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff,1);
light.position.set(1,1,1);
scene.add(light);
scene.add(new THREE.AmbientLight(0x888888));

function animate(){
    requestAnimationFrame(animate);
    if(previewMesh) previewMesh.rotation.y += 0.01;
    renderer.render(scene,camera);
}
animate();

// --- AI Texture Generation ---
async function generateTexture(prompt,type,style){
    const fullPrompt = `${prompt}, Minecraft ${type}, ${style} style, 512x512 pixel art, transparent if crop`;
    const res = await fetch('https://api.openai.com/v1/images/generations',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({prompt:fullPrompt,n:1,size:"512x512"})
    });
    const data = await res.json();
    const img_url = data.data[0].url;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = img_url;
    return new Promise(resolve=>{ img.onload = ()=>resolve(img); });
}

// --- 2D Preview ---
function drawTexture(img){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
}

// --- 3D Preview ---
function createItemMesh(type,img){
    if(previewMesh) scene.remove(previewMesh);
    let texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    let material = new THREE.MeshStandardMaterial({map:texture,transparent:true});
    let mesh;

    switch(type){
        case 'block':
        case 'item':
            mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
            break;
        case 'sword':
        case 'pickaxe':
        case 'axe':
            let group = new THREE.Group();
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2,1,0.1),material);
            blade.position.y = 0.5;
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.4,0.15), new THREE.MeshStandardMaterial({color:0x333333}));
            handle.position.y = -0.3;
            group.add(blade); group.add(handle);
            mesh = group;
            break;
        case 'armor':
            mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8,1,0.4),material);
            break;
        case 'crop':
            const planeGeo = new THREE.PlaneGeometry(1,1);
            const plane1 = new THREE.Mesh(planeGeo,material);
            const plane2 = new THREE.Mesh(planeGeo,material);
            plane2.rotation.y = Math.PI/2;
            mesh = new THREE.Group();
            mesh.add(plane1); mesh.add(plane2);
            break;
        case 'mob':
            mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
            break;
        default:
            mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
    }
    previewMesh = mesh;
    scene.add(mesh);
}

// --- JSON Model ---
function generateModelJSON(name,type){
    if(type==='crop'){
        return {
            "parent":"block/cross",
            "textures":{"cross":`minecraft:blocks/${name}`}
        };
    } else {
        return {
            "parent":"item/generated",
            "textures":{"layer0":`minecraft:items/${name}`}
        };
    }
}

// --- Queue Functions ---
function addItemToQueue(name,type,img){
    const item = {name,type,img};
    itemQueue.push(item);

    const li = document.createElement('li');
    li.textContent = `${name} (${type})`;
    li.addEventListener('click',()=>{
        drawTexture(img);
        createItemMesh(type,img);
    });
    itemQueueList.appendChild(li);
}

// --- Generate Button ---
generateBtn.addEventListener('click',async()=>{
    const prompt = promptInput.value;
    const type = typeSelect.value;
    const style = styleSelect.value;
    const name = prompt.replace(/\s+/g,'_').toLowerCase();

    currentImage = await generateTexture(prompt,type,style);
    drawTexture(currentImage);
    createItemMesh(type,currentImage);
    addItemToQueue(name,type,currentImage);
});

// --- Download All ---
downloadAllBtn.addEventListener('click',async()=>{
    if(itemQueue.length===0){
        alert("No items in queue!");
        return;
    }
    const zip = new JSZip();
    zip.file("pack.mcmeta",JSON.stringify({"pack":{"pack_format":12,"description":"Generated with Minecraft AI Asset Generator"}},null,2));

    for(const item of itemQueue){
        const path = (item.type==='crop'?'blocks':'items');
        zip.file(`assets/minecraft/textures/${path}/${item.name}.png`,await fetch(item.img.src).then(r=>r.blob()));
        zip.file(`assets/minecraft/models/${item.type}/${item.name}.json`,JSON.stringify(generateModelJSON(item.name,item.type),null,2));
    }

    zip.generateAsync({type:"blob"}).then(content=>{
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `minecraft_ai_resourcepack.zip`;
        a.click();
    });
});
