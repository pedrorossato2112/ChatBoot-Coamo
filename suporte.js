import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ---------------- CONFIG FIREBASE ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---------------- ELEMENTOS ----------------
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const apelidoLoginInput = document.getElementById("apelidoLogin");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const friendEmailInput = document.getElementById("friendEmail");
const friendApelidoInput = document.getElementById("friendApelido");
const startChatBtn = document.getElementById("startChatBtn");
const contatosBox = document.getElementById("contatosBox");

const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const chatBox = document.getElementById("chat-box");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const typingIndicator = document.getElementById("typingIndicator");
const respostaBox = document.getElementById("respostaBox");
const logoutBtn = document.getElementById("logoutBtn");

const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");

// ---------------- VARIÁVEIS ----------------
let conversaIdAtual = null;
let unsubscribeMensagens = null;
let apelidosCache = {};
let respostaMsg = null;

// ---------------- FUNÇÕES ----------------
function gerarIdConversa(usuario1, usuario2){
  return [usuario1, usuario2].sort().join("_");
}

// ---------------- CONTATOS ----------------
function salvarContato(email, apelido){
  if(!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if(!contatos.some(c => c.email === email)){
    contatos.push({email, apelido});
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
}

function carregarContatos(){
  contatosBox.innerHTML = "";
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  contatos.forEach(c => {
    const div = document.createElement("div");
    div.classList.add("contatoItem");
    div.textContent = c.apelido;
    div.addEventListener("click", () => abrirConversa(gerarIdConversa(auth.currentUser.email, c.email)));
    contatosBox.appendChild(div);
  });
}

// ---------------- APPELIDOS ----------------
async function salvarApelido(apelido){
  apelidosCache[auth.currentUser.email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  const userRef = doc(db, "users", auth.currentUser.email);
  await setDoc(userRef, {nickname: apelido}, {merge: true});
}

async function carregarApelidosCache(){
  const cache = localStorage.getItem("apelidosCache");
  apelidosCache = cache ? JSON.parse(cache) : {};
}

async function getApelido(email){
  if(!email) return "Anônimo";
  if(apelidosCache[email]) return apelidosCache[email];
  try{
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);
    if(userSnap.exists() && userSnap.data().nickname){
      apelidosCache[email] = userSnap.data().nickname;
      localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
      return apelidosCache[email];
    }
  }catch(err){console.error(err);}
  return email;
}

// ---------------- CONVERSAS ----------------
async function abrirConversa(conversaId){
  conversaIdAtual = conversaId;

  if(unsubscribeMensagens) unsubscribeMensagens();

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));
  
  unsubscribeMensagens = onSnapshot(q, async snapshot => {
    chatBox.innerHTML = "";
    for(const docSnap of snapshot.docs){
      const data = docSnap.data();
      const id = docSnap.id;

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");
      
      const apelido = await getApelido(data.usuario);
      msgEl.textContent = data.texto;

      // 3 pontinhos
      const optionsBtn = document.createElement("span");
      optionsBtn.textContent = "⋮";
      optionsBtn.style.position = "absolute";
      optionsBtn.style.right = "8px";
      optionsBtn.style.top = "8px";
      optionsBtn.style.cursor = "pointer";
      optionsBtn.style.color = "#000";
      optionsBtn.title = "Opções";
      optionsBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        mostrarOpcoes(msgEl, docSnap);
      });
      msgEl.appendChild(optionsBtn);

      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

function mostrarOpcoes(msgEl, docSnap){
  const menu = document.createElement("div");
  menu.style.position = "absolute";
  menu.style.background = "#fff";
  menu.style.border = "1px solid #000";
  menu.style.padding = "5px";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";

  const apagar = document.createElement("div");
  apagar.textContent = "Apagar";
  apagar.style.cursor = "pointer";
  apagar.style.color = "black";
  apagar.onclick = async () => {
    await deleteDoc(docSnap.ref);
    menu.remove();
  };

  const copiar = document.createElement("div");
  copiar.textContent = "Copiar";
  copiar.style.cursor = "pointer";
  copiar.style.color = "black";
  copiar.onclick = () => {
    navigator.clipboard.writeText(docSnap.data().texto);
    menu.remove();
  };

  menu.appendChild(apagar);
  menu.appendChild(copiar);

  msgEl.appendChild(menu);
}

// ---------------- ENVIO ----------------
btnSend.addEventListener("click", async ()=>{
  const texto = inputMsg.value.trim();
  if(!texto || !conversaIdAtual) return;
  const ref = collection(db, "conversas", conversaIdAtual, "mensagens");
  await addDoc(ref, {
    texto,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp()
  });
  inputMsg.value = "";
});

// ---------------- LOGIN / REGISTRO ----------------
loginBtn.addEventListener("click", async ()=>{
  try{
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  }catch(err){
    alert("Erro no login: "+err.message);
  }
});

registerBtn.addEventListener("click", async ()=>{
  try{
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    alert("Usuário registrado com sucesso!");
  }catch(err){
    alert("Erro no registro: "+err.message);
  }
});

// ---------------- AUTENTICAÇÃO ----------------
onAuthStateChanged(auth, async (user)=>{
  if(user){
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    await carregarApelidosCache();
    const apelido = apelidosCache[user.email] || "";
    if(!apelido){
      nicknameModal.style.display = "flex";
    }else{
      userApelidoDisplay.textContent = apelido;
    }
    carregarContatos();
  }else{
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});

// ---------------- SALVAR APELIDO ----------------
saveNicknameBtn.addEventListener("click", async ()=>{
  const nick = nicknameInput.value.trim();
  if(!nick) return alert("Digite um apelido!");
  await salvarApelido(nick);
  userApelidoDisplay.textContent = nick;
  nicknameModal.style.display = "none";
});

// ---------------- INICIAR CONVERSA ----------------
startChatBtn.addEventListener("click", ()=>{
  const email = friendEmailInput.value.trim().toLowerCase();
  const apelido = friendApelidoInput.value.trim();
  if(!email || !apelido) return alert("Preencha email e apelido do amigo!");
  salvarContato(email, apelido);
  abrirConversa(gerarIdConversa(auth.currentUser.email, email));
  friendEmailInput.value = "";
  friendApelidoInput.value = "";
});

// ---------------- LOGOUT ----------------
logoutBtn.addEventListener("click", async ()=>{
  await signOut(auth);
});
